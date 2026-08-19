import { createTexture, uploadTexture, type SourceContext, type TextureSource } from './types.ts';

/** `requestVideoFrameCallback` is stable in Chromium but not in every lib.dom. */
type VideoWithRVFC = HTMLVideoElement & {
  requestVideoFrameCallback?(cb: (now: number, meta: unknown) => void): number;
  cancelVideoFrameCallback?(handle: number): void;
};

/**
 * Anything that paints into a `<video>`: a file, a screen capture, a webcam.
 *
 * The upload is driven by `requestVideoFrameCallback`, not by the render loop.
 * A 25fps clip on a 60Hz monitor then uploads 25 times a second instead of 60,
 * which is two thirds of the texture traffic gone for free. Where the callback
 * is missing we fall back to marking dirty every frame.
 */
export class VideoTextureSource implements TextureSource {
  size: [number, number] = [0, 0];
  status: 'loading' | 'ready' | 'error' = 'loading';
  error?: string;
  readonly animated = true;
  isDirty = false;
  protected video: VideoWithRVFC;
  #tex: WebGLTexture | null = null;
  #rvfcHandle: number | null = null;
  #objectUrl: string | null = null;

  constructor() {
    const v = document.createElement('video') as VideoWithRVFC;
    v.muted = true;          // autoplay is blocked with sound, always
    v.playsInline = true;
    v.loop = true;
    v.crossOrigin = 'anonymous';
    this.video = v;
    v.addEventListener('loadedmetadata', () => {
      this.size = [v.videoWidth, v.videoHeight];
      this.status = 'ready';
      this.isDirty = true;
    });
    v.addEventListener('error', () => {
      this.status = 'error';
      this.error = 'vídeo não carregou';
    });
    this.#scheduleFrame();
  }

  #scheduleFrame(): void {
    const v = this.video;
    if (typeof v.requestVideoFrameCallback === 'function') {
      this.#rvfcHandle = v.requestVideoFrameCallback(() => {
        this.isDirty = true;
        this.#scheduleFrame();
      });
    } else {
      // ponytail: no rVFC means we upload once per render frame. Correct, just
      // wasteful; Chromium has had it since 2020 so this path is rarely taken.
      this.isDirty = true;
    }
  }

  protected setSrcObject(stream: MediaStream): void {
    this.video.srcObject = stream;
    // "Stop sharing" ends the track. Without this the surface would freeze on
    // its last frame and keep lying to whoever is looking at the wall.
    for (const track of stream.getTracks()) {
      track.addEventListener('ended', () => {
        this.status = 'error';
        this.error = 'a captura foi encerrada';
      });
    }
    void this.video.play().catch(() => { /* unlocked by the first user gesture */ });
  }

  protected setSrcUrl(url: string, objectUrl = false): void {
    if (objectUrl) this.#objectUrl = url;
    this.video.src = url;
    void this.video.play().catch(() => { /* unlocked by the first user gesture */ });
  }

  /** Called after the first user gesture, when browsers allow playback. */
  unlock(): void {
    if (this.video.paused) void this.video.play().catch(() => {});
  }

  setPlayback(opts: { loop?: boolean; muted?: boolean; rate?: number }): void {
    if (opts.loop !== undefined) this.video.loop = opts.loop;
    if (opts.muted !== undefined) this.video.muted = opts.muted;
    if (opts.rate !== undefined && opts.rate > 0) this.video.playbackRate = opts.rate;
  }

  getTexture(gl: WebGL2RenderingContext): WebGLTexture | null {
    if (this.status !== 'ready') return null;
    if (!this.#tex) this.#tex = createTexture(gl);
    return this.#tex;
  }

  update(gl: WebGL2RenderingContext): void {
    if (!this.isDirty || this.video.readyState < 2) return;
    const tex = this.getTexture(gl);
    if (!tex) return;
    uploadTexture(gl, tex, this.video);
    this.isDirty = false;
  }

  dispose(gl: WebGL2RenderingContext): void {
    if (this.#rvfcHandle !== null) this.video.cancelVideoFrameCallback?.(this.#rvfcHandle);
    const stream = this.video.srcObject;
    if (stream instanceof MediaStream) for (const t of stream.getTracks()) t.stop();
    this.video.srcObject = null;
    this.video.removeAttribute('src');
    this.video.load();
    if (this.#objectUrl) URL.revokeObjectURL(this.#objectUrl);
    if (this.#tex) gl.deleteTexture(this.#tex);
    this.#tex = null;
  }
}

/** A video file from the project folder. WebM with alpha works and is how
 *  cut-out content for projection is usually authored. */
export class FileVideoSource extends VideoTextureSource {
  constructor(path: string, ctx: SourceContext, opts: { loop: boolean; muted: boolean; rate: number }) {
    super();
    this.setPlayback(opts);
    void ctx.resolveUrl(path).then(
      (url) => this.setSrcUrl(url),
      () => {
        this.status = 'error';
        this.error = `vídeo não encontrado: ${path}`;
      },
    );
  }
}

/** Screen or window capture. This is Spout/Syphon for the browser: any other
 *  application running on the machine becomes a mappable texture. */
export class CaptureSource extends VideoTextureSource {
  constructor() {
    super();
    const md = navigator.mediaDevices;
    if (!md?.getDisplayMedia) {
      this.status = 'error';
      this.error = 'captura de tela indisponível neste navegador';
      return;
    }
    void md.getDisplayMedia({ video: true, audio: false }).then(
      (stream) => this.setSrcObject(stream),
      () => {
        this.status = 'error';
        this.error = 'captura de tela recusada';
      },
    );
  }
}

/** Live camera. */
export class CameraSource extends VideoTextureSource {
  constructor(deviceId?: string) {
    super();
    const md = navigator.mediaDevices;
    if (!md?.getUserMedia) {
      this.status = 'error';
      this.error = 'câmera indisponível neste navegador';
      return;
    }
    const video: MediaTrackConstraints = deviceId ? { deviceId: { exact: deviceId } } : {};
    void md.getUserMedia({ video, audio: false }).then(
      (stream) => this.setSrcObject(stream),
      () => {
        this.status = 'error';
        this.error = 'câmera recusada';
      },
    );
  }
}
