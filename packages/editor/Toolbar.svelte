<script lang="ts">
  import { store, ui, fitView } from './state.svelte.ts';
  import type { TestPattern } from '../engine/index.ts';
  import { PATTERNS } from './patterns.ts';

  /** Quantas superfícies ignoram o padrão global por terem o seu. */
  const overrides = $derived(Object.keys($store.view.surfacePatterns).length);

  function enquadrar(): void {
    const el = document.querySelector('.stage-surface') as HTMLElement | null;
    if (el) fitView(el.clientWidth, el.clientHeight);
  }
</script>

<!-- Só o que se toca enquanto alinha. Pasta, resolução e saída moram no painel
     lateral, porque são coisas de começo e de fim, não de trabalho. -->
<div class="flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-base-300 bg-base-100 px-3 py-2">
  <div class="join">
    <button class="btn btn-sm btn-primary join-item" onclick={() => store.addSurface()}>
      + superfície
    </button>
    <button
      class="btn btn-sm join-item"
      class:btn-active={ui.tool === 'polygon'}
      aria-pressed={ui.tool === 'polygon'}
      title="Clique para traçar um contorno livre em volta de um objeto torto"
      onclick={() => (ui.tool = ui.tool === 'polygon' ? 'select' : 'polygon')}
    >
      polígono
    </button>
  </div>

  <div class="divider divider-horizontal mx-0 h-6 self-center"></div>

  <div class="join">
    <button class="btn btn-sm join-item" onclick={() => store.undo()} disabled={!store.canUndo} title="Ctrl+Z">
      desfazer
    </button>
    <button class="btn btn-sm join-item" onclick={() => store.redo()} disabled={!store.canRedo} title="Ctrl+Shift+Z">
      refazer
    </button>
  </div>

  <button
    class="btn btn-sm"
    class:btn-active={ui.snap}
    aria-pressed={ui.snap}
    title="Gruda nos cantos das outras superfícies. Segure Ctrl para desligar por um instante"
    onclick={() => (ui.snap = !ui.snap)}
  >
    ímã
  </button>

  <div class="divider divider-horizontal mx-0 h-6 self-center"></div>

  <label class="flex items-center gap-2 text-sm" for="pattern">
    <span class="text-base-content/60">padrão em todas</span>
    <select
      id="pattern"
      class="select select-sm w-40"
      title="Vale para todas as superfícies que não tiverem um padrão próprio"
      value={$store.view.testPattern}
      onchange={(e) => store.setTestPattern(e.currentTarget.value as TestPattern)}
    >
      {#each PATTERNS as p (p.id)}<option value={p.id}>{p.label}</option>{/each}
    </select>
  </label>

  {#if overrides > 0}
    <button
      class="btn btn-xs btn-ghost text-base-content/60"
      title="Algumas superfícies têm padrão próprio e ignoram o de cima"
      onclick={() => { for (const id of Object.keys($store.view.surfacePatterns)) store.setSurfacePattern(id, null); }}
    >
      {overrides} com padrão próprio · limpar
    </button>
  {/if}

  <div class="grow"></div>

  <button class="btn btn-sm btn-ghost" onclick={enquadrar} title="Recentraliza a área de trabalho">
    enquadrar
  </button>
  <button
    class="btn btn-sm btn-ghost"
    onclick={() => store.setView({ uiHidden: true })}
    title="Esconde toda a interface. Tecla H para voltar"
  >
    esconder UI
  </button>
</div>
