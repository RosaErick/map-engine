import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uvTransform, frameAspectOf, toColumnMajor } from './renderer.ts';
import { emptyProject, newSurface, type Surface } from './project.ts';
import type { TextureSource } from './sources/types.ts';

function surfaceOfSize(w: number, h: number): Surface {
  const s = newSurface(emptyProject());
  s.frame = [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }];
  return s;
}

function fakeSource(w: number, h: number): TextureSource {
  return {
    size: [w, h], isDirty: false, status: 'ready', animated: false,
    getTexture: () => null, update: () => {}, dispose: () => {},
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
