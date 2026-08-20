/**
 * Cor: conversões e o nome de um tom.
 *
 * Vive na engine porque é matemática pura e o editor não é o único que precisa
 * dela. O que **não** vive aqui é a palavra: `colorKey` devolve um código, e
 * quem tem o catálogo é que sabe se ele se chama "vermelho", "red" ou "rojo".
 */

export type Rgb = [number, number, number];

/** Os tons que a interface sabe nomear. Poucos de propósito: a lista existe
 *  para diferenciar fontes numa lista, não para descrever pintura. */
export type ColorKey =
  | 'white' | 'black' | 'grey'
  | 'red' | 'orange' | 'brown' | 'yellow' | 'green'
  | 'cyan' | 'blue' | 'violet' | 'magenta' | 'pink';

const clamp255 = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));

export function hexOf([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => clamp255(v).toString(16).padStart(2, '0')).join('')}`;
}

/** Aceita `#rgb`, `#rrggbb` e os mesmos sem `#`. Devolve `null` para o resto —
 *  campo de texto recebe o que o usuário digitar, inclusive metade de um hex. */
export function parseHex(input: string): Rgb | null {
  const hex = input.trim().replace(/^#/, '');
  if (!/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return null;
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as Rgb;
}

/** RGB 0-255 -> HSV com matiz em graus e saturação/valor em 0-1. */
export function rgbToHsv([r, g, b]: Rgb): [number, number, number] {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max === 0 ? 0 : d / max, max];
}

export function hsvToRgb([h, s, v]: [number, number, number]): Rgb {
  const c = v * s;
  const x = c * (1 - Math.abs((((h / 60) % 2) + 2) % 2 - 1));
  const m = v - c;
  const sector = Math.floor(((h % 360) + 360) % 360 / 60);
  const sectors: Rgb[] = [
    [c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x],
  ];
  const [r, g, b] = sectors[sector] ?? [0, 0, 0];
  return [clamp255((r + m) * 255), clamp255((g + m) * 255), clamp255((b + m) * 255)];
}

/** Faixas de matiz, em graus, na ordem em que são testadas. */
const HUES: [max: number, key: ColorKey][] = [
  [15, 'red'], [40, 'orange'], [65, 'yellow'], [165, 'green'],
  [195, 'cyan'], [255, 'blue'], [285, 'violet'], [330, 'magenta'], [360, 'red'],
];

/**
 * O tom mais próximo, como código.
 *
 * A ordem importa: preto e branco são decididos antes do matiz, porque um preto
 * quase puro ainda tem um matiz qualquer vindo do ruído do último bit, e
 * chamá-lo de "verde" seria pior do que não nomear.
 */
export function colorKey(rgb: Rgb): ColorKey {
  const [h, s, v] = rgbToHsv(rgb);
  if (v <= 0.09) return 'black';
  if (s <= 0.1) return v >= 0.92 ? 'white' : 'grey';
  // Laranja escuro é marrom, e rosa é vermelho claro e lavado. As duas exceções
  // existem porque a lista serve para alguém reconhecer a fonte de relance.
  if (h < 40 && v <= 0.6) return 'brown';
  if (h >= 330 || h < 15) return s <= 0.45 && v >= 0.8 ? 'pink' : 'red';
  return HUES.find(([max]) => h < max)?.[1] ?? 'red';
}
