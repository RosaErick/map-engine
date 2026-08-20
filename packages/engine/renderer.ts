import { applyH, solveUnitToQuad, type Mat3, type Vec2 } from './homography.ts';
import { triangulate } from './geometry.ts';
import { tessellate, type Warp } from './warp.ts';
import { compile, FRAG, VERT } from './shaders.ts';
import { frameToPixel, surfaceOrder, toColumnMajor, uvMatrix } from './surface-math.ts';
import type { Blend, Project, Shape, Surface, TestPattern } from './project.ts';
import type { SourcePool } from './sources/index.ts';
import { createTexture, uploadTexture } from './sources/types.ts';
import type { TextureSource } from './sources/types.ts';

/** What a surface needs on the GPU, derived once per surface version. */
interface SurfaceDraw {
  /** Frame space -> output pixels, column-major for `uniformMatrix3fv`. */
  homography: Float32Array;
  /** Positions in frame space, 0..1. */
  vertices: Float32Array;
  indices: Uint16Array;
  /** Present only for a warped surface. Interleaved x, y, w, u, v per vertex. */
  mesh?: { vertices: Float32Array; indices: Uint16Array };
}

/** Corners of the unit square, in the order every cell uses: TL, TR, BR, BL. */
const UNIT_CORNERS: readonly Vec2[] = [
  { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 },
];

/** Editor pan/zoom. The output window always uses the identity. */
export interface ViewTransform { scale: number; tx: number; ty: number }
export const IDENTITY_VIEW: ViewTransform = { scale: 1, tx: 0, ty: 0 };

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
  /** Separate array object for the mesh path: a different vertex layout, and
   *  keeping it apart means the quad path is not touched at all. */
  #meshVao: WebGLVertexArrayObject;
  #meshVbo: WebGLBuffer;
  #meshIbo: WebGLBuffer;
  #u: Record<string, WebGLUniformLocation | null>;
  #numberTextures = new Map<number, WebGLTexture>();
  /** Polygon cutouts rasterised for the mesh path, keyed by the shape object —
   *  a mutation replaces the shape, so the old entry falls out on its own. */
  #maskTextures = new WeakMap<Shape, WebGLTexture>();
  /**
   * Per-surface data that only changes when the surface itself changes.
   *
   * Solving the homography and triangulating a polygon are the two expensive
   * things this class does, and both were being redone for every surface on
   * every frame. Keying the cache on the `Surface` object makes invalidation
   * free: `Store.mutate` deep-clones the project, so any edit produces new
   * objects and the old entries fall out of the WeakMap on their own. There is
   * no invalidation code here to get wrong.
   */
  #draws = new WeakMap<Surface, SurfaceDraw>();
  /** Reused so the uv matrix is not a fresh allocation on every draw. */
  #uvScratch = new Float32Array(9);
  /** Surface numbering for the `number` pattern, recomputed per project. */
  #numbering: { project: Project; order: Map<Surface, number> } | null = null;
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

    // Mesh path: interleaved (x, y, w, u, v), 20 bytes per vertex.
    this.#meshVao = gl.createVertexArray()!;
    this.#meshVbo = gl.createBuffer()!;
    this.#meshIbo = gl.createBuffer()!;
    gl.bindVertexArray(this.#meshVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.#meshVbo);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.#meshIbo);
    const posLoc = gl.getAttribLocation(prog, 'aWarpPos');
    const uvLoc = gl.getAttribLocation(prog, 'aWarpUV');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(uvLoc);
    gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 20, 12);
    gl.bindVertexArray(null);

    this.#u = Object.fromEntries(
      ['uH', 'uResolution', 'uView', 'uTex', 'uMaskTex', 'uUVMat', 'uOpacity', 'uMask', 'uFeather', 'uMode', 'uPattern', 'uTime', 'uWarped']
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
    gl.uniform2f(this.#u['uResolution']!, width, height);
    gl.uniform3f(this.#u['uView']!, view.scale, view.tx, view.ty);
    gl.uniform1f(this.#u['uTime']!, (performance.now() - this.#t0) / 1000);
    gl.uniform1i(this.#u['uTex']!, 0);
    gl.uniform1i(this.#u['uMaskTex']!, 1);
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
    const draw = this.#drawDataFor(surface);
    if (!draw) return; // degenerate quad, nothing sane to draw

    const source = pool.get(surface.sourceId);
    const patternId = PATTERN_INDEX[pattern];
    const mode = this.#modeFor(surface, source, patternId);
    let texture: WebGLTexture | null = null;

    if (patternId === 2) {
      texture = this.#numberTexture(this.#numberFor(project, surface));
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

    const mesh = draw.mesh;
    gl.uniform1i(this.#u['uWarped']!, mesh ? 1 : 0);
    if (mesh) {
      gl.bindVertexArray(this.#meshVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.#meshVbo);
      gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.#meshIbo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.DYNAMIC_DRAW);
    } else {
      gl.bindVertexArray(this.#vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.#vbo);
      gl.bufferData(gl.ARRAY_BUFFER, draw.vertices, gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.#ibo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, draw.indices, gl.DYNAMIC_DRAW);
    }

    gl.uniformMatrix3fv(this.#u['uH']!, false, draw.homography);
    // The uv matrix is not cached with the rest: it also depends on the source's
    // pixel size, which arrives asynchronously when a video or image finishes
    // loading, without the surface changing at all.
    gl.uniformMatrix3fv(this.#u['uUVMat']!, false, uvMatrix(surface, source, this.#uvScratch));
    gl.uniform1f(this.#u['uOpacity']!, surface.opacity);
    // A polygon is normally its own geometry. On a warped surface the geometry
    // is the mesh, so the cutout moves into a texture instead.
    const texturedMask = mesh !== undefined && surface.shape.kind === 'polygon';
    if (texturedMask) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.#maskTexture(surface.shape));
      gl.activeTexture(gl.TEXTURE0);
    }
    gl.uniform1i(this.#u['uMask']!, texturedMask ? 2 : surface.shape.kind === 'ellipse' ? 1 : 0);
    gl.uniform1f(this.#u['uFeather']!, surface.shape.kind === 'ellipse' ? surface.shape.feather : 0);
    gl.uniform1i(this.#u['uMode']!, mode);
    gl.uniform1i(this.#u['uPattern']!, patternId);

    if (surface.blend !== this.#boundBlend) {
      setBlend(gl, surface.blend);
      this.#boundBlend = surface.blend;
    }
    const indexCount = mesh ? mesh.indices.length : draw.indices.length;
    gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);
  }

  /** 0 = draw the texture, 1 = missing-media hazard, 2 = draw nothing. */
  #modeFor(surface: Surface, source: TextureSource | null, patternId: number): number {
    if (patternId !== 0) return 0;
    if (!surface.sourceId) return 2;
    if (!source || source.status === 'error') return 1;
    if (source.status === 'loading') return 2;
    return 0;
  }

  /**
   * Frame-space vertices and the homography, computed once per surface version.
   *
   * Quad and ellipse share the unit quad — the ellipse is cut in the fragment
   * shader — while the polygon is cut by its own triangulation.
   */
  #drawDataFor(surface: Surface): SurfaceDraw | null {
    const cached = this.#draws.get(surface);
    if (cached) return cached;

    const h = solveUnitToQuad(surface.frame);
    if (!h) return null;

    let vertices: Float32Array;
    let indices: Uint16Array;
    if (surface.shape.kind === 'polygon') {
      const points = surface.shape.points;
      vertices = new Float32Array(points.length * 2);
      points.forEach((p, i) => { vertices[i * 2] = p.x; vertices[i * 2 + 1] = p.y; });
      indices = new Uint16Array(triangulate(points));
    } else {
      vertices = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
      indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
    }

    const draw: SurfaceDraw = { homography: toColumnMajor(h), vertices, indices };
    if (surface.warp) draw.mesh = buildMesh(h, surface.warp);
    this.#draws.set(surface, draw);
    return draw;
  }

  /** Numbering for the `number` pattern, sorted once per project instead of
   *  once per surface. */
  #numberFor(project: Project, surface: Surface): number {
    if (this.#numbering?.project !== project) {
      this.#numbering = { project, order: surfaceOrder(project) };
    }
    return this.#numbering.order.get(surface) ?? 1;
  }

  /**
   * Rasterises a polygon into an alpha mask, in frame space.
   *
   * ponytail: a 2D canvas, not a stencil buffer or a compute pass. It runs once
   * per shape edit, the result is cached, and 512 square is more resolution than
   * a projector edge can show.
   */
  #maskTexture(shape: Shape): WebGLTexture {
    const cached = this.#maskTextures.get(shape);
    if (cached) return cached;

    const gl = this.gl;
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const c2d = canvas.getContext('2d')!;
    c2d.clearRect(0, 0, size, size);
    if (shape.kind === 'polygon' && shape.points.length >= 3) {
      c2d.fillStyle = '#fff';
      c2d.beginPath();
      shape.points.forEach((p, i) => {
        const x = p.x * size;
        const y = p.y * size;
        if (i === 0) c2d.moveTo(x, y);
        else c2d.lineTo(x, y);
      });
      c2d.closePath();
      c2d.fill();
    }

    const tex = createTexture(gl);
    uploadTexture(gl, tex, canvas);
    // The upload flips Y, which the sampler must not do here: the mask is
    // addressed with the frame coordinate, where v = 0 is the top.
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    this.#maskTextures.set(shape, tex);
    return tex;
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
    gl.deleteBuffer(this.#meshVbo);
    gl.deleteBuffer(this.#meshIbo);
    gl.deleteVertexArray(this.#meshVao);
    for (const t of this.#numberTextures.values()) gl.deleteTexture(t);
    this.#numberTextures.clear();
    gl.deleteBuffer(this.#vbo);
    gl.deleteBuffer(this.#ibo);
    gl.deleteVertexArray(this.#vao);
    gl.deleteProgram(this.#program);
  }
}

/**
 * Turns a warp into the interleaved buffer the mesh path draws.
 *
 * Each cell gets **its own homography** and its own `w` per vertex, which is
 * what keeps the texture projectively correct inside the cell. That is also why
 * vertices are not shared between cells: a corner belongs to up to four cells
 * and carries a different `w` in each.
 *
 * The index buffer is 16-bit, and the control grid is capped at 16x16 with a
 * fixed tessellation, so the worst case stays well under 65k vertices.
 */
function buildMesh(h: Mat3, warp: Warp): { vertices: Float32Array; indices: Uint16Array } {
  const cells = tessellate(warp);
  const vertices = new Float32Array(cells.length * 4 * 5);
  const indices = new Uint16Array(cells.length * 6);

  let v = 0;
  let i = 0;
  let base = 0;
  for (const cell of cells) {
    const screen = cell.position.map((p) => frameToPixel(h, p.x, p.y));
    const cellH = solveUnitToQuad(screen as [Vec2, Vec2, Vec2, Vec2]);

    for (let k = 0; k < 4; k++) {
      let x = screen[k]!.x;
      let y = screen[k]!.y;
      let w = 1;
      if (cellH) {
        // The cell's own homography at the unit corner returns the same point,
        // plus the w the rasterizer needs to interpolate the texture correctly.
        const p = applyH(cellH, UNIT_CORNERS[k]!);
        if (Math.abs(p.w) > 1e-12) {
          w = p.w;
          x = p.x / w;
          y = p.y / w;
        }
      }
      vertices[v++] = x;
      vertices[v++] = y;
      vertices[v++] = w;
      vertices[v++] = cell.texture[k]!.x;
      vertices[v++] = cell.texture[k]!.y;
    }

    indices[i++] = base;
    indices[i++] = base + 1;
    indices[i++] = base + 2;
    indices[i++] = base;
    indices[i++] = base + 2;
    indices[i++] = base + 3;
    base += 4;
  }
  return { vertices, indices };
}

function setBlend(gl: WebGL2RenderingContext, blend: Blend): void {
  switch (blend) {
    case 'add': gl.blendFunc(gl.ONE, gl.ONE); break;
    case 'screen': gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR); break;
    case 'multiply': gl.blendFunc(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA); break;
    default: gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }
}
