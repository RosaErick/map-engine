<script lang="ts">
  import { store, ui, fitView, flash } from './state.svelte.ts';
  import { openFolder, save, downloadProject, hasFileSystemAccess, invalidateUrls } from './project-folder.ts';
  import { openOutput, listScreens, type OutputScreen } from '../output/output.ts';
  import { resolveUrl } from './project-folder.ts';
  import type { TestPattern } from '../engine/index.ts';

  const patterns: { id: TestPattern; label: string }[] = [
    { id: 'none', label: 'sem padrão' },
    { id: 'grid', label: 'grade' },
    { id: 'number', label: 'número' },
    { id: 'crosshair', label: 'cruz' },
    { id: 'white', label: 'branco' },
    { id: 'black', label: 'preto' },
    { id: 'bars', label: 'barras' },
    { id: 'sweep', label: 'varredura' },
  ];

  // Screens are enumerated up front: asking for them inside the click handler
  // would spend the user activation that window.open and requestFullscreen need.
  let screens = $state<OutputScreen[]>([]);
  let screenIndex = $state(0);
  let output: { close(): void } | null = null;

  $effect(() => {
    void listScreens().then((list) => {
      screens = list;
      if (list.length > 1) screenIndex = list.findIndex((s) => !s.isInternal) >= 0
        ? list.findIndex((s) => !s.isInternal)
        : 1;
    });
  });

  function screenLabel(s: OutputScreen, i: number): string {
    return `${i + 1}. ${s.label || (s.isInternal ? 'notebook' : 'externa')} ${s.width}x${s.height}`;
  }

  /** The output canvas must be the projector's native resolution: scaling twice
   *  blurs exactly what was aligned to the pixel. */
  function matchScreen(): void {
    const s = screens[screenIndex];
    if (!s) return;
    store.setOutputSize(Math.round(s.width * s.devicePixelRatio), Math.round(s.height * s.devicePixelRatio));
    flash(`Saída em ${store.project.output.width}x${store.project.output.height}.`);
  }

  async function onOpenFolder(): Promise<void> {
    try {
      const json = await openFolder();
      invalidateUrls();
      if (json) store.load(json);
      ui.folderName = 'pasta aberta';
      flash(json ? 'Projeto carregado.' : 'Pasta vazia: projeto novo.');
    } catch (e) {
      flash(String((e as Error).message ?? e));
    }
  }

  function onOutput(): void {
    if (output) { output.close(); output = null; return; }
    output = openOutput(store, {
      ...(screens[screenIndex] ? { screen: screens[screenIndex] } : {}),
      resolveUrl,
      onWarn: flash,
    });
  }
</script>

<header>
  <strong>Projection Mapping</strong>

  <button onclick={() => store.addSurface()}>+ superfície</button>
  <button class:on={ui.tool === 'polygon'} onclick={() => (ui.tool = ui.tool === 'polygon' ? 'select' : 'polygon')}>
    polígono
  </button>

  <span class="sep"></span>

  <button onclick={() => store.undo()} disabled={!store.canUndo} title="Ctrl+Z">desfazer</button>
  <button onclick={() => store.redo()} disabled={!store.canRedo} title="Ctrl+Shift+Z">refazer</button>

  <span class="sep"></span>

  <label class="inline" for="pattern">padrão</label>
  <select id="pattern" value={$store.view.testPattern} onchange={(e) => store.setTestPattern(e.currentTarget.value as TestPattern)}>
    {#each patterns as p (p.id)}<option value={p.id}>{p.label}</option>{/each}
  </select>

  <button class:on={ui.snap} onclick={() => (ui.snap = !ui.snap)} title="Segure Ctrl para desligar temporariamente">snap</button>

  <span class="sep"></span>

  <button onclick={onOpenFolder} disabled={!hasFileSystemAccess}>abrir pasta</button>
  <button onclick={() => save(store, (w) => flash(`Salvo em ${w}.`))}>salvar</button>
  {#if !hasFileSystemAccess}
    <button onclick={() => downloadProject(store)}>baixar json</button>
  {/if}

  <span class="sep"></span>

  {#if screens.length > 1}
    <select bind:value={screenIndex}>
      {#each screens as s, i (i)}<option value={i}>{screenLabel(s, i)}</option>{/each}
    </select>
    <button onclick={matchScreen} title="Casa a resolução do projeto com a da tela escolhida">casar resolução</button>
  {/if}
  <button onclick={onOutput}>saída</button>
  <button onclick={() => store.setView({ uiHidden: true })} title="H">esconder UI</button>

  <span class="sep"></span>

  <label class="inline" for="outw">saída</label>
  <input id="outw" type="number" class="num" value={$store.project.output.width}
    onchange={(e) => store.setOutputSize(+e.currentTarget.value, $store.project.output.height)} />
  <span class="muted">×</span>
  <input type="number" class="num" value={$store.project.output.height}
    onchange={(e) => store.setOutputSize($store.project.output.width, +e.currentTarget.value)} />

  <span class="grow"></span>
  <span class="muted">{ui.folderName}</span>
  <button onclick={() => { const el = document.querySelector('.stage') as HTMLElement | null; if (el) fitView(el.clientWidth, el.clientHeight); }}>
    enquadrar
  </button>
</header>

<style>
  header {
    display: flex; align-items: center; gap: 6px;
    padding: 8px; border-bottom: 1px solid var(--line);
    background: var(--panel); flex-wrap: wrap;
  }
  strong { margin-right: 8px; }
  .sep { width: 1px; height: 20px; background: var(--line); margin: 0 4px; }
  .grow { flex: 1; }
  .muted { color: var(--muted); }
  label.inline { display: inline; margin: 0; }
  .num { width: 72px; }
</style>
