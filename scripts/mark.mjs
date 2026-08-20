/**
 * The mark: a pixel grid, warped by the very homography the tool applies.
 *
 * Projection mapping is a grid thrown at a surface until it fits — so the mark
 * is a grid mid-throw, drawn with `solveUnitToQuad`, the same function the
 * renderer uses on every surface. Not a picture of the idea: the idea, run once.
 */
import { solveUnitToQuad, apply } from '../packages/engine/homography.ts';

export const RED = '#ff3b30';

/**
 * Quad in a 0..1 box, TL, TR, BR, BL.
 *
 * Symmetric and steep on purpose: a tilted square reads as a rotated grid, a
 * converging one reads as a grid *thrown at something*. That difference is the
 * whole mark.
 */
const QUAD = [
  { x: 0.30, y: 0.14 },
  { x: 0.70, y: 0.14 },
  { x: 0.94, y: 0.86 },
  { x: 0.06, y: 0.86 },
];

/** The one cell carrying content — the surface you already mapped. */
const LIT = { row: 1, col: 1 };

/**
 * Cells of an n×n grid, already projected. `gap` is the share of each slot left
 * empty, which is what makes it read as pixels instead of a mesh.
 */
export function cells(size, n = 3, gap = 0.16) {
  const h = solveUnitToQuad(QUAD.map((p) => ({ x: p.x * size, y: p.y * size })));
  if (!h) throw new Error('degenerate quad');

  const out = [];
  const step = 1 / n;
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const u0 = (col + gap / 2) * step;
      const u1 = (col + 1 - gap / 2) * step;
      const v0 = (row + gap / 2) * step;
      const v1 = (row + 1 - gap / 2) * step;
      const corners = [
        apply(h, { x: u0, y: v0 }), apply(h, { x: u1, y: v0 }),
        apply(h, { x: u1, y: v1 }), apply(h, { x: u0, y: v1 }),
      ];
      if (corners.some((c) => c === null)) continue;
      out.push({
        row,
        col,
        lit: row === LIT.row && col === LIT.col,
        points: corners.map((c) => `${c.x.toFixed(2)},${c.y.toFixed(2)}`).join(' '),
      });
    }
  }
  return out;
}

/**
 * The grid as SVG polygons.
 *
 * `litColor` is separate because the lit cell has to contrast with whatever is
 * behind the mark: white on the black app icon, `currentColor` in the interface,
 * where the same mark sits on a light or a dark bar.
 */
export function markSvg(size, { n = 3, gap = 0.16, color = RED, litColor = '#fff' } = {}) {
  return cells(size, n, gap)
    .map((c) => `<polygon points="${c.points}" fill="${c.lit ? litColor : color}"/>`)
    .join('');
}
