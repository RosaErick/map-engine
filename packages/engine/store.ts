import {
  emptyProject, newSurface, newId, parseProject, clamp, normalizeAngle,
  type Project, type Source, type Surface, type Shape, type Vec2, type ViewState, type TestPattern,
} from './project.ts';

export interface StoreState {
  project: Project;
  view: ViewState;
}

type Listener = (state: StoreState) => void;

/** Undo grouping. A corner drag fires dozens of mutations; they must collapse
 *  into one history entry or ctrl+Z becomes useless. Pass the same
 *  `coalesce` key for the whole gesture. */
export interface MutateOpts {
  history?: 'push' | 'none';
  coalesce?: string;
}

const HISTORY_LIMIT = 100;

/**
 * The single source of truth. Everything mutates through methods here, which
 * is what makes an OSC/MIDI bridge later a pure adapter: it calls the same
 * methods the editor calls.
 *
 * `subscribe` matches the Svelte store contract exactly (call immediately,
 * return an unsubscriber) so the editor can write `$store` with no adapter,
 * while this file stays free of any framework import.
 */
export class Store {
  #state: StoreState;
  #listeners = new Set<Listener>();
  #undo: Project[] = [];
  #redo: Project[] = [];
  #lastCoalesce: string | null = null;

  constructor(project: Project = emptyProject()) {
    this.#state = {
      project,
      view: {
        soloId: null,
        selectedSurfaceId: null,
        selectedCorner: null,
        testPattern: 'none',
        surfacePatterns: {},
        uiHidden: false,
      },
    };
  }

  get state(): StoreState { return this.#state; }
  get project(): Project { return this.#state.project; }
  get view(): ViewState { return this.#state.view; }

  subscribe(fn: Listener): () => void {
    this.#listeners.add(fn);
    fn(this.#state);
    return () => { this.#listeners.delete(fn); };
  }

  #emit(): void {
    for (const fn of this.#listeners) fn(this.#state);
  }

  /** Every project mutation funnels through here — history and notification
   *  happen in exactly one place. */
  mutate(fn: (draft: Project) => void, opts: MutateOpts = {}): void {
    const { history = 'push', coalesce } = opts;
    const before = this.#state.project;
    if (history === 'push') {
      const sameGesture = coalesce !== undefined && coalesce === this.#lastCoalesce;
      if (!sameGesture) {
        this.#undo.push(before);
        if (this.#undo.length > HISTORY_LIMIT) this.#undo.shift();
        this.#redo = [];
      }
      this.#lastCoalesce = coalesce ?? null;
    }
    const draft = structuredClone(before);
    fn(draft);
    this.#state = { ...this.#state, project: draft };
    this.#emit();
  }

  /** Ends a coalescing gesture so the next mutation starts a new history entry. */
  endGesture(): void { this.#lastCoalesce = null; }

  setView(patch: Partial<ViewState>): void {
    this.#state = { ...this.#state, view: { ...this.#state.view, ...patch } };
    this.#emit();
  }

  // --- project lifecycle ---------------------------------------------------

  load(json: unknown): void {
    const project = typeof json === 'string' ? parseProject(JSON.parse(json)) : parseProject(json);
    this.#undo = [];
    this.#redo = [];
    this.#lastCoalesce = null;
    this.#state = {
      project,
      view: { ...this.#state.view, selectedSurfaceId: null, selectedCorner: null, soloId: null },
    };
    this.#emit();
  }

  toJSON(): string { return JSON.stringify(this.#state.project, null, 2); }

  setOutputSize(width: number, height: number): void {
    this.mutate((p) => { p.output = { width, height }; });
  }

  // --- history -------------------------------------------------------------

  undo(): void {
    const prev = this.#undo.pop();
    if (!prev) return;
    this.#redo.push(this.#state.project);
    this.#lastCoalesce = null;
    this.#state = { ...this.#state, project: prev };
    this.#emit();
  }

  redo(): void {
    const next = this.#redo.pop();
    if (!next) return;
    this.#undo.push(this.#state.project);
    this.#lastCoalesce = null;
    this.#state = { ...this.#state, project: next };
    this.#emit();
  }

  get canUndo(): boolean { return this.#undo.length > 0; }
  get canRedo(): boolean { return this.#redo.length > 0; }

  // --- surfaces ------------------------------------------------------------

  addSurface(surface?: Surface): Surface {
    const s = surface ?? newSurface(this.#state.project);
    this.mutate((p) => { p.surfaces.push(s); });
    this.setView({ selectedSurfaceId: s.id, selectedCorner: null });
    return s;
  }

  removeSurface(id: string): void {
    this.mutate((p) => { p.surfaces = p.surfaces.filter((s) => s.id !== id); });
    const { [id]: _dropped, ...surfacePatterns } = this.#state.view.surfacePatterns;
    const patch: Partial<ViewState> = { surfacePatterns };
    // An orphan override would resurface on a future surface reusing the id.
    if (this.#state.view.selectedSurfaceId === id) {
      patch.selectedSurfaceId = null;
      patch.selectedCorner = null;
    }
    if (this.#state.view.soloId === id) patch.soloId = null;
    this.setView(patch);
  }

  /** `name` lets the host localise the copy's name; the default stays English,
   *  like every other value the engine invents on its own. */
  duplicateSurface(id: string, name?: string): void {
    const src = this.#state.project.surfaces.find((s) => s.id === id);
    if (!src) return;
    const copy = structuredClone(src);
    copy.id = newId('surf');
    copy.name = name ?? `${src.name} copy`;
    copy.z = this.#state.project.surfaces.length + 1;
    // Offset so the copy is grabbable instead of hiding exactly behind the original.
    for (const c of copy.frame) { c.x += 24; c.y += 24; }
    this.addSurface(copy);
  }

  /** Locked surfaces reject geometry edits — this is the guard that makes the
   *  lock affordance real, and it lives here so every caller inherits it. */
  #editable(id: string): boolean {
    const s = this.#state.project.surfaces.find((x) => x.id === id);
    return !!s && !s.locked;
  }

  /**
   * Generic patch. Geometry is stripped for a locked surface: the lock has to
   * hold for every caller, including the external-control adapter that this
   * class exists to make possible — that adapter would otherwise walk straight
   * through the one affordance nobody can afford to lose. Name, visibility and
   * `locked` itself still apply, or a locked surface could never be unlocked.
   */
  patchSurface(id: string, patch: Partial<Surface>, opts?: MutateOpts): void {
    const geometryBlocked = !this.#editable(id);
    this.mutate((p) => {
      const s = p.surfaces.find((x) => x.id === id);
      if (!s) return;
      const applied = { ...patch };
      if (geometryBlocked) delete applied.frame;
      Object.assign(s, applied);
    }, opts);
  }

  setCorner(id: string, corner: number, pos: Vec2): void {
    if (!this.#editable(id)) return;
    this.mutate((p) => {
      const s = p.surfaces.find((x) => x.id === id);
      if (s && s.frame[corner]) s.frame[corner] = { x: pos.x, y: pos.y };
    }, { coalesce: `corner:${id}:${corner}` });
  }

  nudgeCorner(id: string, corner: number, dx: number, dy: number): void {
    if (!this.#editable(id)) return;
    this.mutate((p) => {
      const s = p.surfaces.find((x) => x.id === id);
      const c = s?.frame[corner];
      if (c) { c.x += dx; c.y += dy; }
    }, { coalesce: `nudge:${id}:${corner}` });
  }

  moveSurface(id: string, dx: number, dy: number): void {
    if (!this.#editable(id)) return;
    this.mutate((p) => {
      const s = p.surfaces.find((x) => x.id === id);
      if (!s) return;
      for (const c of s.frame) { c.x += dx; c.y += dy; }
    }, { coalesce: `move:${id}` });
  }

  setSurfaceFrame(id: string, corners: [Vec2, Vec2, Vec2, Vec2]): void {
    if (!this.#editable(id)) return;
    this.mutate((p) => {
      const s = p.surfaces.find((x) => x.id === id);
      if (s) s.frame = structuredClone(corners);
    });
  }

  /** Recorte dentro da fonte, em 0..1. */
  setCrop(id: string, crop: Partial<Surface['crop']>): void {
    this.mutate((p) => {
      const s = p.surfaces.find((x) => x.id === id);
      if (!s) return;
      const next = { ...s.crop, ...crop };
      // A window with no width or height would sample nothing at all.
      s.crop = {
        x: clamp(next.x, 0, 1),
        y: clamp(next.y, 0, 1),
        w: clamp(next.w, 0.01, 1),
        h: clamp(next.h, 0.01, 1),
      };
    }, { coalesce: `crop:${id}` });
  }

  /**
   * Moves one vertex of a traced polygon, in frame space.
   *
   * Locked applies here for the same reason it applies to a corner: the shape
   * is what sits on the physical object, and nudging it is as destructive as
   * nudging the frame.
   */
  setPolygonPoint(id: string, index: number, point: Vec2): void {
    if (!this.#editable(id)) return;
    this.mutate((p) => {
      const s = p.surfaces.find((x) => x.id === id);
      if (s?.shape.kind !== 'polygon') return;
      const target = s.shape.points[index];
      if (!target) return;
      s.shape.points[index] = { x: point.x, y: point.y };
    }, { coalesce: `poly:${id}:${index}` });
  }

  setSurfaceShape(id: string, shape: Shape): void {
    this.mutate((p) => {
      const s = p.surfaces.find((x) => x.id === id);
      if (s) s.shape = shape;
    });
  }

  setSurfaceSource(id: string, sourceId: string | null): void {
    this.mutate((p) => {
      const s = p.surfaces.find((x) => x.id === id);
      if (s) s.sourceId = sourceId;
    });
  }

  toggleLock(id: string): void {
    const s = this.#state.project.surfaces.find((x) => x.id === id);
    if (s) this.patchSurface(id, { locked: !s.locked });
  }

  toggleVisible(id: string): void {
    const s = this.#state.project.surfaces.find((x) => x.id === id);
    if (s) this.patchSurface(id, { visible: !s.visible });
  }

  toggleSolo(id: string): void {
    this.setView({ soloId: this.#state.view.soloId === id ? null : id });
  }

  /** Spins the content inside the frame. The frame itself, and therefore the
   *  alignment with the physical object, is untouched — so this is safe on a
   *  locked surface, unlike anything that moves a corner. */
  setRotation(id: string, degrees: number): void {
    this.patchSurface(id, { rotation: normalizeAngle(degrees) }, { coalesce: `rotation:${id}` });
  }

  setOpacity(id: string, opacity: number): void {
    this.patchSurface(id, { opacity: clamp(opacity, 0, 1) }, { coalesce: `opacity:${id}` });
  }

  reorder(id: string, z: number): void {
    this.patchSurface(id, { z });
  }

  // --- sources -------------------------------------------------------------

  addSource(source: Source): Source {
    this.mutate((p) => { p.sources.push(source); });
    return source;
  }

  removeSource(id: string): void {
    this.mutate((p) => {
      p.sources = p.sources.filter((s) => s.id !== id);
      for (const s of p.surfaces) if (s.sourceId === id) s.sourceId = null;
    });
  }

  patchSource(id: string, patch: Partial<Source>): void {
    this.mutate((p) => {
      const s = p.sources.find((x) => x.id === id);
      if (s) Object.assign(s, patch);
    });
  }

  /** Global pattern, for every surface without an override. */
  setTestPattern(pattern: TestPattern): void {
    this.setView({ testPattern: pattern });
  }

  /** This surface only. `null` hands control back to the global pattern. */
  setSurfacePattern(id: string, pattern: TestPattern | null): void {
    const next = { ...this.#state.view.surfacePatterns };
    if (pattern === null) delete next[id];
    else next[id] = pattern;
    this.setView({ surfacePatterns: next });
  }
}

/**
 * The pattern in force for a surface: its own if it has one, else the global.
 *
 * Aligning happens one surface at a time — grid on this, number on that, none
 * elsewhere. The global one stays because "grid on everything" is the common
 * case, and switching each surface on by hand would be worse.
 */
export function patternFor(state: StoreState, surfaceId: string): TestPattern {
  return state.view.surfacePatterns[surfaceId] ?? state.view.testPattern;
}

/** Surfaces the renderer should draw, in z order, honouring solo and visible. */
export function visibleSurfaces(state: StoreState): Surface[] {
  const { project, view } = state;
  const list = view.soloId
    ? project.surfaces.filter((s) => s.id === view.soloId)
    : project.surfaces.filter((s) => s.visible);
  return [...list].sort((a, b) => a.z - b.z);
}
