import { Renderer, IDENTITY_VIEW, type ViewTransform } from './renderer.ts';
import { SourcePool } from './sources/index.ts';
import type { CanvasModule } from './sources/types.ts';
import { Store, visibleSurfaces, type StoreState } from './store.ts';
import { emptyProject, type Project, type TestPattern, type Vec2 } from './project.ts';

export interface EngineOptions {
  /** Share a store between the editor window and the output window. */
  store?: Store;
  /** Turns project-relative media paths into loadable URLs. Defaults to using
   *  the path as-is, which is what a plain `file://` or dev server wants. */
  resolveUrl?: (path: string) => Promise<string>;
  loadModule?: (moduleId: string) => Promise<CanvasModule>;
  /** Render at the projector's native pixels regardless of CSS size. */
  devicePixelRatio?: number;
}

/**
 * The whole engine behind one object: a store in, frames out.
 *
 * It owns a canvas, a renderer, a source pool and a render loop, and nothing
 * else. No UI framework, no DOM outside its canvas, no globals. Any host that
 * can hand it a canvas and a Project gets the same picture the editor shows.
 */
export class Engine {
  readonly store: Store;
  readonly renderer: Renderer;
  readonly pool: SourcePool;

  #canvas: HTMLCanvasElement;
  /** The canvas' own window: the output window runs its loop on its own clock. */
  #win: Window;
  #raf = 0;
  #dirty = true;
  #running = false;
  #view: ViewTransform = IDENTITY_VIEW;
  #unsubscribe: () => void;
  #dpr: number;
  #unlockBound: () => void;

  constructor(canvas: HTMLCanvasElement, project: Project = emptyProject(), opts: EngineOptions = {}) {
    this.#canvas = canvas;
    this.#win = canvas.ownerDocument.defaultView ?? window;
    this.store = opts.store ?? new Store(project);
    this.renderer = new Renderer(canvas);
    this.pool = new SourcePool({
      resolveUrl: opts.resolveUrl ?? (async (p) => p),
      loadModule: opts.loadModule,
    });
    this.#dpr = opts.devicePixelRatio ?? 1;
    // Any state change invalidates the frame. Everything else stays asleep.
    this.#unsubscribe = this.store.subscribe(() => { this.#dirty = true; });

    // Browsers block autoplay until a gesture; one listener unlocks every clip.
    this.#unlockBound = () => this.pool.unlock();
    canvas.ownerDocument.addEventListener('pointerdown', this.#unlockBound, { once: false });
  }

  /** Editor pan/zoom. The output window never calls this. */
  setView(view: ViewTransform): void {
    this.#view = view;
    this.#dirty = true;
  }

  get view(): ViewTransform { return this.#view; }

  /** Sizes the drawing buffer. Pass the projector's native resolution. */
  resize(width: number, height: number): void {
    this.renderer.resize(width, height, this.#dpr);
    this.#dirty = true;
  }

  invalidate(): void { this.#dirty = true; }

  start(): void {
    if (this.#running) return;
    this.#running = true;
    const loop = (): void => {
      if (!this.#running) return;
      this.#frame();
      this.#raf = this.#win.requestAnimationFrame(loop);
    };
    this.#raf = this.#win.requestAnimationFrame(loop);
  }

  stop(): void {
    this.#running = false;
    this.#win.cancelAnimationFrame(this.#raf);
  }

  #frame(): void {
    const gl = this.renderer.gl;
    const state = this.store.state;
    this.pool.sync(gl, state.project.sources);
    this.pool.update(gl);
    // An idle installation must not hold the GPU at 60fps for nothing.
    if (!this.#dirty && !this.pool.hasAnimated) return;
    this.#dirty = false;
    this.renderFrame(state);
  }

  /** Draw one frame now, regardless of the dirty flag.
   *  Callers give the view in CSS pixels; the device pixel ratio is folded in
   *  here so no caller has to remember it. */
  renderFrame(state: StoreState = this.store.state): void {
    const v = this.#dpr === 1 ? this.#view : {
      scale: this.#view.scale * this.#dpr,
      tx: this.#view.tx * this.#dpr,
      ty: this.#view.ty * this.#dpr,
    };
    this.renderer.render(
      state.project,
      visibleSurfaces(state),
      this.pool,
      v,
      state.view.testPattern,
    );
  }

  // --- the public API from the brief ---------------------------------------

  load(projectJson: string | unknown): void { this.store.load(projectJson); }
  setSurfaceFrame(id: string, corners: [Vec2, Vec2, Vec2, Vec2]): void { this.store.setSurfaceFrame(id, corners); }
  setSurfaceSource(id: string, sourceId: string | null): void { this.store.setSurfaceSource(id, sourceId); }
  setTestPattern(pattern: TestPattern): void { this.store.setTestPattern(pattern); }

  /** Only 'change' exists today; the signature leaves room for more. */
  on(event: 'change', cb: (state: StoreState) => void): () => void {
    if (event !== 'change') throw new Error(`evento desconhecido: ${String(event)}`);
    return this.store.subscribe(cb);
  }

  dispose(): void {
    this.stop();
    this.#unsubscribe();
    this.#canvas.ownerDocument.removeEventListener('pointerdown', this.#unlockBound);
    this.pool.disposeAll(this.renderer.gl);
    this.renderer.dispose();
  }
}

export function createEngine(canvas: HTMLCanvasElement, project?: Project, opts?: EngineOptions): Engine {
  return new Engine(canvas, project, opts);
}
