import type { Vec2 } from './homography.ts';

export type { Vec2 };

export type Source =
  | { id: string; name: string; kind: 'image'; path: string }
  | { id: string; name: string; kind: 'video'; path: string; loop: boolean; muted: boolean; rate: number }
  | { id: string; name: string; kind: 'gif'; path: string }
  | { id: string; name: string; kind: 'color'; rgb: [number, number, number] }
  | { id: string; name: string; kind: 'capture' }
  | { id: string; name: string; kind: 'camera'; deviceId?: string }
  | { id: string; name: string; kind: 'canvas'; moduleId: string };

export type SourceKind = Source['kind'];

export type Shape =
  | { kind: 'quad' }
  | { kind: 'ellipse'; feather: number }
  | { kind: 'polygon'; points: Vec2[] }; // normalised 0..1 in frame space

export type Fit = 'stretch' | 'contain' | 'cover';
export type Blend = 'normal' | 'add' | 'screen' | 'multiply';

export interface Surface {
  id: string;
  name: string;
  frame: [Vec2, Vec2, Vec2, Vec2]; // TL, TR, BR, BL — output pixels
  shape: Shape;
  sourceId: string | null;
  crop: { x: number; y: number; w: number; h: number }; // 0..1 inside the source
  fit: Fit;
  /** Content rotation inside the frame, in degrees clockwise. The frame keeps
   *  the perspective; this only spins what is sampled into it. */
  rotation: number;
  opacity: number;
  blend: Blend;
  locked: boolean;
  visible: boolean;
  z: number;
}

export interface Project {
  version: 1;
  output: { width: number; height: number };
  sources: Source[];
  surfaces: Surface[];
}

/** Non-persisted view state: solo lives here because it is a rehearsal aid,
 *  not part of the show. DECISION: keeping it out of Project means reopening a
 *  folder never leaves you staring at a single soloed surface. */
export interface ViewState {
  soloId: string | null;
  selectedSurfaceId: string | null;
  selectedCorner: number | null;
  /** Applies to every surface without one of its own. */
  testPattern: TestPattern;
  /** Per-surface override, by id. Absence means "follow the global one", and an
   *  explicit `'none'` blanks the pattern on that surface alone. */
  surfacePatterns: Record<string, TestPattern>;
  uiHidden: boolean;
}

export type TestPattern =
  | 'none' | 'grid' | 'number' | 'crosshair'
  | 'white' | 'black' | 'bars' | 'sweep';

let counter = 0;
/** Ids only need to be unique within a project, and projects are single-user
 *  files. ponytail: no uuid dependency; crypto.randomUUID when available. */
export function newId(prefix = 'id'): string {
  const rand = globalThis.crypto?.randomUUID?.().slice(0, 8) ?? (++counter).toString(36);
  return `${prefix}_${rand}`;
}

export function emptyProject(width = 1920, height = 1080): Project {
  return { version: 1, output: { width, height }, sources: [], surfaces: [] };
}

/** A fresh surface centred in the output, sized to a quarter of it. */
export function newSurface(project: Project, name?: string): Surface {
  const { width, height } = project.output;
  const w = width / 4;
  const h = height / 4;
  const cx = width / 2;
  const cy = height / 2;
  const n = project.surfaces.length + 1;
  return {
    id: newId('surf'),
    name: name ?? `Surface ${n}`,
    frame: [
      { x: cx - w / 2, y: cy - h / 2 },
      { x: cx + w / 2, y: cy - h / 2 },
      { x: cx + w / 2, y: cy + h / 2 },
      { x: cx - w / 2, y: cy + h / 2 },
    ],
    shape: { kind: 'quad' },
    sourceId: null,
    crop: { x: 0, y: 0, w: 1, h: 1 },
    fit: 'stretch',
    rotation: 0,
    opacity: 1,
    blend: 'normal',
    locked: false,
    visible: true,
    z: n,
  };
}

const DEFAULT_SURFACE = {
  shape: { kind: 'quad' } as Shape,
  sourceId: null,
  crop: { x: 0, y: 0, w: 1, h: 1 },
  fit: 'stretch' as Fit,
  rotation: 0,
  opacity: 1,
  blend: 'normal' as Blend,
  locked: false,
  visible: true,
  z: 0,
};

/**
 * Parse untrusted JSON into a Project, filling defaults and dropping garbage.
 *
 * This is a trust boundary: the input is a file on disk that a user may have
 * hand-edited or that an older build wrote. Anything unrecognised is dropped
 * rather than allowed to reach the renderer, where a NaN corner would blank
 * the projector mid-show.
 */
export function parseProject(raw: unknown): Project {
  if (!isRecord(raw)) throw new Error('project.json is not an object');
  const version = raw['version'];
  if (version !== 1) throw new Error(`unsupported project version: ${String(version)}`);

  const out = isRecord(raw['output']) ? raw['output'] : {};
  const project: Project = {
    version: 1,
    output: {
      width: num(out['width'], 1920),
      height: num(out['height'], 1080),
    },
    sources: asArray(raw['sources']).map(parseSource).filter((s): s is Source => s !== null),
    surfaces: [],
  };

  const sourceIds = new Set(project.sources.map((s) => s.id));
  project.surfaces = asArray(raw['surfaces'])
    .map((s) => parseSurface(s, sourceIds))
    .filter((s): s is Surface => s !== null);
  return project;
}

function parseSource(raw: unknown): Source | null {
  if (!isRecord(raw)) return null;
  const id = str(raw['id'], '');
  const kind = raw['kind'];
  if (!id || typeof kind !== 'string') return null;
  const name = str(raw['name'], id);
  switch (kind) {
    case 'image':
    case 'gif':
      return { id, name, kind, path: str(raw['path'], '') };
    case 'video':
      return {
        id, name, kind,
        path: str(raw['path'], ''),
        loop: bool(raw['loop'], true),
        muted: bool(raw['muted'], true),
        rate: num(raw['rate'], 1),
      };
    case 'color': {
      const rgb = asArray(raw['rgb']).map((v) => clamp(num(v, 0), 0, 255));
      return { id, name, kind, rgb: [rgb[0] ?? 255, rgb[1] ?? 255, rgb[2] ?? 255] };
    }
    case 'capture':
      return { id, name, kind };
    case 'camera': {
      const deviceId = str(raw['deviceId'], '');
      return deviceId ? { id, name, kind, deviceId } : { id, name, kind };
    }
    case 'canvas':
      return { id, name, kind, moduleId: str(raw['moduleId'], '') };
    default:
      return null;
  }
}

function parseSurface(raw: unknown, sourceIds: ReadonlySet<string>): Surface | null {
  if (!isRecord(raw)) return null;
  const id = str(raw['id'], '');
  if (!id) return null;
  const frame = parseFrame(raw['frame']);
  if (!frame) return null;
  const sourceId = str(raw['sourceId'], '');
  return {
    ...DEFAULT_SURFACE,
    id,
    name: str(raw['name'], id),
    frame,
    shape: parseShape(raw['shape']),
    // A dangling source reference becomes "no source" — the surface then draws
    // the missing-media pattern instead of stale content.
    sourceId: sourceId && sourceIds.has(sourceId) ? sourceId : null,
    crop: parseCrop(raw['crop']),
    fit: oneOf(raw['fit'], ['stretch', 'contain', 'cover'] as const, 'stretch'),
    rotation: normalizeAngle(num(raw['rotation'], 0)),
    opacity: clamp(num(raw['opacity'], 1), 0, 1),
    blend: oneOf(raw['blend'], ['normal', 'add', 'screen', 'multiply'] as const, 'normal'),
    locked: bool(raw['locked'], false),
    visible: bool(raw['visible'], true),
    z: num(raw['z'], 0),
  };
}

function parseFrame(raw: unknown): [Vec2, Vec2, Vec2, Vec2] | null {
  const arr = asArray(raw);
  if (arr.length !== 4) return null;
  const pts = arr.map(parseVec2);
  if (pts.some((p) => p === null)) return null;
  return pts as [Vec2, Vec2, Vec2, Vec2];
}

function parseVec2(raw: unknown): Vec2 | null {
  if (!isRecord(raw)) return null;
  const x = num(raw['x'], NaN);
  const y = num(raw['y'], NaN);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function parseShape(raw: unknown): Shape {
  if (!isRecord(raw)) return { kind: 'quad' };
  if (raw['kind'] === 'ellipse') return { kind: 'ellipse', feather: clamp(num(raw['feather'], 0), 0, 1) };
  if (raw['kind'] === 'polygon') {
    const points = asArray(raw['points']).map(parseVec2).filter((p): p is Vec2 => p !== null);
    return points.length >= 3 ? { kind: 'polygon', points } : { kind: 'quad' };
  }
  return { kind: 'quad' };
}

function parseCrop(raw: unknown): { x: number; y: number; w: number; h: number } {
  if (!isRecord(raw)) return { x: 0, y: 0, w: 1, h: 1 };
  return {
    x: clamp(num(raw['x'], 0), 0, 1),
    y: clamp(num(raw['y'], 0), 0, 1),
    w: clamp(num(raw['w'], 1), 0, 1),
    h: clamp(num(raw['h'], 1), 0, 1),
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}
function str(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback;
}
function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}
function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback;
}
/** Degrees folded into [0, 360). Keeps the UI slider and the shader in the same
 *  range no matter how many turns a caller accumulated. */
export function normalizeAngle(deg: number): number {
  const a = deg % 360;
  return a < 0 ? a + 360 : a;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
