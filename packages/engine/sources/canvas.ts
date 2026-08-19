import { createTexture, uploadTexture, type CanvasModule, type SourceContext, type TextureSource } from './types.ts';

/**
 * Generative content: a user module exporting `draw(ctx, t)`.
 *
 * This is the extension point that keeps the engine from ever needing to know
 * what "content" means. We hand it a 2D context and elapsed seconds; whatever
 * it paints becomes a texture.
 */
export class CanvasSource implements TextureSource {
  size: [number, number] = [512, 512];
  status: 'loading' | 'ready' | 'error' = 'loading';
  error?: string;
  readonly animated = true;
  isDirty = true;

  #tex: WebGLTexture | null = null;
  #canvas = document.createElement('canvas');
  #module: CanvasModule | null = null;
  #t0 = performance.now();

  constructor(moduleId: string, ctx: SourceContext) {
    this.#canvas.width = this.size[0];
    this.#canvas.height = this.size[1];
    if (!ctx.loadModule) {
      this.status = 'error';
      this.error = 'nenhum carregador de módulo configurado';
      return;
    }
    void ctx.loadModule(moduleId).then(
      (mod) => {
        this.#module = mod;
        if (mod.size) {
          this.size = mod.size;
          this.#canvas.width = mod.size[0];
          this.#canvas.height = mod.size[1];
        }
        this.status = 'ready';
      },
      () => {
        this.status = 'error';
        this.error = `módulo não carregou: ${moduleId}`;
      },
    );
  }

  getTexture(gl: WebGL2RenderingContext): WebGLTexture | null {
    if (this.status !== 'ready') return null;
    if (!this.#tex) this.#tex = createTexture(gl);
    return this.#tex;
  }

  update(gl: WebGL2RenderingContext): void {
    const tex = this.getTexture(gl);
    if (!tex || !this.#module) return;
    const c2d = this.#canvas.getContext('2d');
    if (!c2d) return;
    c2d.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
    try {
      this.#module.draw(c2d, (performance.now() - this.#t0) / 1000);
    } catch (e) {
      // A throwing user module must not take the show down with it.
      this.status = 'error';
      this.error = `módulo falhou: ${String(e)}`;
      return;
    }
    uploadTexture(gl, tex, this.#canvas);
  }

  dispose(gl: WebGL2RenderingContext): void {
    if (this.#tex) gl.deleteTexture(this.#tex);
    this.#tex = null;
  }
}
