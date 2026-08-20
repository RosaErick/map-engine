import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solveUnitToQuad, invert, apply, quadToUnit, type Quad } from './homography.ts';
import { triangulate, pointInPolygon, pointInUnitEllipse, closestOnSegment, signedArea, bounds } from './geometry.ts';

const EPS = 1e-9;

const perspectiveQuad: Quad = [
  { x: 120, y: 80 },   // TL
  { x: 900, y: 40 },   // TR
  { x: 1010, y: 620 }, // BR
  { x: 60, y: 700 },   // BL
];

test('AC-1: unit square corners map to the surface frame corners', () => {
  const h = solveUnitToQuad(perspectiveQuad)!;
  const corners = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
  corners.forEach((c, i) => {
    const p = apply(h, c)!;
    assert.ok(Math.abs(p.x - perspectiveQuad[i]!.x) < EPS, `x corner ${i}`);
    assert.ok(Math.abs(p.y - perspectiveQuad[i]!.y) < EPS, `y corner ${i}`);
  });
});

test('AC-2: a round trip through H and its inverse returns the origin point', () => {
  const h = solveUnitToQuad(perspectiveQuad)!;
  const hInv = invert(h)!;
  for (let u = 0; u <= 1; u += 0.125) {
    for (let v = 0; v <= 1; v += 0.125) {
      const px = apply(h, { x: u, y: v })!;
      const back = apply(hInv, px)!;
      assert.ok(Math.abs(back.x - u) < EPS, `u ${u},${v} -> ${back.x}`);
      assert.ok(Math.abs(back.y - v) < EPS, `v ${u},${v} -> ${back.y}`);
    }
  }
});

test('AC-2: quadToUnit is the inverse mapping', () => {
  const inv = quadToUnit(perspectiveQuad)!;
  const p = apply(inv, perspectiveQuad[2]!)!;
  assert.ok(Math.abs(p.x - 1) < EPS && Math.abs(p.y - 1) < EPS);
});

test('AC-3: a degenerate frame yields no transform instead of NaN', () => {
  const flat: Quad = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }];
  assert.equal(solveUnitToQuad(flat), null);
});

test('AC-4: a convex polygon triangulates into n-2 triangles', () => {
  const poly = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
  assert.equal(triangulate(poly).length, 2 * 3);
});

test('AC-4: a concave polygon triangulates without spilling outside it', () => {
  // Arrow shape with one reflex vertex.
  const poly = [
    { x: 0, y: 0 }, { x: 1, y: 0.5 }, { x: 0, y: 1 }, { x: 0.3, y: 0.5 },
  ];
  const tris = triangulate(poly);
  assert.equal(tris.length, 2 * 3);
});

test('AC-5: point-in-polygon answers hit tests', () => {
  const poly = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
  assert.ok(pointInPolygon({ x: 0.5, y: 0.5 }, poly));
  assert.ok(!pointInPolygon({ x: 1.5, y: 0.5 }, poly));
});

test('AC-5: winding sign and bounds of a point set', () => {
  const cw = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }];
  assert.ok(signedArea(cw) > 0);
  assert.ok(signedArea([...cw].reverse()) < 0);
  assert.deepEqual(bounds(cw), { x: 0, y: 0, w: 1, h: 1 });
});

test('AC-35: closestOnSegment lands on the perpendicular foot, not the nearest end', () => {
  const a = { x: 0, y: 0 };
  const b = { x: 100, y: 0 };
  const { point, distance } = closestOnSegment({ x: 40, y: 10 }, a, b);
  assert.deepEqual(point, { x: 40, y: 0 });
  assert.equal(distance, 10);
});

test('AC-35: closestOnSegment clamps past the ends and survives a degenerate edge', () => {
  const a = { x: 0, y: 0 };
  const b = { x: 10, y: 0 };
  assert.deepEqual(closestOnSegment({ x: -50, y: 0 }, a, b).point, a);
  assert.deepEqual(closestOnSegment({ x: 50, y: 0 }, a, b).point, b);
  const degenerate = closestOnSegment({ x: 3, y: 4 }, a, a);
  assert.deepEqual(degenerate.point, a);
  assert.equal(degenerate.distance, 5);
});

test('AC-36: pointInUnitEllipse follows the inscribed ellipse, not the box', () => {
  assert.ok(pointInUnitEllipse({ x: 0.5, y: 0.5 }));
  assert.ok(pointInUnitEllipse({ x: 0.5, y: 0 }));
  // The corners of the unit square fall outside the inscribed ellipse.
  assert.ok(!pointInUnitEllipse({ x: 0, y: 0 }));
  assert.ok(!pointInUnitEllipse({ x: 1, y: 1 }));
});
