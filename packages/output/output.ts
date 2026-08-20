import { Engine, type SourcePool, type Store } from '../engine/index.ts';

/** Window Management API — Chromium only, and absent from lib.dom in some TS
 *  versions, so the shapes we use are declared locally. */
interface ScreenDetailed {
  left: number; top: number; width: number; height: number;
  devicePixelRatio: number; label: string; isPrimary: boolean; isInternal: boolean;
}
interface ScreenDetails { screens: ScreenDetailed[]; currentScreen: ScreenDetailed }

type WindowWithScreens = Window & {
  getScreenDetails?(): Promise<ScreenDetails>;
  screen: Screen & { isExtended?: boolean };
};

/** True when a second screen exists and the browser will name it for us. */
export function hasWindowManagement(): boolean {
  const w = window as WindowWithScreens;
  return typeof w.getScreenDetails === 'function' && w.screen.isExtended === true;
}

export async function listScreens(): Promise<ScreenDetailed[]> {
  const w = window as WindowWithScreens;
  if (!w.getScreenDetails) return [];
  try {
    const details = await w.getScreenDetails();
    return details.screens;
  } catch {
    return []; // permission denied: the caller falls back to a plain popup
  }
}

export type OutputScreen = ScreenDetailed;

export interface OutputHandle {
  window: Window;
  engine: Engine;
  close(): void;
}

/**
 * Why the output window could not do what was asked, as a stable code.
 *
 * Same rule as the source errors: this module opens a window, it does not write
 * the sentence the operator reads — that belongs to the host, in the host's
 * language.
 */
export type OutputWarning =
  | 'popup-blocked'
  | 'fullscreen-failed'
  | 'screen-not-found'
  | 'no-window-management';

export interface OutputOptions {
  /** Pre-fetched screen, from `listScreens()`. Fetching it here would spend the
   *  user activation `window.open` and `requestFullscreen` still need. */
  screen?: ScreenDetailed;
  /** Share the editor's pool: one decode, one capture prompt. */
  pool?: SourcePool;
  resolveUrl?: (path: string) => Promise<string>;
  /** Title of the output window. English default; the host may localise it. */
  title?: string;
  onWarn?: (code: OutputWarning) => void;
  /** Fires when the window goes away for any reason — the user closed it, the
   *  editor reloaded, or the popup was killed. The caller needs this to stop
   *  showing a "close output" button for a window that no longer exists. */
  onClose?: () => void;
}

/**
 * The clean output window: a black page, one canvas, no UI, no cursor.
 *
 * DECISION: the two windows share the Store object by reference instead of
 * syncing over BroadcastChannel. The build has to run from `file://`, where
 * each document gets an opaque origin and BroadcastChannel does not connect
 * them — but a window opened with `window.open('')` inherits the opener's
 * realm, so passing the store across is direct and needs no protocol at all.
 * Each window still builds its own WebGL context and its own Engine, because a
 * GL context cannot cross a window. Serving over http later, swapping in
 * BroadcastChannel means changing this one function.
 */
export function openOutput(store: Store, opts: OutputOptions = {}): OutputHandle | null {
  const target = opts.screen;
  const features = target
    ? `popup=yes,left=${target.left},top=${target.top},width=${target.width},height=${target.height}`
    : 'popup=yes,width=1280,height=720';
  const win = window.open('', 'map-engine-output', features);
  if (!win) {
    opts.onWarn?.('popup-blocked');
    return null;
  }

  win.document.title = opts.title ?? 'Output';
  win.document.body.style.cssText = 'margin:0;background:#000;overflow:hidden;cursor:none';
  win.document.documentElement.style.cssText = 'background:#000';
  // The window name is reused across opens: clear whatever a previous session
  // left behind instead of stacking a second canvas on top of it.
  win.document.body.replaceChildren();
  const canvas = win.document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100vw;height:100vh;background:#000';
  win.document.body.appendChild(canvas);

  // Fullscreen Companion Window: still inside the opener's user gesture, so the
  // child may go fullscreen on its own screen while the editor keeps this one.
  // Nothing may be awaited before this call or the activation is spent.
  const fsOptions = target ? ({ screen: target } as FullscreenOptions) : undefined;
  win.document.documentElement.requestFullscreen(fsOptions).catch(() => {
    opts.onWarn?.('fullscreen-failed');
  });
  if (!target) {
    opts.onWarn?.(hasWindowManagement() ? 'screen-not-found' : 'no-window-management');
  }

  const engine = new Engine(canvas, store.project, {
    store,
    ...(opts.pool ? { pool: opts.pool } : {}),
    ...(opts.resolveUrl ? { resolveUrl: opts.resolveUrl } : {}),
    // Native projector pixels: scaling twice blurs what was aligned to the pixel.
    devicePixelRatio: target?.devicePixelRatio ?? win.devicePixelRatio,
  });

  let lastSize = '';
  const applySize = (): void => {
    engine.resize(win.innerWidth, win.innerHeight);
    // The project's output size is meant to BE the projector's resolution. If
    // the window differs, letterbox rather than stretch — a stretched output is
    // a misaligned output.
    const { width, height } = store.project.output;
    const scale = Math.min(win.innerWidth / width, win.innerHeight / height);
    engine.setView({
      scale,
      tx: (win.innerWidth - width * scale) / 2,
      ty: (win.innerHeight - height * scale) / 2,
    });
    lastSize = `${width}x${height}`;
  };
  applySize();
  win.addEventListener('resize', applySize);
  // Changing the project's output resolution has to re-letterbox immediately,
  // or the operator is aligning against a frame that no longer matches.
  const unsubscribe = store.subscribe((state) => {
    const size = `${state.project.output.width}x${state.project.output.height}`;
    if (size !== lastSize) applySize();
  });
  engine.start();

  let closed = false;
  const teardown = (): void => {
    if (closed) return;
    closed = true;
    unsubscribe();
    win.removeEventListener('resize', applySize);
    engine.dispose();
    opts.onClose?.();
  };
  const close = (): void => {
    teardown();
    win.close();
  };

  // Every way the window can die ends at the same teardown.
  win.addEventListener('pagehide', teardown, { once: true });
  win.addEventListener('beforeunload', teardown, { once: true });
  // Escape is the only control the output window has. It has no UI, no cursor
  // and no title bar in fullscreen, so without this the operator has to hunt
  // for the window in the task bar to get out.
  win.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !win.document.fullscreenElement) close();
  });
  // A reload or a crash of the editor must not leave a black window on the
  // projector with a dead engine behind it.
  window.addEventListener('pagehide', close, { once: true });

  return { window: win, engine, close };
}
