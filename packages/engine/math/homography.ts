/**
 * Projective transform between the unit frame space (0..1)^2 and output pixels.
 *
 * A homography is a 3x3 matrix applied to homogeneous points. It is the whole
 * reason perspective works: `H * (u, v, 1)` yields `(X, Y, W)` and the real
 * pixel is `(X/W, Y/W)`. The `W` is not noise to be divided away and forgotten,
 * it is what the rasterizer needs to interpolate UVs without the diagonal
 * crease (see renderer.ts).
 */
export type Mat3 = readonly [
  number, number, number,
  number, number, number,
  number, number, number,
];

export type Vec2 = { x: number; y: number };

/** Corners in TL, TR, BR, BL order — the same order used by `Surface.frame`. */
export type Quad = readonly [Vec2, Vec2, Vec2, Vec2];

/**
 * Homography mapping the unit square (0,0),(1,0),(1,1),(0,1) onto `quad`.
 *
 * Solves the classic 8x8 linear system for h11..h32 with h33 fixed at 1, by
 * Gaussian elimination with partial pivoting. Degenerate quads (collinear or
 * coincident corners) produce a singular system; we return null rather than
 * NaN-poisoning the render loop.
 */
export function solveUnitToQuad(quad: Quad): Mat3 | null {
  const [tl, tr, br, bl] = quad;
  // Unit-square source corners paired with destination corners.
  const src: Vec2[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
  const dst: Vec2[] = [tl, tr, br, bl];

  // Each correspondence gives two rows: one for x, one for y.
  const a: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x: u, y: v } = src[i]!;
    const { x, y } = dst[i]!;
    a.push([u, v, 1, 0, 0, 0, -u * x, -v * x]);
    b.push(x);
    a.push([0, 0, 0, u, v, 1, -u * y, -v * y]);
    b.push(y);
  }

  const h = solveLinear(a, b);
  if (!h) return null;
  return [h[0]!, h[1]!, h[2]!, h[3]!, h[4]!, h[5]!, h[6]!, h[7]!, 1];
}

/** Gaussian elimination with partial pivoting. Returns null if singular. */
function solveLinear(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  // Work on an augmented copy so callers keep their arrays.
  const m = a.map((row, i) => [...row, b[i]!]);

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(m[r]![col]!) > Math.abs(m[pivot]![col]!)) pivot = r;
    }
    if (Math.abs(m[pivot]![col]!) < 1e-12) return null;
    [m[col], m[pivot]] = [m[pivot]!, m[col]!];

    const pivRow = m[col]!;
    const piv = pivRow[col]!;
    for (let c = col; c <= n; c++) pivRow[c] = pivRow[c]! / piv;

    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = m[r]![col]!;
      if (factor === 0) continue;
      for (let c = col; c <= n; c++) m[r]![c] = m[r]![c]! - factor * pivRow[c]!;
    }
  }
  return m.map((row) => row[n]!);
}

/** Adjugate-based inverse. For a homography the scale is irrelevant (it is
 *  projective), so we skip normalising by the determinant sign. */
export function invert(h: Mat3): Mat3 | null {
  const [a, b, c, d, e, f, g, i, j] = h;
  const A = e * j - f * i;
  const B = f * g - d * j;
  const C = d * i - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-16) return null;
  const s = 1 / det;
  return [
    A * s, (c * i - b * j) * s, (b * f - c * e) * s,
    B * s, (a * j - c * g) * s, (c * d - a * f) * s,
    C * s, (b * g - a * i) * s, (a * e - b * d) * s,
  ];
}

/** Apply `h` to a point and divide by w. Returns null on points at infinity. */
export function apply(h: Mat3, p: Vec2): Vec2 | null {
  const w = h[6] * p.x + h[7] * p.y + h[8];
  if (Math.abs(w) < 1e-12) return null;
  return {
    x: (h[0] * p.x + h[1] * p.y + h[2]) / w,
    y: (h[3] * p.x + h[4] * p.y + h[5]) / w,
  };
}

/** Apply `h` keeping the homogeneous w — the renderer needs it per vertex. */
export function applyH(h: Mat3, p: Vec2): { x: number; y: number; w: number } {
  return {
    x: h[0] * p.x + h[1] * p.y + h[2],
    y: h[3] * p.x + h[4] * p.y + h[5],
    w: h[6] * p.x + h[7] * p.y + h[8],
  };
}

/** Output pixels -> frame space. Convenience for hit-testing and free polygons. */
export function quadToUnit(quad: Quad): Mat3 | null {
  const h = solveUnitToQuad(quad);
  return h ? invert(h) : null;
}
