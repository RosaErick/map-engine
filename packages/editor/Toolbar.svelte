<script lang="ts">
  import { store, ui, fitView, addSurface } from './state.svelte.ts';
  import type { TestPattern } from '../engine/index.ts';
  import { PATTERNS } from './patterns.ts';
  import { t } from './i18n/index.svelte.ts';

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
    <button class="btn btn-sm btn-primary join-item" onclick={addSurface}>
      {t('toolbar.newSurface')}
    </button>
    <button
      class="btn btn-sm join-item"
      class:btn-active={ui.tool === 'polygon'}
      aria-pressed={ui.tool === 'polygon'}
      title={t('toolbar.polygonHint')}
      onclick={() => (ui.tool = ui.tool === 'polygon' ? 'select' : 'polygon')}
    >
      {t('toolbar.polygon')}
    </button>
  </div>

  <div class="divider divider-horizontal mx-0 h-6 self-center"></div>

  <div class="join">
    <button class="btn btn-sm join-item" onclick={() => store.undo()} disabled={!store.canUndo} title={t('toolbar.undoShortcut')}>
      {t('toolbar.undo')}
    </button>
    <button class="btn btn-sm join-item" onclick={() => store.redo()} disabled={!store.canRedo} title={t('toolbar.redoShortcut')}>
      {t('toolbar.redo')}
    </button>
  </div>

  <button
    class="btn btn-sm"
    class:btn-active={ui.snap}
    aria-pressed={ui.snap}
    title={t('toolbar.snapHint')}
    onclick={() => (ui.snap = !ui.snap)}
  >
    {t('toolbar.snap')}
  </button>

  <div class="divider divider-horizontal mx-0 h-6 self-center"></div>

  <label class="flex items-center gap-2 text-sm" for="pattern">
    <span class="text-base-content/60">{t('toolbar.patternAll')}</span>
    <select
      id="pattern"
      class="select select-sm w-40"
      title={t('toolbar.patternAllHint')}
      value={$store.view.testPattern}
      onchange={(e) => store.setTestPattern(e.currentTarget.value as TestPattern)}
    >
      {#each PATTERNS as id (id)}<option value={id}>{t(`pattern.${id}`)}</option>{/each}
    </select>
  </label>

  {#if overrides > 0}
    <button
      class="btn btn-xs btn-ghost text-base-content/60"
      title={t('toolbar.overridesHint')}
      onclick={() => { for (const id of Object.keys($store.view.surfacePatterns)) store.setSurfacePattern(id, null); }}
    >
      {t('toolbar.overrides', { count: overrides })}
    </button>
  {/if}

  <div class="grow"></div>

  <button class="btn btn-sm btn-ghost" onclick={enquadrar} title={t('toolbar.fitHint')}>
    {t('toolbar.fit')}
  </button>
  <button
    class="btn btn-sm btn-ghost"
    onclick={() => store.setView({ uiHidden: true })}
    title={t('toolbar.hideUiHint')}
  >
    {t('toolbar.hideUi')}
  </button>
</div>
