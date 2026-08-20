/**
 * Fails when user-facing copy is hardcoded in the editor instead of coming from
 * the message catalogue.
 *
 * This is the objective end of "the editor is translated": while this passes,
 * every string on screen has an entry in `en.ts` and `pt.ts`, and the type
 * checker already guarantees neither catalogue is missing a key.
 *
 *   node scripts/check-i18n.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const editor = join(root, 'packages/editor');

/** Attributes whose value is read by a person, not by the browser. */
const COPY_ATTRS = /\s(?:title|aria-label|placeholder|alt)="([^"{}]*[\p{L}]{2,}[^"{}]*)"/gu;
const ACCENTED = /[áàâãäéèêëíìîïóòôõöúùûüçñ]/i;
/** Nomes de tecla do DOM — comparação de evento, não texto de interface. */
const DOM_KEYS = new Set([
  'Enter', 'Escape', 'Shift', 'Control', 'Alt', 'Meta', 'Tab', 'Backspace', 'Delete',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown',
]);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

/** Blanks a region while keeping newlines, so reported line numbers stay true. */
/**
 * Apaga comentários de bloco, preservando as quebras de linha para o número da
 * linha no relatório continuar certo.
 *
 * A varredura por literal olha linha a linha e pulava só quem começa com `//`
 * ou `*` — a linha de abertura de um bloco JSDoc não começa com nenhum dos
 * dois, então uma palavra entre aspas dentro dela virava "texto em código".
 * Mesmo defeito do apóstrofo em comentário de marcação, um nível acima.
 */
function blankBlockComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, blank);
}

function blank(text) {
  return text.replace(/[^\n]/g, ' ');
}

const findings = [];
function report(file, line, kind, snippet) {
  findings.push({ file: relative(root, file), line, kind, snippet: snippet.trim().slice(0, 80) });
}

for (const file of walk(editor)) {
  const isSvelte = file.endsWith('.svelte');
  const isTs = file.endsWith('.ts');
  if (!isSvelte && !isTs) continue;
  if (file.includes(`${join('editor', 'i18n')}`)) continue;
  // Fixtures are not interface copy: a test may legitimately name a file
  // "vídeo final.mov" to prove the sanitiser handles it.
  if (file.endsWith('.test.ts')) continue;

  const source = readFileSync(file, 'utf8');

  // A .svelte file holds copy in two places: the markup, and the script that
  // builds toasts and default names. Skipping the script is how Portuguese in
  // `flash('...')` slipped past the first version of this check.
  if (isSvelte) {
    for (const block of blankBlockComments(source).matchAll(/<script[\s\S]*?<\/script>/g)) {
      const startLine = source.slice(0, block.index).split('\n').length;
      block[0].split('\n').forEach((line, i) => {
        if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) return;
        for (const m of line.matchAll(/'([^']*)'|"([^"]*)"/g)) {
          const value = m[1] ?? m[2] ?? '';
          if (ACCENTED.test(value)) report(file, startLine + i, 'texto em código', value);
        }
      });
    }
  }

  if (isTs) {
    // In plain modules only accented literals are unambiguous copy; an English
    // word could just as well be an id, a class name or a MIME type.
    blankBlockComments(source).split('\n').forEach((line, i) => {
      if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) return;
      for (const m of line.matchAll(/'([^']*)'|"([^"]*)"/g)) {
        const value = m[1] ?? m[2] ?? '';
        if (ACCENTED.test(value)) report(file, i + 1, 'texto em código', value);
      }
    });
    continue;
  }

  // Markup only: script and style hold logic and selectors, not copy. Comments
  // go too — an apostrophe inside one ("the corner's handle") opens a quote that
  // swallows the next real string, and the report lands on the wrong line.
  let markup = source
    .replace(/<script[\s\S]*?<\/script>/g, blank)
    .replace(/<style[\s\S]*?<\/style>/g, blank)
    .replace(/<!--[\s\S]*?-->/g, blank);

  // Svelte expressions usually hold translated content — but not always: a
  // template literal inside an attribute expression is copy too, and blanking
  // the whole expression is how `aria-label={`Canto ${i}`}` hid here for weeks.
  // Scanning the raw markup avoids the brace-matching problem entirely: an
  // expression containing `${...}` has nested braces and never matched.
  for (const m of markup.matchAll(/`([^`]*)`|'([^']*)'|"([^"]*)"/g)) {
    const value = m[1] ?? m[2] ?? m[3] ?? '';
    const words = value.replace(/\$\{[^}]*\}/g, ' ').trim();
    if (DOM_KEYS.has(words)) continue;
    // Inside an expression almost everything is a key, a class name or an enum
    // value — all lowercase. Copy is what reads like a sentence: it starts a
    // word with a capital, or it carries an accent. Narrow on purpose: a
    // heuristic that cries wolf gets switched off.
    if (/\b\p{Lu}\p{Ll}{2,}/u.test(words) || ACCENTED.test(words)) {
      const line = markup.slice(0, m.index).split('\n').length;
      report(file, line, 'texto em expressão', words);
    }
  }

  // Now blank them, so only literal text is left behind.
  let previous;
  do {
    previous = markup;
    markup = markup.replace(/\{[^{}]*\}/g, blank);
  } while (markup !== previous);

  markup.split('\n').forEach((line, i) => {
    for (const m of line.matchAll(COPY_ATTRS)) {
      report(file, i + 1, 'atributo', m[1]);
    }
  });

  // Text nodes: whatever sits between a closing and an opening angle bracket.
  const withoutTags = markup.replace(/<[^<>]*>/g, blank);
  withoutTags.split('\n').forEach((line, i) => {
    const text = line.trim();
    if (!text) return;
    if (!/[\p{L}]{2,}/u.test(text)) return;
    report(file, i + 1, 'texto', text);
  });
}

// --- catalogue consistency -------------------------------------------------
//
// TypeScript guarantees every locale has every key. It cannot see inside the
// strings, and that is where the damage hides: a translation that drops `{name}`
// renders a sentence with a hole in it, and one that loses `<b>` breaks markup
// that goes through {@html}. Both are silent in production and loud on a wall.
const catalogues = readdirSync(join(editor, 'i18n'))
  .filter((f) => /^[a-z]{2}\.ts$/.test(f))
  .map((f) => ({ locale: f.slice(0, 2), path: join(editor, 'i18n', f) }));

function entries(path) {
  const map = new Map();
  for (const m of readFileSync(path, 'utf8').matchAll(/^  '([^']+)':\s*'((?:[^'\\]|\\.)*)',$/gm)) {
    map.set(m[1], m[2]);
  }
  return map;
}

const base = entries(join(editor, 'i18n', 'en.ts'));
const tokens = (value) => [...value.matchAll(/\{(\w+)\}|<(\/?\w+)>/g)].map((m) => m[0]).sort();

for (const { locale, path } of catalogues) {
  if (locale === 'en') continue;
  const other = entries(path);
  for (const [key, value] of base) {
    const translated = other.get(key);
    if (translated === undefined) {
      findings.push({ file: relative(root, path), line: 0, kind: 'chave ausente', snippet: key });
      continue;
    }
    const want = tokens(value).join(' ');
    const got = tokens(translated).join(' ');
    if (want !== got) {
      findings.push({
        file: relative(root, path),
        line: 0,
        kind: 'placeholder/marcação',
        snippet: `${key}: esperado [${want}] veio [${got}]`,
      });
    }
  }
  for (const key of other.keys()) {
    if (!base.has(key)) {
      findings.push({ file: relative(root, path), line: 0, kind: 'chave a mais', snippet: key });
    }
  }
}

if (findings.length === 0) {
  console.log('ok  nenhuma string fixa no editor');
  process.exit(0);
}

console.log(`${findings.length} string(s) fora do catálogo:\n`);
for (const f of findings) {
  console.log(`  ${f.file}:${f.line}  [${f.kind}]  ${f.snippet}`);
}
process.exit(1);
