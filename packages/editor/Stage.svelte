<script lang="ts">
  import { onMount } from 'svelte';
  import Overlay from './Overlay.svelte';
  import { panZoom } from './actions.ts';
  import { store, viewport, tools, fitView, flash, getEngine, outputToFrame, setEngine, surfaceAt, toOutput } from './state.svelte.ts';
  import { createEngine, newId, newSurface, type Vec2, type Source } from '../engine/index.ts';
  import { importFile, resolveUrl, loadModule } from './project-folder.ts';
  import { t } from './i18n/index.svelte.ts';

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
    // ponytail: one global handle, deliberately kept in production builds. It
    // is what the smoke test reads pixels through — gating it behind a dev flag
    // would leave the shipped build untested — and it is the console handle you
    // want at 2am on site. Namespaced so an embedding page keeps its own.
    // It grants nothing a user canvas module could not already do.
    (window as unknown as { mapEngine: typeof engine }).mapEngine = engine;
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
    const { scale, tx, ty } = viewport;
    getEngine()?.setView({ scale, tx, ty });
  });

  function onPan(delta: Vec2): void {
    viewport.tx += delta.x;
    viewport.ty += delta.y;
  }

  function onZoom(factor: number, at: Vec2): void {
    const next = Math.min(8, Math.max(0.05, viewport.scale * factor));
    // Keep the point under the cursor fixed while zooming.
    const k = next / viewport.scale;
    viewport.tx = at.x - (at.x - viewport.tx) * k;
    viewport.ty = at.y - (at.y - viewport.ty) * k;
    viewport.scale = next;
  }

  function onPointerDown(e: PointerEvent): void {
    if (e.button !== 0 || e.altKey) return;
    const r = host.getBoundingClientRect();
    const p = toOutput({ x: e.clientX - r.left, y: e.clientY - r.top });

    if (tools.tool === 'polygon') {
      tools.pendingPolygon = [...tools.pendingPolygon, p];
      return;
    }
    const hit = surfaceAt(p);
    store.setView({ selectedSurfaceId: hit?.id ?? null, selectedCorner: null });
  }

  function onDoubleClick(): void {
    if (tools.tool === 'polygon') finishPolygon();
  }

  /**
   * A freehand polygon becomes a normal surface: its bounding box is the frame,
   * and the traced points are converted into frame space through the inverse
   * homography. Nothing downstream needs a polygon-specific code path.
   */
  function finishPolygon(): void {
    const pts = tools.pendingPolygon;
    tools.pendingPolygon = [];
    tools.tool = 'select';
    if (pts.length < 3) return;

    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    const y0 = Math.min(...ys), y1 = Math.max(...ys);
    const surface = newSurface(store.project);
    surface.frame = [
      { x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 },
    ];
    const local = pts
      .map((p) => outputToFrame(surface, p))
      .filter((p): p is Vec2 => p !== null);
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
    if (!target) { flash(t('stage.dropOnSurface')); return; }

    const kind = kindOf(file);
    if (!kind) { flash(t('stage.unsupportedFile', { name: file.name })); return; }
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
  class="stage-surface relative min-w-0 flex-1 overflow-hidden"
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
  aria-label={t('stage.label')}
>
  <canvas bind:this={canvas}></canvas>
  {#if !$store.view.uiHidden}
    <Overlay />
  {/if}
  {#if tools.tool === 'polygon'}
    <div class="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
      <div class="rounded-full border border-base-300 bg-base-100/90 px-4 py-1.5 text-xs text-base-content/70 shadow-lg backdrop-blur">
        {t('stage.polygonHint')} <kbd class="kbd kbd-xs">{t('stage.polygonHintEsc')}</kbd> {t('stage.polygonHintCancel')}
      </div>
    </div>
  {/if}
</div>

<style>
  /* O fundo preto vem de .stage-surface (app.css): é pré-visualização do que sai
     do projetor, então não muda com o tema. */
  .drop { outline: 2px dashed #52bdff; outline-offset: -6px; }
  canvas { display: block; width: 100%; height: 100%; }
</style>
