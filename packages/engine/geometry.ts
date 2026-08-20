import type { Vec2 } from './homography.ts';

/** Axis-aligned bounds of a point set. Empty input yields a zero-size box. */
export function bounds(points: readonly Vec2[]): { x: number; y: number; w: number; h: number } {
  if (points.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Signed area x2. Positive means counter-clockwise in a y-down space. */
export function signedArea(poly: readonly Vec2[]): number {
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return sum;
}

/** Ray casting. Points exactly on an edge are not guaranteed either way. */
export function pointInPolygon(p: Vec2, poly: readonly Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    const straddles = a.y > p.y !== b.y > p.y;
    if (straddles && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/**
 * Ear clipping triangulation. Returns index triples into `poly`.
 *
 * ponytail: O(n^2) and simple-polygon only. A mapping polygon is traced by
 * hand and has a handful of points; swap for earcut if someone ever imports
 * an SVG with hundreds.
 */
export function triangulate(poly: readonly Vec2[]): number[] {
  const n = poly.length;
  if (n < 3) return [];
  // Work on a CCW copy so the convexity test has one sign to check.
  const ccw = signedArea(poly) > 0;
  const idx = [...Array(n).keys()];
  if (!ccw) idx.reverse();

  const out: number[] = [];
  let guard = n * n;
  while (idx.length > 3 && guard-- > 0) {
    let clipped = false;
    for (let i = 0; i < idx.length; i++) {
      const ia = idx[(i + idx.length - 1) % idx.length]!;
      const ib = idx[i]!;
      const ic = idx[(i + 1) % idx.length]!;
      const a = poly[ia]!, b = poly[ib]!, c = poly[ic]!;
      if (cross(a, b, c) <= 0) continue; // reflex vertex, not an ear
      // An ear must contain no other vertex of the polygon.
      let contains = false;
      for (const other of idx) {
        if (other === ia || other === ib || other === ic) continue;
        if (pointInTriangle(poly[other]!, a, b, c)) { contains = true; break; }
      }
      if (contains) continue;
      out.push(ia, ib, ic);
      idx.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) break; // self-intersecting input; bail with what we have
  }
  if (idx.length === 3) out.push(idx[0]!, idx[1]!, idx[2]!);
  return out;
}

function cross(a: Vec2, b: Vec2, c: Vec2): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function pointInTriangle(p: Vec2, a: Vec2, b: Vec2, c: Vec2): boolean {
  const d1 = cross(a, b, p), d2 = cross(b, c, p), d3 = cross(c, a, p);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

/**
 * Closest point on the segment a→b, and how far `p` is from it.
 *
 * Snapping to an edge needs the foot of the perpendicular, not the nearest
 * endpoint: a corner dragged to the middle of a long edge has to land on the
 * edge, not jump to its end.
 */
export function closestOnSegment(p: Vec2, a: Vec2, b: Vec2): { point: Vec2; distance: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  // A degenerate edge is a point; clamping t would divide by zero.
  const t = lengthSquared === 0 ? 0 : clamp01(((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared);
  const point = { x: a.x + dx * t, y: a.y + dy * t };
  return { point, distance: Math.hypot(p.x - point.x, p.y - point.y) };
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** True when `p` is inside the ellipse inscribed in the unit frame. */
export function pointInUnitEllipse(p: Vec2): boolean {
  const dx = (p.x - 0.5) * 2;
  const dy = (p.y - 0.5) * 2;
  return dx * dx + dy * dy <= 1;
}

/** Unit-square outline in frame space, used as the quad shape's polygon. */
export const UNIT_QUAD: readonly Vec2[] = [
  { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 },
];
