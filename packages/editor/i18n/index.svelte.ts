import { en, type MessageKey, type Messages } from './en.ts';
import { es } from './es.ts';
import { pt } from './pt.ts';

export type Locale = 'en' | 'pt' | 'es';
export type { MessageKey };

export const LOCALES: { id: Locale; label: string; short: string }[] = [
  { id: 'pt', label: 'Português', short: 'PT' },
  { id: 'es', label: 'Español', short: 'ES' },
  { id: 'en', label: 'English', short: 'EN' },
];

const CATALOGUES: Record<Locale, Messages> = { en, es, pt };
const KEY = 'map-engine:locale';

function isLocale(value: string | null | undefined): value is Locale {
  return LOCALES.some((l) => l.id === value);
}

/**
 * Locale picked from the browser, overridable by the user and remembered.
 *
 * `navigator.languages` is ordered by preference, so the first entry that maps
 * to a locale we ship wins, matching on the base tag only. English is the
 * fallback because it is the base catalogue: an untranslated string is still a
 * readable string.
 */
function detect(): Locale {
  try {
    const saved = localStorage.getItem(KEY);
    if (isLocale(saved)) return saved;
  } catch { /* private mode without storage */ }

  for (const tag of navigator.languages ?? [navigator.language]) {
    // `pt-BR`, `pt-PT` and `pt` all land on Portuguese; same for `es-419`.
    const base = tag.toLowerCase().split('-')[0];
    if (isLocale(base)) return base;
  }
  return 'en';
}

export const i18n = $state({ locale: detect() });

export function setLocale(next: Locale): void {
  i18n.locale = next;
  document.documentElement.lang = next;
  try { localStorage.setItem(KEY, next); } catch { /* nothing to do */ }
}

/** Called once on mount so `<html lang>` matches what is on screen. */
export function initLocale(): void {
  setLocale(i18n.locale);
}

const pluralRules = new Map<Locale, Intl.PluralRules>();
function plural(locale: Locale, count: number): Intl.LDMLPluralRule {
  let rules = pluralRules.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(locale);
    pluralRules.set(locale, rules);
  }
  return rules.select(count);
}

export type Params = Record<string, string | number>;

/**
 * Translates a key, interpolating `{name}` placeholders.
 *
 * Passing `count` also selects a plural form: `key_one` when the locale's rules
 * ask for the singular, the base key otherwise. Using the base key as the
 * catch-all keeps the common case a single entry, and `Intl.PluralRules` means
 * a locale with more forms than English only needs more keys, not new code.
 *
 * Reading `i18n.locale` here is what makes every `t()` call in a component
 * re-run when the language changes — no store subscription, no adapter.
 */
export function t(key: MessageKey, params?: Params): string {
  const locale = i18n.locale;
  const catalogue = CATALOGUES[locale];

  let template: string | undefined;
  if (params && typeof params['count'] === 'number') {
    const form = plural(locale, params['count']);
    if (form === 'one') template = catalogue[`${key}_one` as MessageKey];
  }
  template ??= catalogue[key] ?? en[key] ?? key;

  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}

/** Same as `t`, for strings that carry inline markup and go through `{@html}`.
 *  Only catalogue text reaches it — never user input. */
export const tHtml = t;
