import { Store, emptyProject, newSurface, quadToUnit, apply, type Surface, type Vec2 } from '../engine/index.ts';
import { t } from './i18n/index.svelte.ts';
import type { Engine } from '../engine/engine.ts';

/** One store for the whole app. The output window shares this exact object —
 *  see packages/output/output.ts for why that beats a message channel here. */
export const store = new Store(emptyProject(1920, 1080));

export type Tool = 'select' | 'polygon';
export type Page = 'editor' | 'docs';

/** Editor-only state: never saved, never seen by the engine. */
export const ui = $state({
  scale: 0.5,
  tx: 0,
  ty: 0,
  tool: 'select' as Tool,
  page: 'editor' as Page,
  snap: true,
  snapOff: false,          // held key temporarily disables snapping
  pendingPolygon: [] as Vec2[],
  status: '' as string,
  folderName: '' as string,
  /** Uma pasta de projeto de verdade foi aberta — diferente de ter salvo na
   *  memória do navegador, que acontece sozinho no primeiro autosave. */
  hasFolder: false,
  /** Momento do último autosave, zerado por um timer. A barra de cima usa isso
   *  para responder "meu trabalho está salvo?" sem ninguém precisar perguntar. */
  savedAt: 0,
  outputOpen: false,
  outputScreen: '',
});

let engineRef: Engine | null = null;
export function setEngine(e: Engine | null): void { engineRef = e; }
export function getEngine(): Engine | null { return engineRef; }

/** Screen pixels (relative to the stage) -> output pixels. */
export function toOutput(p: Vec2): Vec2 {
  return { x: (p.x - ui.tx) / ui.scale, y: (p.y - ui.ty) / ui.scale };
}

/** Output pixels -> screen pixels. */
export function toScreen(p: Vec2): Vec2 {
  return { x: p.x * ui.scale + ui.tx, y: p.y * ui.scale + ui.ty };
}

export function fitView(stageW: number, stageH: number): void {
  const { width, height } = store.project.output;
  const scale = Math.min(stageW / width, stageH / height) * 0.9;
  ui.scale = scale;
  ui.tx = (stageW - width * scale) / 2;
  ui.ty = (stageH - height * scale) / 2;
}

/** Snap radius in output pixels — a fixed screen distance, so zooming in makes
 *  snapping finer instead of stickier. */
const SNAP_PX = 8;

/**
 * Nearest corner of another surface, if one is within the snap radius.
 * DECISION: corners only, no edges — corner-to-corner is the alignment that
 * actually matters when two mapped objects touch, and edge snapping on a
 * perspective quad is ambiguous enough to be a v2 problem.
 */
export function snapPoint(p: Vec2, exceptId: string): Vec2 {
  if (!ui.snap || ui.snapOff) return p;
  const radius = SNAP_PX / ui.scale;
  let best: Vec2 | null = null;
  let bestDist = radius;
  for (const s of store.project.surfaces) {
    if (s.id === exceptId) continue;
    for (const c of s.frame) {
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d < bestDist) { bestDist = d; best = c; }
    }
  }
  return best ? { x: best.x, y: best.y } : p;
}

/** Topmost surface under an output-space point, ignoring locked ones. */
export function surfaceAt(p: Vec2): Surface | null {
  const sorted = [...store.project.surfaces].sort((a, b) => b.z - a.z);
  for (const s of sorted) {
    if (!s.visible) continue;
    const inv = quadToUnit(s.frame);
    if (!inv) continue;
    const uv = apply(inv, p);
    if (uv && uv.x >= 0 && uv.x <= 1 && uv.y >= 0 && uv.y <= 1) return s;
  }
  return null;
}

export function selected(): Surface | null {
  const id = store.view.selectedSurfaceId;
  return id ? store.project.surfaces.find((s) => s.id === id) ?? null : null;
}

/**
 * Cria uma superfície com nome no idioma da interface.
 *
 * O nome vai para o `project.json` e é dado do projeto, não cópia de interface —
 * por isso a engine inventa um nome em inglês e quem sabe a língua do usuário é
 * quem passa o nome de verdade. Renomear depois não desfaz nada disso.
 */
export function addSurface(): void {
  const number = store.project.surfaces.length + 1;
  store.addSurface(newSurface(store.project, t('surfaces.defaultName', { number })));
}

export function duplicateSelected(): void {
  const s = selected();
  if (s) store.duplicateSurface(s.id, t('surfaces.copyOf', { name: s.name }));
}

export function flash(message: string): void {
  ui.status = message;
  setTimeout(() => { if (ui.status === message) ui.status = ''; }, 4000);
}
