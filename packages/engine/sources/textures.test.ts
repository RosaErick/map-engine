import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ContextTextures } from './types.ts';

/** Enough of a WebGL2 context for the texture bookkeeping to run in node. */
function fakeGl(): WebGL2RenderingContext {
  let next = 1;
  const deleted: unknown[] = [];
  const gl = {
    TEXTURE_2D: 1, TEXTURE_WRAP_S: 2, TEXTURE_WRAP_T: 3,
    TEXTURE_MIN_FILTER: 4, TEXTURE_MAG_FILTER: 5, CLAMP_TO_EDGE: 6, LINEAR: 7,
    createTexture: () => ({ id: next++ }),
    bindTexture: () => {},
    texParameteri: () => {},
    deleteTexture: (t: unknown) => { deleted.push(t); },
    deleted,
  };
  return gl as unknown as WebGL2RenderingContext;
}

test('AC-29: each GL context gets its own texture for the same source', () => {
  const cache = new ContextTextures();
  const a = fakeGl();
  const b = fakeGl();
  assert.notEqual(cache.texture(a), cache.texture(b));
  // Asking twice for the same context reuses it.
  assert.equal(cache.texture(a), cache.texture(a));
});

test('AC-29: uploading in one context does not mark the other up to date', () => {
  const cache = new ContextTextures();
  const editor = fakeGl();
  const output = fakeGl();
  cache.texture(editor);
  cache.texture(output);

  assert.ok(cache.isStale(editor) && cache.isStale(output));
  cache.markUploaded(editor);
  assert.equal(cache.isStale(editor), false);
  // This is the bug the per-context version exists to prevent: with a single
  // dirty flag, the output window would never see the frame.
  assert.equal(cache.isStale(output), true);

  cache.markUploaded(output);
  assert.equal(cache.anyStale, false);
});

test('AC-29: new content invalidates every context at once', () => {
  const cache = new ContextTextures();
  const a = fakeGl();
  const b = fakeGl();
  cache.texture(a); cache.texture(b);
  cache.markUploaded(a); cache.markUploaded(b);
  assert.equal(cache.anyStale, false);

  cache.invalidate();
  assert.ok(cache.isStale(a) && cache.isStale(b));
});

test('AC-29: releasing one context keeps the other drawing', () => {
  const cache = new ContextTextures();
  const editor = fakeGl();
  const output = fakeGl();
  const editorTex = cache.texture(editor);
  cache.texture(output);
  cache.markUploaded(editor);

  cache.release(output);
  assert.equal((output as unknown as { deleted: unknown[] }).deleted.length, 1);
  // The editor's texture survives, still uploaded.
  assert.equal(cache.texture(editor), editorTex);
  assert.equal(cache.isStale(editor), false);
});

test('AC-29: a source nobody has drawn yet counts as stale', () => {
  const cache = new ContextTextures();
  assert.equal(cache.anyStale, true);
});
