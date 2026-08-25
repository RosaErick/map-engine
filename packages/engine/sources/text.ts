import type { TextAlign, TextFamily, TextStyle } from '../model/project.ts';
import { ContextTextures, uploadTexture, type TextureSource } from './types.ts';

/** Longest side of the texture, in pixels. Above this the text softens on the
 *  wall; the fix is a bigger cap, and the price is memory. */
const MAX_SIDE = 2048;

/** Everything is measured at this size and the whole layout is then scaled to
 *  `MAX_SIDE`. Metrics scale linearly with the font size, so one measuring pass
 *  is enough — a second one at the final size would only re-read hinting the
 *  projector cannot resolve anyway. */
const MEASURE_SIZE = 100;

/** Side of the canvas an empty text gets. Never zero: the renderer divides by
 *  the source size to build `uvMatrix`. */
const EMPTY_SIDE = 2;

/**
 * Font stacks, not fonts. The app is a single HTML file that opens with no
 * network: embedding a face would inflate it and fetching one would break the
 * offline promise. Loading a face from the project folder is the natural next
 * step, and is not in scope here.
 */
const FAMILY_STACK: Record<TextFamily, string> = {
  sans: 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", Times, serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
};

export interface LineMetrics {
  /** Advance width, tracking included. */
  width: number;
  /** Distance from the baseline to the top of the ink. */
  ascent: number;
  /** Distance from the baseline down to the bottom of the ink. */
  descent: number;
}

export interface TextLayout {
  /** Canvas size in pixels, never `[0, 0]`. */
  size: [number, number];
  /** Size to draw the glyphs at, in pixels. */
  fontSize: number;
  /** Baseline origin of each line, already in canvas pixels. */
  lines: readonly { text: string; x: number; y: number }[];
}

const BLANK: LineMetrics = { width: 0, ascent: 0, descent: 0 };

/**
 * Where every line lands, and how big the texture has to be.
 *
 * Split out from the drawing so the box, the line breaking and the scale to the
 * cap are decidable without a canvas — the part that is worth a test and the
 * part that cannot run in node are not the same part.
 *
 * `measure` reports one line at `MEASURE_SIZE`; it owns family, weight and
 * tracking, which is why this function never looks at them.
 */
export function layOutText(style: TextStyle, measure: (line: string) => LineMetrics): TextLayout {
  const texts = style.text.split('\n');
  const metrics = texts.map(measure);
  const first = metrics[0] ?? BLANK;
  const last = metrics[metrics.length - 1] ?? BLANK;
  const step = MEASURE_SIZE * style.lineHeight;

  // The widest line defines the box; the block runs from the first line's ink
  // down to the last line's, so a one-liner gets a box with no leading around it.
  const width = Math.max(...metrics.map((m) => m.width));
  const height = first.ascent + step * (texts.length - 1) + last.descent;

  // Empty text is a source that lights nothing, not an error and not a texture
  // of size zero.
  if (!(width > 0) || !(height > 0)) {
    return { size: [EMPTY_SIDE, EMPTY_SIDE], fontSize: MEASURE_SIZE, lines: [] };
  }

  // Always drawn at the cap, never at the "natural" size: the surface may be
  // 200 px on the wall or 1800, and this is the sharpest the cap allows.
  const scale = MAX_SIDE / Math.max(width, height);
  return {
    size: [Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))],
    fontSize: MEASURE_SIZE * scale,
    lines: texts.map((text, i) => ({
      text,
      x: alignOffset(style.align, width, metrics[i]?.width ?? 0) * scale,
      y: (first.ascent + i * step) * scale,
    })),
  };
}

function alignOffset(align: TextAlign, box: number, line: number): number {
  if (align === 'center') return (box - line) / 2;
  if (align === 'right') return box - line;
  return 0;
}

/**
 * Text as content: a 2D canvas with a drawing function of ours, which is the
 * same mechanism `CanvasSource` already proves — nothing in the renderer knows
 * the difference.
 *
 * There is no background colour and no alpha trick. Black is absence of light
 * on a projector, so the black canvas *is* the transparency: paint it, then
 * light the glyphs on top. Anyone wanting a box behind the text puts a colour
 * surface underneath.
 */
export class TextSource implements TextureSource {
  size: [number, number] = [EMPTY_SIDE, EMPTY_SIDE];
  readonly status = 'ready' as const;
  /** Text does not change on its own, and claiming otherwise would hold the GPU
   *  at 60fps in an installation that is standing still. */
  readonly animated = false;

  #textures = new ContextTextures();
  #canvas = document.createElement('canvas');

  constructor(style: TextStyle) { this.setText(style); }

  get isDirty(): boolean { return this.#textures.anyStale; }

  /** Redraws in place. The pool calls this instead of rebuilding the source,
   *  because rebuilding on every keystroke throws the texture away and blinks
   *  on the wall. */
  setText(style: TextStyle): void {
    this.#draw(style);
    this.#textures.invalidate();
  }

  getTexture(gl: WebGL2RenderingContext): WebGLTexture | null {
    return this.#textures.texture(gl);
  }

  update(gl: WebGL2RenderingContext): void {
    if (!this.#textures.isStale(gl)) return;
    // Sem flip: o texto é desenhado num canvas, e canvas não leva flip. Ver
    // o porquê medido em `uploadTexture`.
    uploadTexture(gl, this.#textures.texture(gl), this.#canvas, false);
    this.#textures.markUploaded(gl);
  }

  release(gl: WebGL2RenderingContext): void { this.#textures.release(gl); }
  dispose(_gl: WebGL2RenderingContext): void { this.#textures.disposeAll(); }

  #draw(style: TextStyle): void {
    const c2d = this.#canvas.getContext('2d');
    if (!c2d) return;
    const stack = FAMILY_STACK[style.family];
    const face = `${style.italic ? 'italic ' : ''}${style.weight} `;
    // `letterSpacing` is recent; without it we walk the glyphs ourselves, which
    // costs the shaping of the whole line — only taken when there is tracking
    // to apply, so the common case keeps its kerning.
    const native = 'letterSpacing' in c2d;
    const manual = !native && style.tracking !== 0;

    c2d.font = `${face}${MEASURE_SIZE}px ${stack}`;
    if (native) c2d.letterSpacing = `${style.tracking * MEASURE_SIZE}px`;
    const layout = layOutText(style, (line) => measureLine(c2d, line, MEASURE_SIZE, manual ? style.tracking : 0));

    this.size = layout.size;
    // Sizing the canvas resets the 2D state, so font and spacing are set again.
    this.#canvas.width = layout.size[0];
    this.#canvas.height = layout.size[1];
    c2d.font = `${face}${layout.fontSize}px ${stack}`;
    if (native) c2d.letterSpacing = `${style.tracking * layout.fontSize}px`;
    c2d.textBaseline = 'alphabetic';
    c2d.textAlign = 'left';

    c2d.fillStyle = '#000';
    c2d.fillRect(0, 0, layout.size[0], layout.size[1]);
    const [r, g, b] = style.color;
    c2d.fillStyle = `rgb(${r}, ${g}, ${b})`;
    const step = style.tracking * layout.fontSize;
    for (const line of layout.lines) {
      if (manual) drawTracked(c2d, line.text, line.x, line.y, step);
      else c2d.fillText(line.text, line.x, line.y);
    }
  }
}

function measureLine(c2d: CanvasRenderingContext2D, line: string, size: number, tracking: number): LineMetrics {
  const m = c2d.measureText(line);
  // Glyph-by-glyph drawing pays a gap after every character, so the box has to
  // be measured with the same gaps or the last glyph falls off the edge.
  // ponytail: the advance width ignores the overhang of an italic tail, which
  // can graze the right edge; the upgrade is actualBoundingBoxLeft/Right.
  const width = m.width + tracking * size * line.length;
  const ascent = m.actualBoundingBoxAscent;
  const descent = m.actualBoundingBoxDescent;
  if (ascent > 0 || descent > 0) return { width, ascent, descent };
  // No ink at all — a blank line, or a browser that does not report the box.
  // Body metrics keep a leading newline pushing the text down instead of
  // collapsing the block onto the first baseline.
  return {
    width,
    ascent: m.fontBoundingBoxAscent || size * 0.8,
    descent: m.fontBoundingBoxDescent || size * 0.2,
  };
}

function drawTracked(c2d: CanvasRenderingContext2D, text: string, x: number, y: number, step: number): void {
  let cursor = x;
  for (const ch of text) {
    c2d.fillText(ch, cursor, y);
    cursor += c2d.measureText(ch).width + step;
  }
}
