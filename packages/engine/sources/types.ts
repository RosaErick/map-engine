/**
 * The one interface the renderer knows about. Every content kind — a colour, a
 * video, another app's window — reduces to "here is a texture and its size".
 *
 * Sources are cached per source id, never per surface: one video feeding ten
 * surfaces decodes once and uploads once per frame.
 */
export interface TextureSource {
  /** Natural pixel size of the content. [0,0] until it has loaded. */
  readonly size: [number, number];
  /** True when the GPU copy is stale and `update()` should re-upload. */
  isDirty: boolean;
  /** 'error' makes the renderer draw the missing-media pattern instead of
   *  leaving stale pixels on a physical object. */
  readonly status: 'loading' | 'ready' | 'error';
  readonly error?: string;
  /** True while content changes on its own — the render loop stays awake. */
  readonly animated: boolean;
  getTexture(gl: WebGL2RenderingContext): WebGLTexture | null;
  update(gl: WebGL2RenderingContext): void;
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
export function uploadTexture(gl: WebGL2RenderingContext, tex: WebGLTexture, src: TexImageSource): void {
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
}
