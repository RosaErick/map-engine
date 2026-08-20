import { applyH, type Mat3 } from './homography.ts';
import type { Project, Surface } from './project.ts';
import type { TextureSource } from './sources/types.ts';

/**
 * Pure maths about a surface: how its content is sampled, how its frame is
 * measured, and how it is numbered.
 *
 * None of it touches WebGL, so all of it is testable without a GPU — which is
 * why it lives here and not inside the renderer class.
 */
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
export function uvMatrix(
  surface: Surface,
  source: TextureSource | null,
  out: Float32Array = new Float32Array(9),
): Float32Array {
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
  out[0] = m00; out[1] = m10; out[2] = 0;
  out[3] = m01; out[4] = m11; out[5] = 0;
  out[6] = m02; out[7] = m12; out[8] = 1;
  return out;
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

/**
 * Which number each surface carries under the `number` pattern.
 *
 * The order is the editor's list order — descending z — because the number
 * projected on the wall has to match the row you clicked, or the pattern is
 * worse than useless while aligning. Built as a map in one pass instead of a
 * sort per surface.
 */
export function surfaceOrder(project: Project): Map<Surface, number> {
  const order = new Map<Surface, number>();
  [...project.surfaces].sort((a, b) => b.z - a.z).forEach((s, i) => order.set(s, i + 1));
  return order;
}

/** WebGL wants column-major; our Mat3 is written row-major for readability.
 *  Internal: the public surface is `createEngine`, not the matrix plumbing. */
export function toColumnMajor(h: Mat3): Float32Array {
  return new Float32Array([h[0], h[3], h[6], h[1], h[4], h[7], h[2], h[5], h[8]]);
}

/** Pixel position of a frame-space point — the editor's hit-testing needs the
 *  same maths the vertex shader runs. */
export function frameToPixel(h: Mat3, u: number, v: number): { x: number; y: number } {
  const p = applyH(h, { x: u, y: v });
  return { x: p.x / p.w, y: p.y / p.w };
}
