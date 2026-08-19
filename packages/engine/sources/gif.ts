import { createTexture, uploadTexture, type SourceContext, type TextureSource } from './types.ts';

/** WebCodecs' ImageDecoder is Chromium-only and absent from some lib.dom builds. */
type ImageDecoderCtor = new (init: { data: ArrayBuffer; type: string }) => ImageDecoderLike;
interface ImageDecoderLike {
  tracks: { selectedTrack: { frameCount: number } | null; ready: Promise<void> };
  decode(opts: { frameIndex: number }): Promise<{ image: VideoFrameLike }>;
  close(): void;
}
interface VideoFrameLike {
  displayWidth: number;
  displayHeight: number;
  duration: number | null;
  close(): void;
}

/**
 * Animated GIF — and animated PNG/WebP/AVIF for free.
 *
 * An `<img>` holding a GIF gives no access to individual frames, so we decode
 * with WebCodecs' `ImageDecoder` and advance on our own clock using each
 * frame's declared duration. Where `ImageDecoder` is missing we fall back to
 * drawing the `<img>` into a 2D canvas every frame: it animates, but the
 * browser owns the timing and we cannot pause or scrub it.
 */
export class GifSource implements TextureSource {
  size: [number, number] = [0, 0];
  status: 'loading' | 'ready' | 'error' = 'loading';
  error?: string;
  readonly animated = true;
  isDirty = false;

  #tex: WebGLTexture | null = null;
  #decoder: ImageDecoderLike | null = null;
  #frameCount = 0;
  #frameIndex = 0;
  #nextAt = 0;
  #pending: VideoFrameLike | null = null;
  #fallbackImg: HTMLImageElement | null = null;
  #fallbackCanvas: HTMLCanvasElement | null = null;

  constructor(path: string, ctx: SourceContext) {
    void this.#load(path, ctx);
  }

  async #load(path: string, ctx: SourceContext): Promise<void> {
    try {
      const url = await ctx.resolveUrl(path);
      const Decoder = (globalThis as Record<string, unknown>)['ImageDecoder'] as ImageDecoderCtor | undefined;
      if (!Decoder) {
        await this.#loadFallback(url);
        return;
      }
      const data = await (await fetch(url)).arrayBuffer();
      const decoder = new Decoder({ data, type: 'image/gif' });
      await decoder.tracks.ready;
      this.#frameCount = decoder.tracks.selectedTrack?.frameCount ?? 1;
      this.#decoder = decoder;
      await this.#decodeFrame(0);
      this.status = 'ready';
    } catch {
      this.status = 'error';
      this.error = `GIF nao carregou: ${path}`;
    }
  }

  async #loadFallback(url: string): Promise<void> {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    this.#fallbackImg = img;
    this.#fallbackCanvas = canvas;
    this.size = [canvas.width, canvas.height];
    this.status = 'ready';
    this.isDirty = true;
  }

  async #decodeFrame(index: number): Promise<void> {
    if (!this.#decoder) return;
    const { image } = await this.#decoder.decode({ frameIndex: index });
    this.#pending?.close();
    this.#pending = image;
    this.size = [image.displayWidth, image.displayHeight];
    // Duration is microseconds. A GIF with none gets the 100ms an <img> would use.
    const ms = image.duration ? image.duration / 1000 : 100;
    this.#nextAt = performance.now() + Math.max(20, ms);
    this.isDirty = true;
  }

  getTexture(gl: WebGL2RenderingContext): WebGLTexture | null {
    if (this.status !== 'ready') return null;
    if (!this.#tex) this.#tex = createTexture(gl);
    return this.#tex;
  }

  update(gl: WebGL2RenderingContext): void {
    const tex = this.getTexture(gl);
    if (!tex) return;

    if (this.#fallbackCanvas && this.#fallbackImg) {
      const c2d = this.#fallbackCanvas.getContext('2d')!;
      c2d.clearRect(0, 0, this.#fallbackCanvas.width, this.#fallbackCanvas.height);
      c2d.drawImage(this.#fallbackImg, 0, 0);
      uploadTexture(gl, tex, this.#fallbackCanvas);
      return;
    }

    if (this.#decoder && this.#frameCount > 1 && performance.now() >= this.#nextAt) {
      this.#frameIndex = (this.#frameIndex + 1) % this.#frameCount;
      void this.#decodeFrame(this.#frameIndex);
    }
    if (this.isDirty && this.#pending) {
      uploadTexture(gl, tex, this.#pending as unknown as TexImageSource);
      this.isDirty = false;
    }
  }

  dispose(gl: WebGL2RenderingContext): void {
    this.#pending?.close();
    this.#pending = null;
    this.#decoder?.close();
    this.#decoder = null;
    if (this.#tex) gl.deleteTexture(this.#tex);
    this.#tex = null;
  }
}
