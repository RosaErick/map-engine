import type { TestPattern } from '../engine/index.ts';

/** Os oito padrões, com nome em português. Uma lista só, usada pela barra de
 *  trabalho (global) e pelo inspetor (por superfície). */
export const PATTERNS: { id: TestPattern; label: string }[] = [
  { id: 'none', label: 'sem padrão' },
  { id: 'grid', label: 'grade' },
  { id: 'number', label: 'número' },
  { id: 'crosshair', label: 'cruz' },
  { id: 'white', label: 'branco' },
  { id: 'black', label: 'preto' },
  { id: 'bars', label: 'barras de cor' },
  { id: 'sweep', label: 'varredura' },
];

export function patternLabel(id: TestPattern): string {
  return PATTERNS.find((p) => p.id === id)?.label ?? String(id);
}
