/**
 * The one interface the renderer knows about. Every content kind — a colour, a
 * video, another app's window — reduces to "here is a texture and its size".
 *
 * Sources are cached per source id, never per surface: one video feeding ten
 * surfaces decodes once and uploads once per frame.
 */
/**
 * Why a source failed, as a stable code.
 *
 * The engine has no interface copy: a sentence like "image failed to load" is
 * a wording chosen by a renderer, in a language it has no business picking.
 * The host translates the code and owns every word the user reads.
 */
export type SourceErrorCode =
  | 'image-failed'
  | 'video-failed'
  | 'gif-failed'
  | 'capture-unavailable'
  | 'capture-denied'
  | 'capture-ended'
  | 'camera-unavailable'
  | 'camera-denied'
  | 'camera-not-found'
  | 'camera-in-use'
  | 'camera-gone'
  | 'camera-failed'
  | 'module-no-loader'
  | 'module-failed';

export interface SourceError {
  code: SourceErrorCode;
  /** A path, a device, an exception message — context, never a sentence. */
  detail?: string;
}

export interface TextureSource {
  /** Natural pixel size of the content. [0,0] until it has loaded. */
  readonly size: [number, number];
  /** True when at least one GL context still holds a stale copy. */
  readonly isDirty: boolean;
  /** 'error' makes the renderer draw the missing-media pattern instead of
   *  leaving stale pixels on a physical object. */
  readonly status: 'loading' | 'ready' | 'error';
  readonly error?: SourceError;
  /** True while content changes on its own — the render loop stays awake. */
  readonly animated: boolean;
  getTexture(gl: WebGL2RenderingContext): WebGLTexture | null;
  update(gl: WebGL2RenderingContext): void;
  /** Drops this context's texture. The content itself survives, because another
   *  window may still be drawing it. */
  release(gl: WebGL2RenderingContext): void;
  /** Drops the content for good. Stops streams, closes decoders. */
  dispose(gl: WebGL2RenderingContext): void;
}

/** How the engine turns project-relative paths and module ids into things the
 *  browser can load. Injected by the host so the engine never touches the File
 *  System Access API itself. */
export interface SourceContext {
  resolveUrl(path: string): Promise<string>;
  loadModule?(moduleId: string): Promise<CanvasModule>;
}

/** User-supplied generative content. The engine calls `draw` and nothing else. */
export interface CanvasModule {
  draw(ctx: CanvasRenderingContext2D, t: number): void;
  size?: [number, number];
}

/**
 * One texture per GL context, plus the bookkeeping to know which contexts are
 * behind.
 *
 * A single dirty flag was enough while one source fed one canvas. It stops
 * being enough the moment the editor and the output window draw the same clip:
 * a GL texture cannot cross a window, so each context needs its own copy, and
 * whoever uploads first must not clear the flag for the other. Content changes
 * bump a version; each context remembers the version it last uploaded.
 */
export class ContextTextures {
  #textures = new Map<WebGL2RenderingContext, WebGLTexture>();
  #uploaded = new Map<WebGL2RenderingContext, number>();
  #version = 1;

  /** Call whenever the pixels changed. Every context re-uploads once. */
  invalidate(): void { this.#version++; }

  texture(gl: WebGL2RenderingContext): WebGLTexture {
    let tex = this.#textures.get(gl);
    if (!tex) {
      tex = createTexture(gl);
      this.#textures.set(gl, tex);
    }
    return tex;
  }

  isStale(gl: WebGL2RenderingContext): boolean {
    return this.#uploaded.get(gl) !== this.#version;
  }

  markUploaded(gl: WebGL2RenderingContext): void {
    this.#uploaded.set(gl, this.#version);
  }

  /** True while any context that has drawn this source is behind. */
  get anyStale(): boolean {
    if (this.#textures.size === 0) return true;
    for (const gl of this.#textures.keys()) if (this.isStale(gl)) return true;
    return false;
  }

  release(gl: WebGL2RenderingContext): void {
    const tex = this.#textures.get(gl);
    if (tex) gl.deleteTexture(tex);
    this.#textures.delete(gl);
    this.#uploaded.delete(gl);
  }

  /** Deletes every texture. Contexts already lost are skipped by the browser. */
  disposeAll(): void {
    for (const [gl, tex] of this.#textures) gl.deleteTexture(tex);
    this.#textures.clear();
    this.#uploaded.clear();
  }
}

/** Creates a texture with the sampling setup every source wants: clamped,
 *  linear, no mips (sources are non-power-of-two and change every frame). */
export function createTexture(gl: WebGL2RenderingContext): WebGLTexture {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return tex;
}

/**
 * Uploads any browser image-like object with the project's one true alpha
 * convention: premultiplied, y flipped so v=0 is the top of the image.
 *
 * Mixing premultiply flags between sources is what produces the dark halo
 * around shapes, which on a projector reads as a grey frame around every
 * picture. One function, one convention, no exceptions.
 */
export function uploadTexture(
  gl: WebGL2RenderingContext,
  tex: WebGLTexture,
  src: TexImageSource,
  /**
   * Vira a imagem no eixo Y ao subir.
   *
   * Não é preferência: `UNPACK_FLIP_Y_WEBGL` é **ignorado para `ImageBitmap`**
   * neste navegador e **aplicado a um `<canvas>`**. Medido lado a lado no mesmo
   * frame: com o flip ligado, uma imagem sai certa e um canvas sai de cabeça
   * para baixo; com ele desligado, a imagem não muda e o canvas se corrige.
   *
   * Por isso quem desenha num canvas sobe sem flip. As outras fontes mantêm o
   * padrão até alguém medir com mídia de verdade — ver a lacuna registrada em
   * `docs/ARCHITECTURE.md`.
   */
  flipY = true,
): void {
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipY);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
}
