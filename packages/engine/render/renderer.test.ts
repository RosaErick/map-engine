import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uvTransform, uvMatrix, isQuarterTurned, frameAspectOf, toColumnMajor } from '../model/surface-math.ts';
import { emptyProject, newSurface, type Surface } from '../model/project.ts';
import type { TextureSource } from '../sources/types.ts';

function surfaceOfSize(w: number, h: number): Surface {
  const s = newSurface(emptyProject());
  s.frame = [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }];
  return s;
}

function fakeSource(w: number, h: number): TextureSource {
  return {
    size: [w, h], isDirty: false, status: 'ready', animated: false,
    getTexture: () => null, update: () => {}, release: () => {}, dispose: () => {},
  };
}

test('AC-6: frame aspect of a rectangle', () => {
  assert.equal(frameAspectOf(surfaceOfSize(1600, 900)), 1600 / 900);
});

test('AC-6: stretch samples the whole crop window', () => {
  const s = surfaceOfSize(100, 100);
  assert.deepEqual(uvTransform(s, fakeSource(1920, 1080)), [1, 1, 0, 0]);
});

test('AC-6: cover crops the sides of a wide source, centred', () => {
  const s = surfaceOfSize(100, 100);
  s.fit = 'cover';
  const [sx, sy, ox, oy] = uvTransform(s, fakeSource(200, 100));
  assert.ok(Math.abs(sx - 0.5) < 1e-12, `sx=${sx}`);
  assert.equal(sy, 1);
  assert.ok(Math.abs(ox - 0.25) < 1e-12, `ox=${ox}`);
  assert.equal(oy, 0);
});

test('AC-6: contain letterboxes a wide source vertically', () => {
  const s = surfaceOfSize(100, 100);
  s.fit = 'contain';
  const [sx, sy, ox, oy] = uvTransform(s, fakeSource(200, 100));
  assert.equal(sx, 1);
  assert.ok(Math.abs(sy - 2) < 1e-12, `sy=${sy}`);
  assert.equal(ox, 0);
  assert.ok(Math.abs(oy + 0.5) < 1e-12, `oy=${oy}`); // window starts above the image
});

test('AC-6: cover and contain swap axes for a tall source', () => {
  const s = surfaceOfSize(100, 100);
  s.fit = 'cover';
  const cover = uvTransform(s, fakeSource(100, 200));
  assert.ok(Math.abs(cover[1] - 0.5) < 1e-12);
  s.fit = 'contain';
  const contain = uvTransform(s, fakeSource(100, 200));
  assert.ok(Math.abs(contain[0] - 2) < 1e-12);
});

test('AC-6: crop is respected under stretch and stays centred under cover', () => {
  const s = surfaceOfSize(100, 100);
  s.crop = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 };
  assert.deepEqual(uvTransform(s, fakeSource(100, 100)), [0.5, 0.5, 0.25, 0.25]);
  s.fit = 'cover';
  const [sx, , ox] = uvTransform(s, fakeSource(200, 100));
  assert.ok(Math.abs(sx - 0.25) < 1e-12, `sx=${sx}`);
  assert.ok(Math.abs(ox - 0.375) < 1e-12, `ox=${ox}`);
});

test('AC-20: the homography reaches the shader in column-major order', () => {
  assert.deepEqual(
    [...toColumnMajor([1, 2, 3, 4, 5, 6, 7, 8, 9])],
    [1, 4, 7, 2, 5, 8, 3, 6, 9],
  );
});

/** Applies the uv matrix to a frame-space point, the same way the shader does. */
function sample(surface: Surface, source: TextureSource | null, u: number, v: number): [number, number] {
  const m = uvMatrix(surface, source);
  // Column-major: m[col*3 + row].
  return [m[0]! * u + m[3]! * v + m[6]!, m[1]! * u + m[4]! * v + m[7]!];
}

test('AC-28: without rotation the uv matrix reproduces the plain fit transform', () => {
  const s = surfaceOfSize(100, 100);
  const src = fakeSource(100, 100);
  const [x, y] = sample(s, src, 0.25, 0.75);
  assert.ok(Math.abs(x - 0.25) < 1e-12 && Math.abs(y - 0.75) < 1e-12, `${x},${y}`);
});

test('AC-28: rotation spins the content about the centre of the frame', () => {
  const s = surfaceOfSize(100, 100);
  const src = fakeSource(100, 100);
  s.rotation = 90;
  // The centre is the fixed point of the rotation.
  const [cx, cy] = sample(s, src, 0.5, 0.5);
  assert.ok(Math.abs(cx - 0.5) < 1e-12 && Math.abs(cy - 0.5) < 1e-12, `centro ${cx},${cy}`);
  // Rotating the content 90° clockwise means the top-left of the frame now
  // samples the bottom-left of the source.
  const [x, y] = sample(s, src, 0, 0);
  assert.ok(Math.abs(x - 0) < 1e-9 && Math.abs(y - 1) < 1e-9, `canto ${x},${y}`);
});

test('AC-28: a full turn returns every sample to where it started', () => {
  const s = surfaceOfSize(160, 90);
  const src = fakeSource(1920, 1080);
  s.fit = 'cover';
  const before = sample(s, src, 0.3, 0.8);
  s.rotation = 360;
  const after = sample(s, src, 0.3, 0.8);
  assert.ok(Math.abs(before[0] - after[0]) < 1e-9 && Math.abs(before[1] - after[1]) < 1e-9);
});

test('AC-28: a quarter turn swaps the aspect used by cover', () => {
  const s = surfaceOfSize(100, 100);
  const wide = fakeSource(200, 100);
  s.fit = 'cover';
  // Upright: a wide source on a square frame gets its sides cropped.
  assert.ok(Math.abs(uvTransform(s, wide)[0] - 0.5) < 1e-12);
  // Turned on its side it is effectively tall, so the crop moves to the vertical.
  s.rotation = 90;
  const [sx, sy] = uvTransform(s, wide);
  assert.equal(sx, 1);
  assert.ok(Math.abs(sy - 0.5) < 1e-12, `sy=${sy}`);
});

test('AC-28: only quarter turns swap the aspect', () => {
  assert.equal(isQuarterTurned(0), false);
  assert.equal(isQuarterTurned(90), true);
  assert.equal(isQuarterTurned(180), false);
  assert.equal(isQuarterTurned(270), true);
  assert.equal(isQuarterTurned(30), false);
  assert.equal(isQuarterTurned(-90), true);
});
