import { apply, invert, solveUnitToQuad, type Vec2 } from '../math/homography.ts';
import { pointInPolygon } from '../math/geometry.ts';

/**
 * Free-form warp: the layer between a surface's frame and its clipping shape.
 *
 * A control point is a **position**, not a texture coordinate — you drag it to
 * move that piece of the projection onto the physical object, and the content
 * follows the geometry. Points live in frame space, so moving the frame carries
 * the warp along, exactly as it already carries the shape.
 *
 * Two grids, and the distinction is the whole design:
 *
 * - the **control** grid is what the user drags: few handles, usable UI;
 * - the **tessellation** is what gets drawn, finer than the control grid.
 *
 * Between control points, `smooth` runs a Catmull-Rom surface — continuous in
 * its first derivative, so a gradient does not facet — while `linear` keeps the
 * hard fold you asked for. Linear never tessellates finer than its control
 * grid: each cell is already exact under its own homography, and subdividing it
 * bilinearly would introduce the very error the projective path avoids.
 */
export type WarpInterpolation = 'smooth' | 'linear';

export interface Warp {
  /** Cells across and down. Points are one more than cells on each axis. */
  cols: number;
  rows: number;
  interpolation: WarpInterpolation;
  /** `(cols + 1) * (rows + 1)` points, row-major, in frame space. */
  points: Vec2[];
}

/** A drawn cell: where it goes, and which part of the frame it carries. */
export interface WarpCell {
  /** Frame-space positions, TL TR BR BL. */
  position: [Vec2, Vec2, Vec2, Vec2];
  /** The undeformed frame coordinates of those corners — the texture side. */
  texture: [Vec2, Vec2, Vec2, Vec2];
}

/** Control grid a warp starts with: enough to bend, few enough to grasp. */
export const DEFAULT_CELLS = 2;
/** Tessellation per control cell in `smooth` mode. */
export const SMOOTH_SUBDIVISIONS = 6;

/** Bounds a corrupt file cannot escape. Pulling a point outside the frame is
 *  legitimate; pulling it to the next county is not. */
const LIMIT = 4;

export function identityWarp(
  cols = DEFAULT_CELLS,
  rows = DEFAULT_CELLS,
  interpolation: WarpInterpolation = 'smooth',
): Warp {
  const points: Vec2[] = [];
  for (let row = 0; row <= rows; row++) {
    for (let col = 0; col <= cols; col++) {
      points.push({ x: col / cols, y: row / rows });
    }
  }
  return { cols, rows, interpolation, points };
}

export function pointIndex(warp: Warp, col: number, row: number): number {
  return row * (warp.cols + 1) + col;
}

/**
 * Control point at a grid position, extrapolating past the edges.
 *
 * The obvious move is to clamp the index, duplicating the edge point. It is
 * also wrong: Catmull-Rom through a repeated endpoint curves, so an untouched
 * identity grid stopped being an identity — the first thing AC-44 checks, and
 * the thing that makes "reset" trustworthy. Reflecting the neighbour instead
 * (`2·edge − inner`) keeps evenly spaced points collinear, and a spline through
 * collinear points is the straight line.
 */
function control(warp: Warp, col: number, row: number): Vec2 {
  if (col < 0) return reflect(control(warp, 0, row), control(warp, 1, row));
  if (col > warp.cols) return reflect(control(warp, warp.cols, row), control(warp, warp.cols - 1, row));
  if (row < 0) return reflect(control(warp, col, 0), control(warp, col, 1));
  if (row > warp.rows) return reflect(control(warp, col, warp.rows), control(warp, col, warp.rows - 1));
  return warp.points[pointIndex(warp, col, row)] ?? { x: 0, y: 0 };
}

function reflect(edge: Vec2, inner: Vec2): Vec2 {
  return { x: 2 * edge.x - inner.x, y: 2 * edge.y - inner.y };
}

/** True when every point still sits on the regular grid. */
export function isIdentity(warp: Warp): boolean {
  const reference = identityWarp(warp.cols, warp.rows, warp.interpolation);
  return warp.points.every((p, i) => {
    const q = reference.points[i]!;
    return Math.abs(p.x - q.x) < 1e-9 && Math.abs(p.y - q.y) < 1e-9;
  });
}

/**
 * Position of the frame coordinate `(u, v)` after the warp.
 *
 * This is the one function that defines what the surface *is*: rendering
 * tessellates it, resampling re-reads it, and the editor's hit test inverts it.
 */
export function evaluateWarp(warp: Warp, u: number, v: number): Vec2 {
  const gu = clamp01(u) * warp.cols;
  const gv = clamp01(v) * warp.rows;
  const col = Math.min(Math.floor(gu), warp.cols - 1);
  const row = Math.min(Math.floor(gv), warp.rows - 1);
  const tu = gu - col;
  const tv = gv - row;

  if (warp.interpolation === 'linear') {
    const a = control(warp, col, row);
    const b = control(warp, col + 1, row);
    const c = control(warp, col + 1, row + 1);
    const d = control(warp, col, row + 1);
    return {
      x: lerp(lerp(a.x, b.x, tu), lerp(d.x, c.x, tu), tv),
      y: lerp(lerp(a.y, b.y, tu), lerp(d.y, c.y, tu), tv),
    };
  }

  // Tensor-product Catmull-Rom: four rows sampled across, then blended down.
  const rowsSampled: Vec2[] = [];
  for (let k = -1; k <= 2; k++) {
    rowsSampled.push(catmullRom(
      control(warp, col - 1, row + k),
      control(warp, col, row + k),
      control(warp, col + 1, row + k),
      control(warp, col + 2, row + k),
      tu,
    ));
  }
  return catmullRom(rowsSampled[0]!, rowsSampled[1]!, rowsSampled[2]!, rowsSampled[3]!, tv);
}

/** The cells to draw. `linear` ignores subdivision — see the module comment. */
export function tessellate(warp: Warp, subdivisions = SMOOTH_SUBDIVISIONS): WarpCell[] {
  const step = warp.interpolation === 'linear' ? 1 : Math.max(1, Math.round(subdivisions));
  const nx = warp.cols * step;
  const ny = warp.rows * step;

  const cells: WarpCell[] = [];
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      const u0 = x / nx;
      const u1 = (x + 1) / nx;
      const v0 = y / ny;
      const v1 = (y + 1) / ny;
      cells.push({
        texture: [{ x: u0, y: v0 }, { x: u1, y: v0 }, { x: u1, y: v1 }, { x: u0, y: v1 }],
        position: [
          evaluateWarp(warp, u0, v0), evaluateWarp(warp, u1, v0),
          evaluateWarp(warp, u1, v1), evaluateWarp(warp, u0, v1),
        ],
      });
    }
  }
  return cells;
}

/** Tessellation is pure and expensive enough to be worth keeping, and a warp
 *  object is replaced whenever it changes — so identity is a safe key. */
const tessellationCache = new WeakMap<Warp, WarpCell[]>();

function cachedCells(warp: Warp): WarpCell[] {
  let cells = tessellationCache.get(warp);
  if (!cells) {
    cells = tessellate(warp);
    tessellationCache.set(warp, cells);
  }
  return cells;
}

/**
 * The inverse of `evaluateWarp`: which frame coordinate ended up here.
 *
 * Needed because hit testing runs backwards — the pointer is in output space,
 * and the question is which part of the frame the user is touching. There is no
 * closed form for a free mesh, so it finds the cell containing the point and
 * inverts that cell's homography, which is exact inside the cell.
 *
 * Returns null when the point is outside the deformed surface, which is the
 * honest answer: the click missed.
 */
export function unwarp(warp: Warp, point: Vec2): Vec2 | null {
  for (const cell of cachedCells(warp)) {
    if (!pointInPolygon(point, cell.position)) continue;
    const h = solveUnitToQuad(cell.position);
    const inverse = h ? invert(h) : null;
    if (!inverse) continue;
    const local = apply(inverse, point);
    if (!local) continue;
    const [tl, tr, , bl] = cell.texture;
    return {
      x: tl.x + clamp01(local.x) * (tr.x - tl.x),
      y: tl.y + clamp01(local.y) * (bl.y - tl.y),
    };
  }
  return null;
}

/**
 * Changes the control grid without throwing away the shape already dialled in:
 * the new points are read off the current surface.
 */
export function resampleWarp(warp: Warp, cols: number, rows: number): Warp {
  const nextCols = clampInt(Math.round(cols), 1, 16);
  const nextRows = clampInt(Math.round(rows), 1, 16);
  const points: Vec2[] = [];
  for (let row = 0; row <= nextRows; row++) {
    for (let col = 0; col <= nextCols; col++) {
      points.push(evaluateWarp(warp, col / nextCols, row / nextRows));
    }
  }
  return { cols: nextCols, rows: nextRows, interpolation: warp.interpolation, points };
}

/**
 * Parses a warp out of untrusted JSON.
 *
 * Same trust boundary reasoning as the rest of `project.json`: a point count
 * that disagrees with the grid, or a NaN coordinate, is repaired or dropped
 * here — never allowed to reach the renderer, where it would blank a wall.
 */
export function parseWarp(raw: unknown): Warp | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const record = raw as Record<string, unknown>;

  const cols = clampInt(Math.round(numberOr(record['cols'], NaN)), 1, 16);
  const rows = clampInt(Math.round(numberOr(record['rows'], NaN)), 1, 16);
  if (!Number.isFinite(cols) || !Number.isFinite(rows)) return null;

  const interpolation: WarpInterpolation = record['interpolation'] === 'linear' ? 'linear' : 'smooth';
  const identity = identityWarp(cols, rows, interpolation);

  const raw_points = Array.isArray(record['points']) ? record['points'] : [];
  // A grid that disagrees with its point count is unrecoverable as a whole, but
  // every point that IS valid is still someone's work: keep those, fill the rest
  // from the identity grid.
  const points = identity.points.map((fallback, i) => {
    const candidate = raw_points[i];
    if (typeof candidate !== 'object' || candidate === null) return fallback;
    const { x, y } = candidate as Record<string, unknown>;
    if (typeof x !== 'number' || typeof y !== 'number') return fallback;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return fallback;
    return { x: clampRange(x), y: clampRange(y) };
  });

  return { cols, rows, interpolation, points };
}

function catmullRom(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
  const t2 = t * t;
  const t3 = t2 * t;
  const blend = (a: number, b: number, c: number, d: number): number =>
    0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return { x: blend(p0.x, p1.x, p2.x, p3.x), y: blend(p0.y, p1.y, p2.y, p3.y) };
}

function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
function clamp01(v: number): number { return v < 0 ? 0 : v > 1 ? 1 : v; }
function clampRange(v: number): number { return v < -LIMIT ? -LIMIT : v > LIMIT ? LIMIT : v; }
function clampInt(v: number, lo: number, hi: number): number {
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo;
}
function numberOr(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}
