import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_TEXT, type Source, type TextStyle } from '../model/project.ts';
import { layOutText, TextSource, type LineMetrics } from './text.ts';
import { SourcePool } from './index.ts';

/**
 * Everything below the layout needs a `<canvas>`, which node has no idea about.
 * Same answer as `textures.test.ts` gives WebGL: a double that implements just
 * enough of the API for the code under test to run.
 */

interface Call { op: 'fillRect' | 'fillText'; fill: string; text?: string; x?: number; y?: number; w?: number; h?: number }

interface Fake2D {
  calls: Call[];
  font: string;
  fillStyle: string;
  textBaseline: string;
  textAlign: string;
  letterSpacing?: string;
  measureText(text: string): Record<string, number>;
  fillRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
}

interface FakeCanvas { width: number; height: number; ctx: Fake2D; getContext(): Fake2D }

/** Half an em wide per glyph, ink from 0.7 above the baseline to 0.2 below. */
function fake2d(letterSpacing: boolean): Fake2D {
  const ctx: Fake2D = {
    calls: [],
    font: '',
    fillStyle: '',
    textBaseline: '',
    textAlign: '',
    measureText(text) {
      const size = Number(/([\d.]+)px/.exec(ctx.font)?.[1] ?? 0);
      const ink = text.trim().length > 0;
      return {
        width: text.length * size * 0.5,
        actualBoundingBoxAscent: ink ? size * 0.7 : 0,
        actualBoundingBoxDescent: ink ? size * 0.2 : 0,
        fontBoundingBoxAscent: size * 0.8,
        fontBoundingBoxDescent: size * 0.2,
      };
    },
    fillRect(x, y, w, h) { ctx.calls.push({ op: 'fillRect', fill: ctx.fillStyle, x, y, w, h }); },
    fillText(text, x, y) { ctx.calls.push({ op: 'fillText', fill: ctx.fillStyle, text, x, y }); },
  };
  if (letterSpacing) ctx.letterSpacing = '0px';
  return ctx;
}

/** Installs the global `document` a source reaches for, and hands back the last
 *  canvas it created so a test can read what was painted. */
function useFakeCanvas(letterSpacing = true): () => FakeCanvas {
  let last: FakeCanvas | null = null;
  const createElement = (): unknown => {
    const ctx = fake2d(letterSpacing);
    const canvas: FakeCanvas = { width: 0, height: 0, ctx, getContext: () => ctx };
    last = canvas;
    return canvas;
  };
  (globalThis as { document?: unknown }).document = { createElement };
  return () => {
    assert.ok(last, 'no canvas was created');
    return last;
  };
}

function style(over: Partial<TextStyle> = {}): TextStyle {
  return { ...DEFAULT_TEXT, ...over };
}

/** A measuring stand-in for the pure layout: fixed advance, fixed ink height. */
function ruler(perGlyph = 50, ascent = 70, descent = 20): (line: string) => LineMetrics {
  return (line) => ({ width: line.length * perGlyph, ascent, descent });
}

test('AC-76: the texture is the box of the text, drawn at the 2048 cap', () => {
  const layout = layOutText(style({ text: 'ABCD' }), ruler());
  // 200 wide by 90 tall at measuring size: the wide side lands on the cap and
  // the other keeps the ratio.
  assert.equal(layout.size[0], 2048);
  assert.equal(layout.size[1], Math.round(2048 * (90 / 200)));
  assert.equal(layout.fontSize, 2048 * (100 / 200));
});

test('AC-76: a tall block puts its height on the cap instead', () => {
  const layout = layOutText(style({ text: 'A\nB\nC\nD\nE' }), ruler());
  assert.equal(layout.size[1], 2048);
  assert.ok(layout.size[0] < 2048);
});

test('AC-76: short text scales up to the cap, it is not drawn at natural size', () => {
  const small = layOutText(style({ text: 'i' }), ruler(4, 7, 2));
  assert.equal(Math.max(...small.size), 2048);
  assert.ok(small.fontSize > 100, 'a tiny string still gets the sharpest texture the cap allows');
});

test('AC-77: empty text is valid, has a non-zero size and lights nothing', () => {
  const layout = layOutText(style({ text: '' }), ruler());
  assert.deepEqual(layout.size, [2, 2]);
  assert.deepEqual(layout.lines, []);
});

test('AC-77: an empty text source is ready and paints a black canvas only', () => {
  const canvas = useFakeCanvas();
  const source = new TextSource(style({ text: '' }));
  assert.equal(source.status, 'ready');
  assert.deepEqual(source.size, [2, 2]);
  const { ctx, width, height } = canvas();
  assert.deepEqual([width, height], [2, 2]);
  assert.deepEqual(ctx.calls.map((c) => c.op), ['fillRect']);
  assert.equal(ctx.calls[0]?.fill, '#000');
});

test('AC-74: the background is painted black before any glyph is drawn', () => {
  const canvas = useFakeCanvas();
  new TextSource(style({ text: 'oi', color: [255, 0, 0] }));
  const { ctx, width, height } = canvas();
  const [first, ...rest] = ctx.calls;
  assert.equal(first?.op, 'fillRect');
  assert.equal(first?.fill, '#000');
  // The black covers the whole texture: it is the transparency, not a backdrop.
  assert.deepEqual([first?.w, first?.h], [width, height]);
  assert.ok(rest.length > 0 && rest.every((c) => c.op === 'fillText' && c.fill === 'rgb(255, 0, 0)'));
});

test('AC-79: lines stack by line height and the widest one defines the box', () => {
  const tight = layOutText(style({ text: 'A\nBBBB', lineHeight: 1 }), ruler());
  const loose = layOutText(style({ text: 'A\nBBBB', lineHeight: 2 }), ruler());
  // Widest line is 4 glyphs: 200 units, against a 90 + step tall block.
  assert.equal(tight.size[0], 2048);
  assert.equal(tight.size[1], Math.round(2048 * (190 / 200)));
  // Doubling the line height makes the block taller than it is wide, so now it
  // is the height that lands on the cap.
  assert.deepEqual(loose.size, [Math.round(2048 * (200 / 290)), 2048]);

  const [a, b] = tight.lines;
  assert.ok(a && b);
  assert.ok(Math.abs(b.y - a.y - 100 * (2048 / 200)) < 1e-9, 'baselines are one line height apart');
});

test('AC-79: alignment moves the short line inside the box', () => {
  const text = 'A\nBBBB';
  const left = layOutText(style({ text, align: 'left', lineHeight: 1 }), ruler());
  const centre = layOutText(style({ text, align: 'center', lineHeight: 1 }), ruler());
  const right = layOutText(style({ text, align: 'right', lineHeight: 1 }), ruler());
  const scale = 2048 / 200;

  assert.deepEqual(left.lines.map((l) => l.x), [0, 0]);
  assert.deepEqual(centre.lines.map((l) => l.x), [75 * scale, 0]);
  assert.deepEqual(right.lines.map((l) => l.x), [150 * scale, 0]);
});

test('AC-79: a blank line still pushes the text down instead of collapsing', () => {
  const canvas = useFakeCanvas();
  new TextSource(style({ text: '\nA' }));
  const drawn = canvas().ctx.calls.filter((c) => c.op === 'fillText');
  assert.equal(drawn.length, 2);
  assert.ok((drawn[1]?.y ?? 0) > (drawn[0]?.y ?? 0));
});

test('AC-79: tracking without letterSpacing draws glyph by glyph', () => {
  const canvas = useFakeCanvas(false);
  new TextSource(style({ text: 'abc', tracking: 0.2 }));
  const drawn = canvas().ctx.calls.filter((c) => c.op === 'fillText');
  assert.deepEqual(drawn.map((c) => c.text), ['a', 'b', 'c']);
  assert.ok((drawn[1]?.x ?? 0) > (drawn[0]?.x ?? 0));
});

test('AC-75: editing a text source patches the instance instead of rebuilding it', () => {
  useFakeCanvas();
  const gl = {} as WebGL2RenderingContext;
  const pool = new SourcePool({ resolveUrl: async (p) => p });
  const before: Source = { id: 't', name: 'texto', kind: 'text', ...style({ text: 'a' }) };
  pool.sync(gl, [before]);
  const instance = pool.get('t');
  assert.ok(instance instanceof TextSource);

  pool.sync(gl, [{ ...before, text: 'ab' }]);
  // Same object: a rebuild would drop the texture and blink on the wall.
  assert.equal(pool.get('t'), instance);
  assert.equal(instance.animated, false, 'text does not hold the render loop awake');
});
