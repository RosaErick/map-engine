import { ContextTextures, uploadTexture, type SourceContext, type TextureSource } from './types.ts';

/** Still image. Decoded once, then uploaded once per GL context and never again. */
export class ImageSource implements TextureSource {
  size: [number, number] = [0, 0];
  status: 'loading' | 'ready' | 'error' = 'loading';
  error?: string;
  readonly animated = false;
  #textures = new ContextTextures();
  #bitmap: ImageBitmap | null = null;

  constructor(path: string, ctx: SourceContext) {
    void this.#load(path, ctx);
  }

  get isDirty(): boolean { return this.#textures.anyStale; }

  async #load(path: string, ctx: SourceContext): Promise<void> {
    try {
      const url = await ctx.resolveUrl(path);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Premultiply here as well as on upload so the convention holds even if a
      // browser ignores UNPACK_PREMULTIPLY_ALPHA_WEBGL for ImageBitmap.
      this.#bitmap = await createImageBitmap(await res.blob(), { premultiplyAlpha: 'premultiply' });
      this.size = [this.#bitmap.width, this.#bitmap.height];
      this.status = 'ready';
      this.#textures.invalidate();
    } catch {
      this.status = 'error';
      this.error = `imagem não carregou: ${path}`;
    }
  }

  getTexture(gl: WebGL2RenderingContext): WebGLTexture | null {
    return this.status === 'ready' ? this.#textures.texture(gl) : null;
  }

  update(gl: WebGL2RenderingContext): void {
    if (!this.#bitmap || !this.#textures.isStale(gl)) return;
    uploadTexture(gl, this.#textures.texture(gl), this.#bitmap);
    this.#textures.markUploaded(gl);
  }

  release(gl: WebGL2RenderingContext): void { this.#textures.release(gl); }

  dispose(_gl: WebGL2RenderingContext): void {
    this.#textures.disposeAll();
    this.#bitmap?.close();
    this.#bitmap = null;
  }
}
