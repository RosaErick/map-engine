import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store, visibleSurfaces, patternFor } from './store.ts';
import { emptyProject } from './project.ts';
import { surfaceOrder } from './surface-math.ts';

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
  const order = surfaceOrder(store.project);
  const top = surfaces.find((s) => s.id === b.id)!;
  const bottom = surfaces.find((s) => s.id === a.id)!;
  assert.equal(order.get(top), 1);
  assert.equal(order.get(bottom), 2);
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

test('AC-37: crop is clamped to a window that samples something', () => {
  const store = new Store(emptyProject());
  const s = store.addSurface();
  store.setCrop(s.id, { x: 0.25, w: 0.5 });
  assert.deepEqual(store.project.surfaces[0]!.crop, { x: 0.25, y: 0, w: 0.5, h: 1 });
  store.setCrop(s.id, { w: 0, h: -3 });
  const { w, h } = store.project.surfaces[0]!.crop;
  assert.ok(w > 0 && h > 0, `janela vazia: ${w}x${h}`);
});

test('AC-38: a polygon vertex moves, and a locked surface refuses', () => {
  const store = new Store(emptyProject());
  const s = store.addSurface();
  store.setSurfaceShape(s.id, {
    kind: 'polygon',
    points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.5, y: 1 }],
  });
  store.setPolygonPoint(s.id, 2, { x: 0.8, y: 0.9 });
  const moved = store.project.surfaces[0]!.shape;
  assert.equal(moved.kind, 'polygon');
  assert.deepEqual(moved.kind === 'polygon' ? moved.points[2] : null, { x: 0.8, y: 0.9 });

  store.toggleLock(s.id);
  store.setPolygonPoint(s.id, 2, { x: 0.1, y: 0.1 });
  const after = store.project.surfaces[0]!.shape;
  assert.deepEqual(after.kind === 'polygon' ? after.points[2] : null, { x: 0.8, y: 0.9 });
});

test('AC-40: the generic patch enforces the same invariants as the named setters', () => {
  const store = new Store(emptyProject());
  const s = store.addSurface();

  // Values that no named setter would ever accept, through the generic door.
  store.patchSurface(s.id, {
    opacity: 5,
    rotation: 450,
    crop: { x: -1, y: 2, w: 0, h: 9 },
    fit: 'diagonal' as never,
    blend: 'glow' as never,
    name: '   ',
    z: Number.NaN,
  });

  const after = store.project.surfaces[0]!;
  assert.equal(after.opacity, 1, 'opacity clamped');
  assert.equal(after.rotation, 90, 'rotation normalised');
  assert.ok(after.crop.w > 0 && after.crop.h > 0, 'crop samples something');
  assert.ok(after.crop.x >= 0 && after.crop.y <= 1, 'crop inside the source');
  assert.equal(after.fit, 'stretch', 'unknown fit rejected');
  assert.equal(after.blend, 'normal', 'unknown blend rejected');
  assert.notEqual(after.name.trim(), '', 'blank name rejected');
  assert.ok(Number.isFinite(after.z), 'z stays a number');
});

test('AC-41: duplicate ids in a loaded project are resolved, not carried', () => {
  const store = new Store(emptyProject());
  const frame = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
  store.load({
    version: 1,
    output: { width: 1920, height: 1080 },
    sources: [
      { id: 'dup', name: 'first', kind: 'color', rgb: [255, 0, 0] },
      { id: 'dup', name: 'second', kind: 'color', rgb: [0, 255, 0] },
    ],
    surfaces: [
      { id: 'same', name: 'a', frame, sourceId: 'dup' },
      { id: 'same', name: 'b', frame },
    ],
  });

  // One source survives, and it is the one the surfaces already referenced.
  assert.equal(store.project.sources.length, 1);
  assert.equal(store.project.sources[0]!.name, 'first');

  // Both surfaces survive, with ids that address them separately.
  const ids = store.project.surfaces.map((s) => s.id);
  assert.equal(ids.length, 2);
  assert.notEqual(ids[0], ids[1]);

  // The clash used to make removal delete both.
  store.removeSurface(ids[0]!);
  assert.equal(store.project.surfaces.length, 1);
  assert.equal(store.project.surfaces[0]!.name, 'b');
});
