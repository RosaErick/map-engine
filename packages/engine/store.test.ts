import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store, visibleSurfaces, patternFor } from './store.ts';
import { emptyProject } from './project.ts';
import { surfaceNumber } from './renderer.ts';

test('AC-7: undo restores the previous state and redo reapplies it', () => {
  const store = new Store(emptyProject());
  const s = store.addSurface();
  const x0 = store.project.surfaces[0]!.frame[0]!.x;
  store.setCorner(s.id, 0, { x: x0 + 50, y: 0 });
  store.endGesture();
  assert.equal(store.project.surfaces[0]!.frame[0]!.x, x0 + 50);
  store.undo();
  assert.equal(store.project.surfaces[0]!.frame[0]!.x, x0);
  store.redo();
  assert.equal(store.project.surfaces[0]!.frame[0]!.x, x0 + 50);
});

test('AC-8: a drag gesture collapses into one history entry', () => {
  const store = new Store(emptyProject());
  const s = store.addSurface();
  const before = store.project.surfaces[0]!.frame[0]!.x;
  for (let i = 1; i <= 20; i++) store.setCorner(s.id, 0, { x: before + i, y: 0 });
  store.endGesture();
  store.undo();
  assert.equal(store.project.surfaces[0]!.frame[0]!.x, before);
});

test('AC-9: a locked surface rejects every geometry edit', () => {
  const store = new Store(emptyProject());
  const s = store.addSurface();
  store.toggleLock(s.id);
  const before = structuredClone(store.project.surfaces[0]!.frame);
  store.setCorner(s.id, 0, { x: 999, y: 999 });
  store.moveSurface(s.id, 100, 100);
  store.nudgeCorner(s.id, 1, 1, 1);
  assert.deepEqual(store.project.surfaces[0]!.frame, before);
});

test('AC-10: subscribe fires immediately, on change, and stops after unsubscribe', () => {
  const store = new Store(emptyProject());
  let calls = 0;
  const off = store.subscribe(() => { calls++; });
  assert.equal(calls, 1);
  store.addSurface();
  assert.ok(calls > 1);
  const atUnsub = calls;
  off();
  store.addSurface();
  assert.equal(calls, atUnsub);
});

test('AC-11: solo overrides visibility and drawing follows z order', () => {
  const store = new Store(emptyProject());
  const a = store.addSurface();
  const b = store.addSurface();
  store.reorder(a.id, 5);
  store.reorder(b.id, 1);
  assert.deepEqual(visibleSurfaces(store.state).map((s) => s.id), [b.id, a.id]);
  store.toggleVisible(b.id);
  assert.deepEqual(visibleSurfaces(store.state).map((s) => s.id), [a.id]);
  store.toggleSolo(b.id);
  assert.deepEqual(visibleSurfaces(store.state).map((s) => s.id), [b.id]);
});

test('AC-12: removing a source clears the surfaces that referenced it', () => {
  const store = new Store(emptyProject());
  const s = store.addSurface();
  store.addSource({ id: 'c1', name: 'branco', kind: 'color', rgb: [255, 255, 255] });
  store.setSurfaceSource(s.id, 'c1');
  store.removeSource('c1');
  assert.equal(store.project.surfaces[0]!.sourceId, null);
});

test('AC-13: a project round trips through JSON, dropping dangling references', () => {
  const store = new Store(emptyProject());
  const s = store.addSurface();
  store.addSource({ id: 'c1', name: 'branco', kind: 'color', rgb: [255, 255, 255] });
  store.setSurfaceSource(s.id, 'c1');
  const json = store.toJSON();
  const store2 = new Store(emptyProject());
  store2.load(json);
  assert.deepEqual(store2.project, store.project);

  const broken = JSON.parse(json);
  broken.sources = [];
  store2.load(broken);
  assert.equal(store2.project.surfaces[0]!.sourceId, null);
});

test('AC-9: a locked surface rejects geometry through the generic patch too', () => {
  const store = new Store(emptyProject());
  const s = store.addSurface();
  store.toggleLock(s.id);
  const frame = structuredClone(store.project.surfaces[0]!.frame);
  // The external-control extension point calls these same methods.
  store.patchSurface(s.id, { frame: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }], name: 'novo' });
  assert.deepEqual(store.project.surfaces[0]!.frame, frame);
  assert.equal(store.project.surfaces[0]!.name, 'novo');
  // Unlocking must still be possible, or the lock is a trap.
  store.toggleLock(s.id);
  assert.equal(store.project.surfaces[0]!.locked, false);
});

test('AC-11: the projected surface number follows the editor list order', () => {
  const store = new Store(emptyProject());
  const a = store.addSurface();
  const b = store.addSurface();
  store.reorder(a.id, 1);
  store.reorder(b.id, 9);
  const surfaces = store.project.surfaces;
  const top = surfaces.find((s) => s.id === b.id)!;
  assert.equal(surfaceNumber(store.project, top), 1);
});

test('AC-32: a surface without an override follows the global test pattern', () => {
  const store = new Store(emptyProject());
  const a = store.addSurface();
  const b = store.addSurface();
  store.setTestPattern('grid');
  assert.equal(patternFor(store.state, a.id), 'grid');
  assert.equal(patternFor(store.state, b.id), 'grid');
});

test('AC-32: a per-surface pattern wins over the global one, in both directions', () => {
  const store = new Store(emptyProject());
  const a = store.addSurface();
  const b = store.addSurface();

  store.setTestPattern('grid');
  store.setSurfacePattern(a.id, 'number');
  assert.equal(patternFor(store.state, a.id), 'number');
  assert.equal(patternFor(store.state, b.id), 'grid');

  // An explicit 'none' clears the pattern on one surface while the rest keep it.
  store.setSurfacePattern(b.id, 'none');
  assert.equal(patternFor(store.state, b.id), 'none');

  // null hands control back to the global pattern.
  store.setSurfacePattern(a.id, null);
  assert.equal(patternFor(store.state, a.id), 'grid');
});

test('AC-32: removing a surface drops its pattern override and its solo', () => {
  const store = new Store(emptyProject());
  const a = store.addSurface();
  store.setSurfacePattern(a.id, 'bars');
  store.toggleSolo(a.id);
  store.removeSurface(a.id);
  assert.deepEqual(store.view.surfacePatterns, {});
  assert.equal(store.view.soloId, null);
});
