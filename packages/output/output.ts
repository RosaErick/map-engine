import { Engine, type Store } from '../engine/index.ts';

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
export function openOutput(store: Store, opts: {
  /** Pre-fetched screen, from `listScreens()`. Fetching it here would spend the
   *  user activation `window.open` and `requestFullscreen` still need. */
  screen?: ScreenDetailed;
  resolveUrl?: (path: string) => Promise<string>;
  onWarn?: (message: string) => void;
} = {}): OutputHandle | null {
  const target = opts.screen;
  const features = target
    ? `popup=yes,left=${target.left},top=${target.top},width=${target.width},height=${target.height}`
    : 'popup=yes,width=1280,height=720';
  const win = window.open('', 'map-engine-output', features);
  if (!win) {
    opts.onWarn?.('O navegador bloqueou a janela de saída. Libere pop-ups para esta página.');
    return null;
  }

  win.document.title = 'Saída';
  win.document.body.style.cssText = 'margin:0;background:#000;overflow:hidden;cursor:none';
  win.document.documentElement.style.cssText = 'background:#000';
  const canvas = win.document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100vw;height:100vh;background:#000';
  win.document.body.appendChild(canvas);

  // Fullscreen Companion Window: still inside the opener's user gesture, so the
  // child may go fullscreen on its own screen while the editor keeps this one.
  // Nothing may be awaited before this call or the activation is spent.
  // `{ screen }` pins fullscreen to the projector even if the popup landed
  // elsewhere; browsers without it ignore the option and use the current screen.
  const fsOptions = target ? ({ screen: target } as FullscreenOptions) : undefined;
  win.document.documentElement.requestFullscreen(fsOptions).catch(() => {
    opts.onWarn?.('Não consegui entrar em tela cheia — aperte F11 na janela de saída.');
  });
  if (!target) {
    opts.onWarn?.(hasWindowManagement()
      ? 'Tela não encontrada; a saída abriu na tela atual.'
      : 'Sem gerenciamento de janelas ou sem segunda tela: arraste a saída para o projetor e aperte F11.');
  }

  const engine = new Engine(canvas, store.project, {
    store,
    ...(opts.resolveUrl ? { resolveUrl: opts.resolveUrl } : {}),
    // Native projector pixels: scaling twice blurs what was aligned to the pixel.
    devicePixelRatio: target?.devicePixelRatio ?? win.devicePixelRatio,
  });

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
  };
  applySize();
  win.addEventListener('resize', applySize);
  engine.start();

  const close = (): void => {
    engine.dispose();
    win.removeEventListener('resize', applySize);
    win.close();
  };
  win.addEventListener('pagehide', () => engine.dispose(), { once: true });
  return { window: win, engine, close };
}
