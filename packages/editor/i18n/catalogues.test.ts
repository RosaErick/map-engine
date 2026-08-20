import { test } from 'node:test';
import assert from 'node:assert/strict';
import { en } from './en.ts';
import { pt } from './pt.ts';
import { es } from './es.ts';

const TRANSLATIONS = [['pt', pt], ['es', es]] as const;

/** `{name}` placeholders and inline tags, in a stable order. */
function tokens(value: string): string[] {
  return [...value.matchAll(/\{(\w+)\}|<(\/?\w+)>/g)].map((m) => m[0]).sort();
}

for (const [name, catalogue] of TRANSLATIONS) {
  test(`AC-33: ${name} carries exactly the keys english does`, () => {
    // The types already guarantee this; the test states it so the criterion has
    // a proof that runs, and so a future loosening of the types is caught.
    assert.deepEqual(Object.keys(catalogue).sort(), Object.keys(en).sort());
  });

  test(`AC-33: ${name} keeps every placeholder and every tag`, () => {
    for (const [key, source] of Object.entries(en)) {
      const translated = catalogue[key as keyof typeof en];
      assert.deepEqual(
        tokens(translated),
        tokens(source),
        `${key}: a translation that drops {name} renders a sentence with a hole in it`,
      );
    }
  });

  test(`AC-33: ${name} is actually translated, not copied`, () => {
    // Some entries are legitimately identical across languages — product name,
    // keyboard shortcuts, technical mode names. Everything else moving would
    // mean the catalogue was duplicated rather than translated.
    const identical = Object.entries(en).filter(
      ([key, value]) => catalogue[key as keyof typeof en] === value,
    );
    assert.ok(
      identical.length < Object.keys(en).length * 0.2,
      `${identical.length} entries identical to english: ${identical.slice(0, 5).map(([k]) => k).join(', ')}`,
    );
  });
}
