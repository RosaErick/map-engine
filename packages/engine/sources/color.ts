import { ContextTextures, type TextureSource } from './types.ts';

/** A 1x1 texture. Solid colour is the cheapest way to light a shape, and the
 *  first thing you reach for when aligning against a physical edge. */
export class ColorSource implements TextureSource {
  readonly size: [number, number] = [1, 1];
  readonly status = 'ready' as const;
  readonly animated = false;
  #textures = new ContextTextures();
  #rgb: [number, number, number];

  constructor(rgb: [number, number, number]) { this.#rgb = rgb; }

  get isDirty(): boolean { return this.#textures.anyStale; }

  setColor(rgb: [number, number, number]): void {
    this.#rgb = rgb;
    this.#textures.invalidate();
  }

  getTexture(gl: WebGL2RenderingContext): WebGLTexture | null {
    return this.#textures.texture(gl);
  }

  update(gl: WebGL2RenderingContext): void {
    if (!this.#textures.isStale(gl)) return;
    const tex = this.#textures.texture(gl);
    const [r, g, b] = this.#rgb;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([r, g, b, 255]));
    this.#textures.markUploaded(gl);
  }

  release(gl: WebGL2RenderingContext): void { this.#textures.release(gl); }
  dispose(_gl: WebGL2RenderingContext): void { this.#textures.disposeAll(); }
}
