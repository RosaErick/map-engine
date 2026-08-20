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

  const source = readFileSync(file, 'utf8');

  // A .svelte file holds copy in two places: the markup, and the script that
  // builds toasts and default names. Skipping the script is how Portuguese in
  // `flash('...')` slipped past the first version of this check.
  if (isSvelte) {
    for (const block of source.matchAll(/<script[\s\S]*?<\/script>/g)) {
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
    source.split('\n').forEach((line, i) => {
      if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) return;
      for (const m of line.matchAll(/'([^']*)'|"([^"]*)"/g)) {
        const value = m[1] ?? m[2] ?? '';
        if (ACCENTED.test(value)) report(file, i + 1, 'texto em código', value);
      }
    });
    continue;
  }

  // Markup only: script and style hold logic and selectors, not copy.
  let markup = source
    .replace(/<script[\s\S]*?<\/script>/g, blank)
    .replace(/<style[\s\S]*?<\/style>/g, blank);

  // Svelte expressions are translated content by definition; blank them out so
  // only literal text is left behind.
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

if (findings.length === 0) {
  console.log('ok  nenhuma string fixa no editor');
  process.exit(0);
}

console.log(`${findings.length} string(s) fora do catálogo:\n`);
for (const f of findings) {
  console.log(`  ${f.file}:${f.line}  [${f.kind}]  ${f.snippet}`);
}
process.exit(1);
