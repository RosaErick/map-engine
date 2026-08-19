<script lang="ts">
  import { onMount } from 'svelte';
  import Overlay from './Overlay.svelte';
  import { panZoom } from './actions.ts';
  import { store, ui, setEngine, getEngine, fitView, toOutput, surfaceAt, flash } from './state.svelte.ts';
  import { createEngine, newId, newSurface, quadToUnit, apply, type Vec2, type Source } from '../engine/index.ts';
  import { importFile, resolveUrl, loadModule } from './project-folder.ts';

  let host: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let dragOver = $state(false);

  onMount(() => {
    const engine = createEngine(canvas, store.project, {
      store,
      resolveUrl,
      loadModule,
      devicePixelRatio: window.devicePixelRatio,
    });
    setEngine(engine);
    // ponytail: one global handle. It is what the smoke test reads pixels
    // through, and the console handle you want at 2am on site.
    (window as unknown as { engine: typeof engine }).engine = engine;
    engine.start();

    const ro = new ResizeObserver(() => {
      engine.resize(host.clientWidth, host.clientHeight);
    });
    ro.observe(host);
    fitView(host.clientWidth, host.clientHeight);

    return () => { ro.disconnect(); engine.dispose(); setEngine(null); };
  });

  // Pan/zoom is a view transform on the way to clip space, never a change to
  // the project's own coordinates.
  $effect(() => {
    const { scale, tx, ty } = ui;
    getEngine()?.setView({ scale, tx, ty });
  });

  function onPan(delta: Vec2): void {
    ui.tx += delta.x;
    ui.ty += delta.y;
  }

  function onZoom(factor: number, at: Vec2): void {
    const next = Math.min(8, Math.max(0.05, ui.scale * factor));
    // Keep the point under the cursor fixed while zooming.
    const k = next / ui.scale;
    ui.tx = at.x - (at.x - ui.tx) * k;
    ui.ty = at.y - (at.y - ui.ty) * k;
    ui.scale = next;
  }

  function onPointerDown(e: PointerEvent): void {
    if (e.button !== 0 || e.altKey) return;
    const r = host.getBoundingClientRect();
    const p = toOutput({ x: e.clientX - r.left, y: e.clientY - r.top });

    if (ui.tool === 'polygon') {
      ui.pendingPolygon = [...ui.pendingPolygon, p];
      return;
    }
    const hit = surfaceAt(p);
    store.setView({ selectedSurfaceId: hit?.id ?? null, selectedCorner: null });
  }

  function onDoubleClick(): void {
    if (ui.tool === 'polygon') finishPolygon();
  }

  /**
   * A freehand polygon becomes a normal surface: its bounding box is the frame,
   * and the traced points are converted into frame space through the inverse
   * homography. Nothing downstream needs a polygon-specific code path.
   */
  function finishPolygon(): void {
    const pts = ui.pendingPolygon;
    ui.pendingPolygon = [];
    ui.tool = 'select';
    if (pts.length < 3) return;

    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    const y0 = Math.min(...ys), y1 = Math.max(...ys);
    const surface = newSurface(store.project);
    surface.frame = [
      { x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 },
    ];
    const inv = quadToUnit(surface.frame);
    if (!inv) return;
    const local = pts.map((p) => apply(inv, p)).filter((p): p is Vec2 => p !== null);
    if (local.length < 3) return;
    surface.shape = { kind: 'polygon', points: local };
    store.addSurface(surface);
  }

  /** Dropping media onto a surface is the fourth step of the 60-second flow. */
  async function onDrop(e: DragEvent): Promise<void> {
    e.preventDefault();
    dragOver = false;
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    const r = host.getBoundingClientRect();
    const target = surfaceAt(toOutput({ x: e.clientX - r.left, y: e.clientY - r.top }));
    if (!target) { flash('Solte o arquivo em cima de uma superfície.'); return; }

    const kind = kindOf(file);
    if (!kind) { flash(`Tipo de arquivo não suportado: ${file.name}`); return; }
    const path = await importFile(file);
    const source = describe(kind, path, file.name);
    store.addSource(source);
    store.setSurfaceSource(target.id, source.id);
  }

  function kindOf(file: File): 'image' | 'video' | 'gif' | null {
    if (file.type === 'image/gif') return 'gif';
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('image/')) return 'image';
    return null;
  }

  function describe(kind: 'image' | 'video' | 'gif', path: string, name: string): Source {
    const id = newId('src');
    if (kind === 'video') return { id, name, kind, path, loop: true, muted: true, rate: 1 };
    return { id, name, kind, path };
  }
</script>

<div
  class="stage"
  class:drop={dragOver}
  data-stage
  bind:this={host}
  use:panZoom={{ onPan, onZoom }}
  onpointerdown={onPointerDown}
  ondblclick={onDoubleClick}
  ondragover={(e) => { e.preventDefault(); dragOver = true; }}
  ondragleave={() => (dragOver = false)}
  ondrop={onDrop}
  role="application"
  aria-label="Área de mapeamento"
>
  <canvas bind:this={canvas}></canvas>
  {#if !$store.view.uiHidden}
    <Overlay />
  {/if}
  {#if ui.tool === 'polygon'}
    <div class="hint">Clique para traçar o polígono · duplo clique para fechar · Esc cancela</div>
  {/if}
</div>

<style>
  .stage { position: relative; flex: 1; min-width: 0; background: #000; overflow: hidden; }
  .stage.drop { outline: 2px dashed var(--accent); outline-offset: -6px; }
  canvas { display: block; width: 100%; height: 100%; }
  .hint {
    position: absolute; top: 10px; left: 50%; transform: translateX(-50%);
    background: var(--panel-2); border: 1px solid var(--line);
    padding: 6px 10px; border-radius: 999px; color: var(--muted);
  }
</style>
