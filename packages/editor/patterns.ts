import type { TestPattern } from '../engine/index.ts';

/**
 * A ordem em que os padrões aparecem nos seletores.
 *
 * Só os ids: o rótulo de cada um vive no catálogo, sob `pattern.<id>`, para não
 * existir em dois lugares. `TestPattern` é união de literais, então acrescentar
 * um padrão na engine sem traduzi-lo vira erro de compilação.
 */
export const PATTERNS: TestPattern[] = [
  'none', 'grid', 'number', 'crosshair', 'white', 'black', 'bars', 'sweep',
];
