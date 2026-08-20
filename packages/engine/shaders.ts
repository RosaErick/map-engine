/**
 * The GLSL the renderer runs, and nothing else.
 *
 * Kept apart from `renderer.ts` because shader source and GL bookkeeping are
 * read for different reasons: one is graphics maths under review, the other is
 * plumbing. Both were in one 470-line file.
 */
export const VERT = `#version 300 es
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

export const FRAG = `#version 300 es
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

export function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(`shader: ${gl.getShaderInfoLog(sh) ?? ''}`);
  }
  return sh;
}
