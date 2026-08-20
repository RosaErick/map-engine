import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guideEn } from './en.ts';
import { guidePt } from './pt.ts';
import { guideEs } from './es.ts';
import type { Guide } from './types.ts';

const TRANSLATIONS: [name: string, guide: Guide][] = [['pt', guidePt], ['es', guideEs]];

/** Every block reduced to its shape, ignoring the words. */
function shape(guide: Guide): string[] {
  return guide.flatMap((section) =>
    section.blocks.map((block) => {
      const size =
        block.kind === 'steps' || block.kind === 'list' ? block.items.length
        : block.kind === 'keys' ? block.rows.length
        : 0;
      return `${section.id}/${block.kind}${size ? `:${size}` : ''}`;
    }),
  );
}

for (const [name, guide] of TRANSLATIONS) {
  test(`AC-34: the ${name} guide has the same sections as english, in the same order`, () => {
    assert.deepEqual(guide.map((s) => s.id), guideEn.map((s) => s.id));
  });

  test(`AC-34: the ${name} guide has the same blocks, with the same item counts`, () => {
    // A translated guide that quietly drops a step or a shortcut row is worse
    // than one that is obviously missing: nobody notices until it is needed.
    assert.deepEqual(shape(guide), shape(guideEn));
  });

  test(`AC-34: the ${name} guide translates every heading and keeps code untouched`, () => {
    guide.forEach((section, i) => {
      const english = guideEn[i]!;
      if (section.id !== 'keyboard') {
        assert.notEqual(section.title, english.title, `section ${section.id} title untranslated`);
      }
      section.blocks.forEach((block, j) => {
        const source = english.blocks[j]!;
        if (block.kind === 'code' && source.kind === 'code') {
          assert.equal(block.code, source.code, 'code samples must be identical');
        }
      });
    });
  });
}

test('AC-34: no guide section is empty', () => {
  for (const [name, guide] of [['en', guideEn] as const, ...TRANSLATIONS]) {
    for (const section of guide) {
      assert.ok(section.title.trim().length > 0, `${name}: empty title`);
      assert.ok(section.blocks.length > 0, `${name}: section ${section.id} has no blocks`);
    }
  }
});
