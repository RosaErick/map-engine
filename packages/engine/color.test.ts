import { test } from 'node:test';
import assert from 'node:assert/strict';
import { colorKey, hexOf, hsvToRgb, parseHex, rgbToHsv, type Rgb } from './color.ts';

test('AC-63: cada tom recebe o próprio nome', () => {
  const cases: [Rgb, string][] = [
    [[255, 255, 255], 'white'], [[0, 0, 0], 'black'], [[128, 128, 128], 'grey'],
    [[255, 0, 0], 'red'], [[255, 140, 0], 'orange'], [[255, 255, 0], 'yellow'],
    [[0, 255, 0], 'green'], [[0, 255, 255], 'cyan'], [[0, 0, 255], 'blue'],
    [[160, 80, 255], 'violet'], [[255, 0, 255], 'magenta'],
    [[120, 70, 20], 'brown'], [[255, 180, 200], 'pink'],
  ];
  for (const [rgb, expected] of cases) {
    assert.equal(colorKey(rgb), expected, `${hexOf(rgb)} devia ser ${expected}`);
  }
});

test('AC-63: preto quase puro não vira um matiz de ruído', () => {
  // O último bit de um canal dá um matiz qualquer; chamar isso de "verde" seria
  // pior do que não nomear.
  for (const rgb of [[0, 1, 0], [1, 0, 0], [0, 0, 2]] as Rgb[]) {
    assert.equal(colorKey(rgb), 'black', `${hexOf(rgb)}`);
  }
});

test('AC-64: hex e rgb são a mesma cor nos dois sentidos', () => {
  assert.equal(hexOf([208, 43, 43]), '#d02b2b');
  assert.deepEqual(parseHex('#d02b2b'), [208, 43, 43]);
  assert.deepEqual(parseHex('d02b2b'), [208, 43, 43]);
  assert.deepEqual(parseHex('#fff'), [255, 255, 255]);
});

test('AC-64: hex inválido é recusado em vez de virar preto', () => {
  // Um campo de texto recebe metade de um hex enquanto a pessoa digita. Tratar
  // isso como preto acenderia a superfície errada no meio da digitação.
  for (const bad of ['', '#', '#12', 'ggg', '#1234', 'rgb(1,2,3)']) {
    assert.equal(parseHex(bad), null, bad);
  }
});

test('AC-64: rgb -> hsv -> rgb devolve a mesma cor', () => {
  const samples: Rgb[] = [[255, 0, 0], [12, 200, 90], [0, 0, 0], [255, 255, 255], [37, 37, 200]];
  for (const rgb of samples) {
    assert.deepEqual(hsvToRgb(rgbToHsv(rgb)), rgb, hexOf(rgb));
  }
});
