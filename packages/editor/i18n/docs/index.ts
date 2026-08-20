import type { Locale } from '../index.svelte.ts';
import type { Guide } from './types.ts';
import { guideEn } from './en.ts';
import { guideEs } from './es.ts';
import { guidePt } from './pt.ts';

export type { Guide, Section, Block } from './types.ts';

const GUIDES: Record<Locale, Guide> = { en: guideEn, es: guideEs, pt: guidePt };

/** English is the fallback for the same reason it is the base catalogue: an
 *  untranslated guide still teaches. */
export function guideFor(locale: Locale): Guide {
  return GUIDES[locale] ?? guideEn;
}
