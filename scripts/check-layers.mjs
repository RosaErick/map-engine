/**
 * Reprova um `import` que aponta na direção errada.
 *
 * Uma estrutura de pastas sem guarda volta ao estado anterior em poucas
 * semanas, um import de cada vez — e o custo de descobrir isso é ter que ler o
 * grafo inteiro de novo. Aqui a regra é executável, e roda no `npm run verify`
 * junto com os testes.
 *
 * As regras estão escritas abaixo, cada uma com o motivo pelo qual existe.
 * Mudar uma delas é uma decisão, não um conserto: se a direção precisa mudar,
 * mude a regra aqui, de propósito, e o `why` junto.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = join(import.meta.dirname, '..');

/** Cada regra: quem, o que não pode importar, e por quê. */
const RULES = [
  {
    from: 'packages/engine/math',
    forbid: ['model/', 'render/', 'sources/', 'engine.ts', 'index.ts'],
    why: 'math/ é a camada de baixo: funções puras que não sabem o que é um projeto',
  },
  {
    from: 'packages/engine/model',
    forbid: ['render/', 'engine.ts', 'index.ts'],
    why: 'o domínio não conhece WebGL — é o que deixa `Store` testável sem navegador',
  },
  {
    from: 'packages/editor/ui',
    forbid: ['state.svelte', 'panels/', 'stage/', 'pages/', 'platform/'],
    why: 'ui/ são primitivas sem domínio: se um arquivo aqui souber o que é uma superfície, está na pasta errada',
  },
  {
    from: 'packages/engine',
    forbid: ['../editor/', '../output/'],
    why: 'a engine é uma biblioteca: ela não conhece o aplicativo que a usa',
  },
];

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (/\.(ts|svelte)$/.test(entry)) yield full;
  }
}

const problems = [];

for (const rule of RULES) {
  const base = join(root, rule.from);
  for (const file of walk(base)) {
    // Uma regra sobre uma pasta não vale para as subpastas que têm regra própria.
    const deeper = RULES.some((other) => other !== rule
      && other.from.startsWith(`${rule.from}/`)
      && file.startsWith(join(root, other.from) + sep));
    if (deeper) continue;

    const source = readFileSync(file, 'utf8');
    for (const [, spec] of source.matchAll(/from '(\.[^']*)'/g)) {
      const hit = rule.forbid.find((bad) => spec.includes(bad));
      if (hit) {
        problems.push({ file: relative(root, file), spec, why: rule.why });
      }
    }
  }
}

if (problems.length) {
  console.error('\nimport na direção errada:\n');
  for (const p of problems) {
    console.error(`  ${p.file}\n    importa ${p.spec}\n    ${p.why}\n`);
  }
  process.exit(1);
}
console.log('ok  as camadas apontam para baixo');
