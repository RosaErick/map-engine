<script lang="ts">
  import { onMount } from 'svelte';
  import Overlay from './Overlay.svelte';
  import Timeline from './Timeline.svelte';
  import { panZoom } from '../ui/actions.ts';
  import { store, viewport, tools, clampView, fitView, flash, getEngine, outputToFrame, setEngine, surfaceAt, toOutput, toScreen } from '../state.svelte.ts';
  import { createEngine, newId, newSurface, type Vec2, type Source } from '../../engine/index.ts';
  import { importFile, resolveUrl, loadModule } from '../platform/project-folder.ts';
  import { t } from '../i18n/index.svelte.ts';

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
    (window as unknown as { projMap: typeof engine }).projMap = engine;
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
    clampView(host.clientWidth, host.clientHeight);
  }

  function onZoom(factor: number, at: Vec2): void {
    const next = Math.min(8, Math.max(0.05, viewport.scale * factor));
    // Keep the point under the cursor fixed while zooming.
    const k = next / viewport.scale;
    viewport.tx = at.x - (at.x - viewport.tx) * k;
    viewport.ty = at.y - (at.y - viewport.ty) * k;
    viewport.scale = next;
    clampView(host.clientWidth, host.clientHeight);
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
    if (hit) {
      if (e.shiftKey || e.metaKey) store.toggleSelection(hit.id);
      else store.setSelection([hit.id]);
      return;
    }
    // Vazio: começa um laço. Sem modificador ele troca a seleção; com Shift,
    // acrescenta ao que já estava escolhido.
    marquee = { from: p, to: p, add: e.shiftKey || e.metaKey };
  }

  /**
   * Laço de seleção. Guardado em pixels de saída, e não de tela, para continuar
   * valendo se a vista mudar no meio do gesto.
   */
  let marquee = $state<{ from: Vec2; to: Vec2; add: boolean } | null>(null);

  function onPointerMove(e: PointerEvent): void {
    if (!marquee) return;
    const r = host.getBoundingClientRect();
    marquee = { ...marquee, to: toOutput({ x: e.clientX - r.left, y: e.clientY - r.top }) };
  }

  function onPointerUp(): void {
    if (!marquee) return;
    const { from, to, add } = marquee;
    marquee = null;
    const box = {
      x0: Math.min(from.x, to.x), x1: Math.max(from.x, to.x),
      y0: Math.min(from.y, to.y), y1: Math.max(from.y, to.y),
    };
    // Um clique no vazio é um laço de tamanho zero: limpa a seleção, que é o
    // que clicar fora sempre significou.
    if (box.x1 - box.x0 < 2 && box.y1 - box.y0 < 2) {
      if (!add) store.setSelection([]);
      return;
    }
    // Interseção, não contenção: numa parede cheia, exigir a superfície inteira
    // dentro do laço obrigaria a arrastar até fora do conteúdo.
    const caught = $store.project.surfaces
      .filter((s) => s.visible)
      .filter((s) => {
        const xs = s.frame.map((c) => c.x);
        const ys = s.frame.map((c) => c.y);
        return Math.min(...xs) <= box.x1 && Math.max(...xs) >= box.x0
          && Math.min(...ys) <= box.y1 && Math.max(...ys) >= box.y0;
      })
      .map((s) => s.id);
    store.setSelection(add ? [...$store.view.selectedIds, ...caught] : caught);
  }

  /** O laço em pixels de tela, para desenhar. */
  const marqueeBox = $derived.by(() => {
    if (!marquee) return null;
    const a = toScreen(marquee.from);
    const b = toScreen(marquee.to);
    return {
      left: Math.min(a.x, b.x), top: Math.min(a.y, b.y),
      width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y),
    };
  });

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
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
  onpointercancel={() => (marquee = null)}
  ondblclick={onDoubleClick}
  ondragover={(e) => { e.preventDefault(); dragOver = true; }}
  ondragleave={() => (dragOver = false)}
  ondrop={onDrop}
  role="application"
  aria-label={t('stage.label')}
>
  <canvas bind:this={canvas}></canvas>
  {#if marqueeBox}
    <div
      class="marquee"
      style:left="{marqueeBox.left}px" style:top="{marqueeBox.top}px"
      style:width="{marqueeBox.width}px" style:height="{marqueeBox.height}px"
    ></div>
  {/if}
  {#if !$store.view.uiHidden}
    <Overlay />
  {/if}
  <!-- Fora da guarda de propósito: a barra segura o relógio da timeline, e ela
       mesma esconde a própria marcação quando a interface está escondida.
       Desmontá-la aqui congelaria o show justo quando alguém apertou `H` para
       deixar a tela limpa. -->
  <Timeline />
  {#if tools.tool === 'polygon'}
    <div class="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
      <div class="rounded-full border border-base-300 bg-base-100/90 px-4 py-1.5 text-xs text-base-content/70 shadow-lg backdrop-blur">
        {t('stage.polygonHint')} <kbd class="kbd kbd-xs">{t('stage.polygonHintEsc')}</kbd> {t('stage.polygonHintCancel')}
      </div>
    </div>
  {/if}
</div>

<style>
  .marquee {
    position: absolute; pointer-events: none;
    border: 1px solid #52bdff; background: rgba(82, 189, 255, 0.12);
  }

  /* O fundo preto vem de .stage-surface (app.css): é pré-visualização do que sai
     do projetor, então não muda com o tema. */
  .drop { outline: 2px dashed #52bdff; outline-offset: -6px; }
  canvas { display: block; width: 100%; height: 100%; }
</style>
