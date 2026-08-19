import { createTexture, type TextureSource } from './types.ts';

/** A 1x1 texture. Solid colour is the cheapest way to light a shape, and the
 *  first thing you reach for when aligning against a physical edge. */
export class ColorSource implements TextureSource {
  readonly size: [number, number] = [1, 1];
  readonly status = 'ready' as const;
  readonly animated = false;
  isDirty = true;
  #tex: WebGLTexture | null = null;
  #rgb: [number, number, number];

  constructor(rgb: [number, number, number]) { this.#rgb = rgb; }

  setColor(rgb: [number, number, number]): void {
    this.#rgb = rgb;
    this.isDirty = true;
  }

  getTexture(gl: WebGL2RenderingContext): WebGLTexture | null {
    if (!this.#tex) this.#tex = createTexture(gl);
    return this.#tex;
  }

  update(gl: WebGL2RenderingContext): void {
    if (!this.isDirty) return;
    const tex = this.getTexture(gl)!;
    const [r, g, b] = this.#rgb;
    const px = new Uint8Array([r, g, b, 255]);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
    this.isDirty = false;
  }

  dispose(gl: WebGL2RenderingContext): void {
    if (this.#tex) gl.deleteTexture(this.#tex);
    this.#tex = null;
  }
}
