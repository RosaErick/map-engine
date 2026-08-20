import type { CanvasModule, Store } from '../engine/index.ts';
import { createSaver, safeName, type Saver } from './saver.ts';

/**
 * A project is a folder, not a file: `project.json` with relative paths and the
 * media sitting next to it. That is what survives being copied to a USB stick
 * and carried to the venue.
 *
 * Where the File System Access API is missing we degrade loudly: media stays in
 * memory as blob URLs for the session and the project JSON is kept in
 * localStorage, so nothing is lost on a refresh but the media links do not
 * survive a restart. The user is told, never left to discover it on site.
 */

type DirHandle = FileSystemDirectoryHandle;

const LOCAL_KEY = 'map-engine:project';

/** Falha que o usuário precisa entender. O texto é escolhido por quem tem o
 *  catálogo — este módulo só diz o que aconteceu. */
export class FolderError extends Error {
  constructor(readonly code: 'unsupported') { super(code); }
}

export const hasFileSystemAccess = typeof (globalThis as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function';

let dir: DirHandle | null = null;
const urlCache = new Map<string, string>();
/** Session-only media for the no-folder fallback, keyed by the same relative path. */
const memoryFiles = new Map<string, File>();

export function folderName(): string { return dir?.name ?? ''; }

export async function openFolder(): Promise<string | null> {
  if (!hasFileSystemAccess) throw new FolderError('unsupported');
  const picker = (globalThis as unknown as {
    showDirectoryPicker(opts: { mode: 'readwrite' }): Promise<DirHandle>;
  }).showDirectoryPicker;
  dir = await picker({ mode: 'readwrite' });
  urlCache.clear();
  try {
    const file = await (await dir.getFileHandle('project.json')).getFile();
    return await file.text();
  } catch {
    return null; // an empty folder is a new project, not an error
  }
}

/** Relative path -> a URL the browser can fetch. Throws when the file is gone,
 *  which is what makes the surface show the missing-media pattern. */
export async function resolveUrl(path: string): Promise<string> {
  // Um caminho que já é URL não é um caminho relativo à pasta: `data:`, `blob:`
  // e `http(s):` passam direto, senão o resolvedor procuraria um arquivo com
  // aquele nome e a superfície acenderia o padrão de mídia faltando.
  if (/^(data|blob|https?):/.test(path)) return path;

  const cached = urlCache.get(path);
  if (cached) return cached;

  const mem = memoryFiles.get(path);
  if (mem) {
    const url = URL.createObjectURL(mem);
    urlCache.set(path, url);
    return url;
  }
  if (!dir) throw new Error(`no project folder: ${path}`);

  // Paths are relative and may contain folders: walk the segments.
  const parts = path.split('/').filter(Boolean);
  const name = parts.pop()!;
  let d = dir;
  for (const part of parts) d = await d.getDirectoryHandle(part);
  const file = await (await d.getFileHandle(name)).getFile();
  const url = URL.createObjectURL(file);
  urlCache.set(path, url);
  return url;
}

/** Copies a dropped file into the project folder and returns its relative path. */
export async function importFile(file: File): Promise<string> {
  const path = safeName(file.name);
  if (dir) {
    const handle = await dir.getFileHandle(path, { create: true });
    const writable = await handle.createWritable();
    await writable.write(file);
    await writable.close();
  } else {
    memoryFiles.set(path, file);
  }
  urlCache.delete(path);
  return path;
}

/** Loads a user canvas module from the folder. */
export async function loadModule(moduleId: string): Promise<CanvasModule> {
  const url = await resolveUrl(moduleId.endsWith('.js') ? moduleId : `${moduleId}.js`);
  const mod = (await import(/* @vite-ignore */ url)) as Partial<CanvasModule>;
  if (typeof mod.draw !== 'function') throw new Error('module has no draw(ctx, t)');
  return mod as CanvasModule;
}

/**
 * Autosave. A lógica de espera e de escrita concorrente mora em `saver.ts`,
 * testada com um escritor falso; aqui fica só a parte que precisa de navegador.
 *
 * Perder meia hora de alinhamento por causa de um crash é inaceitável numa
 * ferramenta de montagem — por isso o salvamento não depende de ninguém lembrar
 * de apertar nada.
 */
const AUTOSAVE_MS = 400;

let saver: Saver | null = null;
let saverStore: Store | null = null;

/** Rótulo usado quando não há pasta. Injetado porque a palavra é do catálogo. */
let memoryLabel = 'browser memory';
export function setMemoryLabel(label: string): void { memoryLabel = label; }

function saverFor(
  store: Store,
  onSaved?: (where: string) => void,
  onError?: (message: string) => void,
): Saver {
  // Um saver por store: trocar de projeto não pode arrastar uma escrita pendente
  // do projeto anterior.
  if (saver && saverStore === store) return saver;
  saver?.cancel();
  saverStore = store;
  saver = createSaver({
    delay: AUTOSAVE_MS,
    read: () => store.toJSON(),
    write: async (contents) => {
      if (dir) {
        const handle = await dir.getFileHandle('project.json', { create: true });
        const writable = await handle.createWritable();
        await writable.write(contents);
        await writable.close();
      } else {
        localStorage.setItem(LOCAL_KEY, contents);
      }
    },
    onSaved: () => onSaved?.(dir ? dir.name : memoryLabel),
    onError: (error) => onError?.(`Não consegui salvar: ${String((error as Error).message ?? error)}`),
  });
  return saver;
}

export function scheduleSave(
  store: Store,
  onSaved?: (where: string) => void,
  onError?: (message: string) => void,
): void {
  saverFor(store, onSaved, onError).schedule();
}

export async function save(
  store: Store,
  onSaved?: (where: string) => void,
  onError?: (message: string) => void,
): Promise<void> {
  await saverFor(store, onSaved, onError).flush();
}

/** Project JSON kept in localStorage by the fallback path, if any. */
export function localProject(): string | null {
  try { return localStorage.getItem(LOCAL_KEY); } catch { return null; }
}

/** Manual export for the no-folder case: a plain download of project.json. */
export function downloadProject(store: Store): void {
  const blob = new Blob([store.toJSON()], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'project.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Media the engine may still be holding a URL for, dropped on folder change. */
export function invalidateUrls(): void {
  for (const url of urlCache.values()) URL.revokeObjectURL(url);
  urlCache.clear();
}
