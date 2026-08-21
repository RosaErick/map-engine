import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  identityWarp, isIdentity, evaluateWarp, tessellate, resampleWarp, parseWarp, pointIndex, unwarp,
} from './warp.ts';

const near = (a: number, b: number, eps = 1e-9): boolean => Math.abs(a - b) < eps;

test('AC-44: an identity warp maps every frame coordinate to itself', () => {
  for (const interpolation of ['smooth', 'linear'] as const) {
    const warp = identityWarp(3, 2, interpolation);
    assert.equal(warp.points.length, 4 * 3, `${interpolation}: point count`);
    assert.ok(isIdentity(warp));
    for (let u = 0; u <= 1.0001; u += 0.125) {
      for (let v = 0; v <= 1.0001; v += 0.125) {
        const p = evaluateWarp(warp, u, v);
        assert.ok(near(p.x, Math.min(u, 1)) && near(p.y, Math.min(v, 1)),
          `${interpolation} (${u},${v}) -> ${p.x},${p.y}`);
      }
    }
  }
});

test('AC-44: a moved point stops the warp being an identity', () => {
  const warp = identityWarp(2, 2);
  warp.points[pointIndex(warp, 1, 1)] = { x: 0.7, y: 0.3 };
  assert.equal(isIdentity(warp), false);
});

test('AC-49: control points are interpolated, and corners are exact', () => {
  const warp = identityWarp(2, 2, 'linear');
  warp.points[pointIndex(warp, 1, 1)] = { x: 0.8, y: 0.2 };

  // The grid corner lands exactly on its control point in both modes.
  const centre = evaluateWarp(warp, 0.5, 0.5);
  assert.ok(near(centre.x, 0.8) && near(centre.y, 0.2), `centro: ${centre.x},${centre.y}`);

  // The frame's own corners never move: they are the frame, not the warp.
  for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]] as const) {
    const p = evaluateWarp(warp, u, v);
    assert.ok(near(p.x, u) && near(p.y, v), `canto ${u},${v} -> ${p.x},${p.y}`);
  }
});

test('AC-50: smooth and linear disagree between control points, agree on them', () => {
  const build = (mode: 'smooth' | 'linear') => {
    const w = identityWarp(2, 2, mode);
    w.points[pointIndex(w, 1, 1)] = { x: 0.5, y: 0.15 };
    return w;
  };
  const smooth = build('smooth');
  const linear = build('linear');

  // On a control point both modes must return that point.
  const s = evaluateWarp(smooth, 0.5, 0.5);
  const l = evaluateWarp(linear, 0.5, 0.5);
  assert.ok(near(s.y, 0.15) && near(l.y, 0.15));

  // Between control points the smooth surface leaves the straight line.
  const sMid = evaluateWarp(smooth, 0.5, 0.25);
  const lMid = evaluateWarp(linear, 0.5, 0.25);
  assert.ok(Math.abs(sMid.y - lMid.y) > 1e-3, `${sMid.y} vs ${lMid.y}`);
});

test('AC-49: tessellation covers the frame once, and linear never subdivides', () => {
  const smooth = tessellate(identityWarp(2, 2, 'smooth'), 4);
  assert.equal(smooth.length, (2 * 4) * (2 * 4), 'smooth subdivides each cell');

  const linear = tessellate(identityWarp(2, 2, 'linear'), 4);
  assert.equal(linear.length, 4, 'linear draws one quad per control cell');

  // Texture coordinates tile 0..1 with no gap and no overlap.
  const first = linear[0]!;
  const last = linear[linear.length - 1]!;
  assert.deepEqual(first.texture[0], { x: 0, y: 0 });
  assert.deepEqual(last.texture[2], { x: 1, y: 1 });
});

test('AC-47: resampling keeps the surface it already had', () => {
  const warp = identityWarp(2, 2, 'smooth');
  warp.points[pointIndex(warp, 1, 1)] = { x: 0.5, y: 0.2 };

  const finer = resampleWarp(warp, 4, 4);
  assert.equal(finer.points.length, 5 * 5);
  assert.equal(finer.cols, 4);

  // Sampling the resampled surface reproduces the original one closely: the
  // point of resampling is that raising the subdivision costs no work.
  for (const [u, v] of [[0.25, 0.25], [0.5, 0.5], [0.75, 0.4], [1, 1]] as const) {
    const before = evaluateWarp(warp, u, v);
    const after = evaluateWarp(finer, u, v);
    assert.ok(Math.abs(before.x - after.x) < 0.02 && Math.abs(before.y - after.y) < 0.02,
      `(${u},${v}): ${before.y} vs ${after.y}`);
  }
});

test('AC-48: resampling an identity grid stays an identity grid', () => {
  assert.ok(isIdentity(resampleWarp(identityWarp(2, 2), 5, 3)));
});

test('AC-51: a broken warp is repaired point by point, never dropped whole', () => {
  const parsed = parseWarp({
    cols: 2, rows: 2, interpolation: 'linear',
    points: [
      { x: 0, y: 0 }, { x: 0.5, y: 0 }, { x: 1, y: 0 },
      { x: 0, y: 0.5 }, { x: 0.9, y: 0.4 }, 'lixo',
      { x: 0, y: 1 }, { x: NaN, y: 1 },
      // faltando o último ponto de propósito
    ],
  });
  assert.ok(parsed);
  assert.equal(parsed.points.length, 9, 'grade completa');
  assert.deepEqual(parsed.points[4], { x: 0.9, y: 0.4 }, 'ponto válido preservado');
  assert.deepEqual(parsed.points[5], { x: 1, y: 0.5 }, 'lixo cai na identidade');
  assert.deepEqual(parsed.points[7], { x: 0.5, y: 1 }, 'NaN cai na identidade');
  assert.deepEqual(parsed.points[8], { x: 1, y: 1 }, 'ponto ausente cai na identidade');
});

test('AC-51: nonsense grids and coordinates are contained', () => {
  assert.equal(parseWarp(null), null);
  assert.equal(parseWarp('malha'), null);

  const huge = parseWarp({ cols: 999, rows: -4, points: [{ x: 1e9, y: -1e9 }] });
  assert.ok(huge);
  assert.ok(huge.cols <= 16 && huge.rows >= 1, `grade contida: ${huge.cols}x${huge.rows}`);
  assert.ok(Math.abs(huge.points[0]!.x) <= 4 && Math.abs(huge.points[0]!.y) <= 4);
  assert.ok(huge.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
});

test('AC-53: unwarp is the inverse of evaluate, inside the surface', () => {
  const warp = identityWarp(2, 2, 'smooth');
  warp.points[pointIndex(warp, 1, 1)] = { x: 0.62, y: 0.3 };

  for (const [u, v] of [[0.2, 0.2], [0.5, 0.5], [0.75, 0.35], [0.9, 0.8]] as const) {
    const deformed = evaluateWarp(warp, u, v);
    const back = unwarp(warp, deformed);
    assert.ok(back, `(${u},${v}) caiu fora`);
    assert.ok(Math.abs(back.x - u) < 0.02 && Math.abs(back.y - v) < 0.02,
      `(${u},${v}) -> (${back.x.toFixed(3)},${back.y.toFixed(3)})`);
  }
});

test('AC-53: a point outside the deformed surface is a miss, not a guess', () => {
  const warp = identityWarp(2, 2, 'linear');
  assert.equal(unwarp(warp, { x: -0.5, y: 0.5 }), null);
  assert.equal(unwarp(warp, { x: 1.4, y: 0.5 }), null);
});
