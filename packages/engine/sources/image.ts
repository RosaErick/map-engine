import { createTexture, uploadTexture, type SourceContext, type TextureSource } from './types.ts';

/** Still image. Decoded once, uploaded once, then it never touches the GPU again. */
export class ImageSource implements TextureSource {
  size: [number, number] = [0, 0];
  status: 'loading' | 'ready' | 'error' = 'loading';
  error?: string;
  readonly animated = false;
  isDirty = false;
  #tex: WebGLTexture | null = null;
  #bitmap: ImageBitmap | null = null;

  constructor(path: string, ctx: SourceContext) {
    void this.#load(path, ctx);
  }

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
      this.isDirty = true;
    } catch (e) {
      this.status = 'error';
      this.error = `imagem não carregou: ${path}`;
      void e;
    }
  }

  getTexture(gl: WebGL2RenderingContext): WebGLTexture | null {
    if (this.status !== 'ready') return null;
    if (!this.#tex) this.#tex = createTexture(gl);
    return this.#tex;
  }

  update(gl: WebGL2RenderingContext): void {
    if (!this.isDirty || !this.#bitmap) return;
    const tex = this.getTexture(gl);
    if (!tex) return;
    uploadTexture(gl, tex, this.#bitmap);
    this.isDirty = false;
  }

  dispose(gl: WebGL2RenderingContext): void {
    if (this.#tex) gl.deleteTexture(this.#tex);
    this.#tex = null;
    this.#bitmap?.close();
    this.#bitmap = null;
  }
}
