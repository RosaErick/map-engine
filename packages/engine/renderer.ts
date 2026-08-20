import { applyH, solveUnitToQuad, type Mat3 } from './homography.ts';
import { triangulate, UNIT_QUAD } from './geometry.ts';
import type { Blend, Project, Surface, TestPattern } from './project.ts';
import type { SourcePool } from './sources/index.ts';
import type { TextureSource } from './sources/types.ts';

/** Editor pan/zoom. The output window always uses the identity. */
export interface ViewTransform { scale: number; tx: number; ty: number }
export const IDENTITY_VIEW: ViewTransform = { scale: 1, tx: 0, ty: 0 };

const VERT = `#version 300 es
precision highp float;
in vec2 aUV;              // position in frame space, 0..1
uniform mat3 uH;          // frame space -> output pixels
uniform vec2 uResolution; // drawing buffer size in device pixels
uniform vec3 uView;       // editor pan/zoom: scale, tx, ty
out vec2 vUV;

void main() {
  vec3 p = uH * vec3(aUV, 1.0);
  float w = p.z;
  vec2 px = p.xy / w;                       // output pixels
  px = px * uView.x + uView.yz;             // editor pan/zoom
  vec2 clip = vec2(px.x / uResolution.x * 2.0 - 1.0,
                   1.0 - px.y / uResolution.y * 2.0);
  // Trap 1: multiply clip by w and hand w to gl_Position, so the rasterizer
  // interpolates vUV projectively. Without this a two-triangle quad shows a
  // diagonal crease straight down the middle of the texture.
  gl_Position = vec4(clip * w, 0.0, w);
  vUV = aUV;
}`;

const FRAG = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uTex;
uniform mat3 uUVMat;     // frame space -> texture coords (crop + fit + rotation)
uniform float uOpacity;
uniform int uMask;       // 0 = none (quad / polygon geometry), 1 = ellipse
uniform float uFeather;
uniform int uMode;       // 0 = texture, 1 = missing media, 2 = no source
uniform int uPattern;    // TestPattern index, 0 = none
uniform float uTime;
out vec4 outColor;

// Everything below returns PREMULTIPLIED rgba. Mixing conventions is what
// puts a grey halo around every shape on a projector.
vec4 solid(vec3 rgb) { return vec4(rgb, 1.0); }

vec4 missingMedia() {
  // Loud magenta hazard stripes: impossible to mistake for content.
  float s = step(0.5, fract((vUV.x + vUV.y) * 8.0 + uTime * 0.25));
  return solid(mix(vec3(0.0), vec3(1.0, 0.0, 0.6), s));
}

vec4 pattern(int id) {
  vec2 uv = vUV;
  if (id == 1) { // grid
    vec2 g = abs(fract(uv * 10.0) - 0.5);
    float line = step(min(g.x, g.y), 0.03);
    float border = step(min(min(uv.x, uv.y), min(1.0 - uv.x, 1.0 - uv.y)), 0.008);
    return solid(vec3(max(line, border)));
  }
  if (id == 3) { // crosshair
    float cross_ = step(min(abs(uv.x - 0.5), abs(uv.y - 0.5)), 0.004);
    float border = step(min(min(uv.x, uv.y), min(1.0 - uv.x, 1.0 - uv.y)), 0.008);
    float diag = step(abs(uv.x - uv.y), 0.003) + step(abs(uv.x + uv.y - 1.0), 0.003);
    return solid(vec3(max(max(cross_, border), diag)));
  }
  if (id == 4) return solid(vec3(1.0));                 // white
  if (id == 5) return solid(vec3(0.0));                 // black
  if (id == 6) {                                        // colour bars
    int i = int(floor(uv.x * 7.0));
    vec3 c = vec3(1.0);
    if (i == 1) c = vec3(1.0, 1.0, 0.0);
    else if (i == 2) c = vec3(0.0, 1.0, 1.0);
    else if (i == 3) c = vec3(0.0, 1.0, 0.0);
    else if (i == 4) c = vec3(1.0, 0.0, 1.0);
    else if (i == 5) c = vec3(1.0, 0.0, 0.0);
    else if (i == 6) c = vec3(0.0, 0.0, 1.0);
    return solid(c);
  }
  if (id == 7) {                                        // latency sweep
    float x = fract(uTime * 0.5);
    return solid(vec3(step(abs(uv.x - x), 0.01)));
  }
  return vec4(0.0);
}

void main() {
  vec4 c;
  if (uPattern == 2) {                 // surface number: a texture, see renderer.ts
    vec2 t = vUV;
    c = texture(uTex, t);
  } else if (uPattern != 0) {
    c = pattern(uPattern);
  } else if (uMode == 1) {
    c = missingMedia();
  } else if (uMode == 2) {
    // No source assigned: draw nothing at all. Black is transparency, and an
    // unassigned surface must not put light on the physical object.
    discard;
  } else {
    vec2 t = (uUVMat * vec3(vUV, 1.0)).xy;
    // 'contain' can push coords outside the image; letterbox with real black
    // rather than smearing the clamped edge pixel.
    if (t.x < 0.0 || t.x > 1.0 || t.y < 0.0 || t.y > 1.0) discard;
    c = texture(uTex, t);
  }

  float mask = 1.0;
  if (uMask == 1) {
    // Radial distance in frame space, so the ellipse inherits the frame's
    // perspective for free.
    float d = length((vUV - 0.5) * 2.0);
    float edge = max(uFeather, 0.004);
    mask = 1.0 - smoothstep(1.0 - edge, 1.0, d);
  }

  outColor = c * uOpacity * mask;
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(`shader: ${gl.getShaderInfoLog(sh) ?? ''}`);
  }
  return sh;
}

const PATTERN_INDEX: Record<TestPattern, number> = {
  none: 0, grid: 1, number: 2, crosshair: 3,
  white: 4, black: 5, bars: 6, sweep: 7,
};

/**
 * Draws a Project into a WebGL2 canvas. Knows nothing about the editor, the
 * DOM outside its own canvas, or any framework.
 *
 * One pass, no intermediate framebuffer: surfaces are sorted by z and drawn
 * straight to the default framebuffer with the blend mode each one asks for.
 */
export class Renderer {
  readonly gl: WebGL2RenderingContext;
  #canvas: HTMLCanvasElement;
  #program: WebGLProgram;
  #vao: WebGLVertexArrayObject;
  #vbo: WebGLBuffer;
  #ibo: WebGLBuffer;
  #u: Record<string, WebGLUniformLocation | null>;
  #numberTextures = new Map<number, WebGLTexture>();
  #t0 = performance.now();
  /** Last GL state pushed this frame, to skip redundant calls — see #setState. */
  #boundTexture: WebGLTexture | null = null;
  #boundBlend: Blend | null = null;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      alpha: false,              // the projector's black is our transparency
      antialias: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      desynchronized: true,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('WebGL2 is unavailable in this browser');
    this.gl = gl;
    this.#canvas = canvas;

    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(`link: ${gl.getProgramInfoLog(prog) ?? ''}`);
    }
    this.#program = prog;

    this.#vao = gl.createVertexArray()!;
    this.#vbo = gl.createBuffer()!;
    this.#ibo = gl.createBuffer()!;
    gl.bindVertexArray(this.#vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.#vbo);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.#ibo);
    const loc = gl.getAttribLocation(prog, 'aUV');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    this.#u = Object.fromEntries(
      ['uH', 'uResolution', 'uView', 'uTex', 'uUVMat', 'uOpacity', 'uMask', 'uFeather', 'uMode', 'uPattern', 'uTime']
        .map((n) => [n, gl.getUniformLocation(prog, n)]),
    );

    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    // Premultiplied source over destination.
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 1); // absolute black, never lifted
  }

  /** Sizes the drawing buffer to the projector's native pixels. Scaling twice
   *  blurs exactly what was aligned to the pixel. */
  resize(width: number, height: number, dpr = 1): void {
    const w = Math.round(width * dpr);
    const h = Math.round(height * dpr);
    if (this.#canvas.width !== w || this.#canvas.height !== h) {
      this.#canvas.width = w;
      this.#canvas.height = h;
    }
  }

  /**
   * `patternFor` takes a surface and returns its test pattern. It is a function
   * rather than a single value because each surface may carry its own — the
   * renderer has no business knowing where that decision comes from.
   */
  render(
    project: Project,
    surfaces: readonly Surface[],
    pool: SourcePool,
    view: ViewTransform = IDENTITY_VIEW,
    patternFor: (surface: Surface) => TestPattern = () => 'none',
  ): void {
    const gl = this.gl;
    const { width, height } = this.#canvas;
    gl.viewport(0, 0, width, height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.#program);
    gl.bindVertexArray(this.#vao);
    gl.uniform2f(this.#u['uResolution']!, width, height);
    gl.uniform3f(this.#u['uView']!, view.scale, view.tx, view.ty);
    gl.uniform1f(this.#u['uTime']!, (performance.now() - this.#t0) / 1000);
    gl.uniform1i(this.#u['uTex']!, 0);
    gl.activeTexture(gl.TEXTURE0);
    // A fresh frame knows nothing about what the last one left bound.
    this.#boundTexture = null;
    this.#boundBlend = null;

    for (const surface of surfaces) {
      this.#drawSurface(project, surface, pool, patternFor(surface));
    }
    gl.bindVertexArray(null);
  }

  #drawSurface(project: Project, surface: Surface, pool: SourcePool, pattern: TestPattern): void {
    const gl = this.gl;
    const h = solveUnitToQuad(surface.frame);
    if (!h) return; // degenerate quad, nothing sane to draw

    const source = pool.get(surface.sourceId);
    const patternId = PATTERN_INDEX[pattern];
    const mode = this.#modeFor(surface, source, patternId);
    let texture: WebGLTexture | null = null;

    if (patternId === 2) {
      texture = this.#numberTexture(surfaceNumber(project, surface));
    } else if (patternId === 0 && mode === 0 && source) {
      texture = source.getTexture(gl);
      if (!texture) return;
    }
    // Draw order still follows z — reordering would change what blends over
    // what. What is skipped is the redundant state: several surfaces sharing a
    // source, which is the common case in a wall of clips, bind once.
    if (texture && texture !== this.#boundTexture) {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      this.#boundTexture = texture;
    }

    const [verts, indices] = this.#geometry(surface);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.#vbo);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.#ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.DYNAMIC_DRAW);

    gl.uniformMatrix3fv(this.#u['uH']!, false, toColumnMajor(h));
    gl.uniformMatrix3fv(this.#u['uUVMat']!, false, uvMatrix(surface, source));
    gl.uniform1f(this.#u['uOpacity']!, surface.opacity);
    gl.uniform1i(this.#u['uMask']!, surface.shape.kind === 'ellipse' ? 1 : 0);
    gl.uniform1f(this.#u['uFeather']!, surface.shape.kind === 'ellipse' ? surface.shape.feather : 0);
    gl.uniform1i(this.#u['uMode']!, mode);
    gl.uniform1i(this.#u['uPattern']!, patternId);

    if (surface.blend !== this.#boundBlend) {
      setBlend(gl, surface.blend);
      this.#boundBlend = surface.blend;
    }
    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
  }

  /** 0 = draw the texture, 1 = missing-media hazard, 2 = draw nothing. */
  #modeFor(surface: Surface, source: TextureSource | null, patternId: number): number {
    if (patternId !== 0) return 0;
    if (!surface.sourceId) return 2;
    if (!source || source.status === 'error') return 1;
    if (source.status === 'loading') return 2;
    return 0;
  }

  /** Frame-space vertices. Quad and ellipse share the unit quad; the ellipse is
   *  cut in the fragment shader, the polygon by its own triangulation. */
  #geometry(surface: Surface): [Float32Array, Uint16Array] {
    if (surface.shape.kind === 'polygon') {
      const pts = surface.shape.points;
      const tris = triangulate(pts);
      const verts = new Float32Array(pts.length * 2);
      pts.forEach((p, i) => { verts[i * 2] = p.x; verts[i * 2 + 1] = p.y; });
      return [verts, new Uint16Array(tris)];
    }
    const verts = new Float32Array(UNIT_QUAD.flatMap((p) => [p.x, p.y]));
    return [verts, new Uint16Array([0, 1, 2, 0, 2, 3])];
  }

  /** DECISION: the surface-number pattern needs glyphs, and the cheapest way to
   *  get glyphs into GL is a 2D canvas rasterised once per number and cached.
   *  No font atlas, no SDF, no text engine. */
  #numberTexture(n: number): WebGLTexture {
    const cached = this.#numberTextures.get(n);
    if (cached) return cached;
    const gl = this.gl;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const c2d = canvas.getContext('2d')!;
    c2d.fillStyle = '#000';
    c2d.fillRect(0, 0, 256, 256);
    c2d.fillStyle = '#fff';
    c2d.font = 'bold 160px system-ui, sans-serif';
    c2d.textAlign = 'center';
    c2d.textBaseline = 'middle';
    c2d.fillText(String(n), 128, 128);
    c2d.strokeStyle = '#fff';
    c2d.lineWidth = 6;
    c2d.strokeRect(3, 3, 250, 250);
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    this.#numberTextures.set(n, tex);
    return tex;
  }

  dispose(): void {
    const gl = this.gl;
    for (const t of this.#numberTextures.values()) gl.deleteTexture(t);
    this.#numberTextures.clear();
    gl.deleteBuffer(this.#vbo);
    gl.deleteBuffer(this.#ibo);
    gl.deleteVertexArray(this.#vao);
    gl.deleteProgram(this.#program);
  }
}

/** Position in the editor's list, which sorts by descending z. The number
 *  projected on the wall has to match the item you clicked, or the pattern is
 *  worse than useless during alignment. */
export function surfaceNumber(project: Project, surface: Surface): number {
  return [...project.surfaces].sort((a, b) => b.z - a.z).indexOf(surface) + 1;
}

/** WebGL wants column-major; our Mat3 is written row-major for readability. */
export function toColumnMajor(h: Mat3): Float32Array {
  return new Float32Array([h[0], h[3], h[6], h[1], h[4], h[7], h[2], h[5], h[8]]);
}

/**
 * Texture coords = frameUV * scale + offset, folding crop and fit together.
 *
 * `contain` deliberately produces a sampling window larger than the image; the
 * fragment shader discards everything outside 0..1, so the letterbox is real
 * black rather than a stretched edge pixel.
 */
export function uvTransform(surface: Surface, source: TextureSource | null): [number, number, number, number] {
  const { crop, fit } = surface;
  let sx = crop.w, sy = crop.h, ox = crop.x, oy = crop.y;
  if (fit === 'stretch' || !source || source.size[0] <= 0 || source.size[1] <= 0) {
    return [sx, sy, ox, oy];
  }
  // A quarter turn swaps which side of the source faces which side of the frame,
  // so the fit has to be computed against the rotated aspect.
  // DECISION: only quarter turns swap it. A rectangle rotated 37 degrees has no
  // single meaningful aspect, and snapped rotations are the case that matters —
  // free rotation is for correcting a crooked projector, not for reframing.
  const quarterTurned = isQuarterTurned(surface.rotation);
  const srcW = quarterTurned ? source.size[1] : source.size[0];
  const srcH = quarterTurned ? source.size[0] : source.size[1];
  const srcAspect = (srcW * crop.w) / (srcH * crop.h);
  const r = srcAspect / frameAspectOf(surface);
  const wide = r > 1; // the source window is wider than the frame
  if (fit === 'cover' ? wide : !wide) {
    // Adjust horizontally: cover narrows the window (r>1), contain widens it (r<1).
    const w = sx / r;
    ox += (sx - w) / 2;
    sx = w;
  } else {
    // Adjust vertically: same two cases mirrored.
    const h = sy * r;
    oy += (sy - h) / 2;
    sy = h;
  }
  return [sx, sy, ox, oy];
}

/** True when the rotation is closer to a quarter turn than to a straight one. */
export function isQuarterTurned(rotation: number): boolean {
  const a = ((rotation % 180) + 180) % 180;
  return a > 45 && a < 135;
}

/**
 * The full frame-space -> texture-space affine, as a column-major mat3 for GL.
 *
 * Composed as: translate to the frame's centre, rotate by -angle (rotating the
 * content clockwise means sampling counter-clockwise), then apply the crop/fit
 * window. Rotating around the centre is what makes the content spin in place
 * instead of swinging out of the shape.
 */
export function uvMatrix(surface: Surface, source: TextureSource | null): Float32Array {
  const [sx, sy, ox, oy] = uvTransform(surface, source);
  const r = (-surface.rotation * Math.PI) / 180;
  const c = Math.cos(r);
  const sn = Math.sin(r);

  const m00 = sx * c;
  const m01 = -sx * sn;
  const m02 = ox + sx / 2 - sx * 0.5 * (c - sn);
  const m10 = sy * sn;
  const m11 = sy * c;
  const m12 = oy + sy / 2 - sy * 0.5 * (sn + c);
  // Column-major, same convention as toColumnMajor.
  return new Float32Array([m00, m10, 0, m01, m11, 0, m02, m12, 1]);
}

/** Approximate aspect of a perspective frame: mean of opposite edge lengths. */
export function frameAspectOf(surface: Surface): number {
  const [tl, tr, br, bl] = surface.frame;
  const top = Math.hypot(tr.x - tl.x, tr.y - tl.y);
  const bottom = Math.hypot(br.x - bl.x, br.y - bl.y);
  const left = Math.hypot(bl.x - tl.x, bl.y - tl.y);
  const right = Math.hypot(br.x - tr.x, br.y - tr.y);
  const w = (top + bottom) / 2;
  const h = (left + right) / 2;
  return h > 0 ? w / h : 1;
}

function setBlend(gl: WebGL2RenderingContext, blend: Blend): void {
  switch (blend) {
    case 'add': gl.blendFunc(gl.ONE, gl.ONE); break;
    case 'screen': gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR); break;
    case 'multiply': gl.blendFunc(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA); break;
    default: gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }
}

/** Pixel position of a frame-space point — the editor's hit-testing needs the
 *  same maths the vertex shader runs. */
export function frameToPixel(h: Mat3, u: number, v: number): { x: number; y: number } {
  const p = applyH(h, { x: u, y: v });
  return { x: p.x / p.w, y: p.y / p.w };
}
