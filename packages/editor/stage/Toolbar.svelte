<script lang="ts">
  import Icon from '../ui/Icon.svelte';
  import { store, tools, fitView, addSurface } from '../state.svelte.ts';
  import { t } from '../i18n/index.svelte.ts';
  import { PATTERNS } from '../patterns.ts';
  import type { TestPattern } from '../../engine/index.ts';

  /** Quantas superfícies ignoram o padrão global por terem o seu. */
  const overrides = $derived(Object.keys($store.view.surfacePatterns).length);

  function enquadrar(): void {
    const el = document.querySelector('.stage-surface') as HTMLElement | null;
    if (el) fitView(el.clientWidth, el.clientHeight);
  }

  /**
   * Rótulos somem abaixo de `sm`, ícones ficam.
   *
   * O nome acessível vem sempre do `aria-label`, e não do texto visível: assim
   * ele não muda com a largura da janela — nem para quem usa leitor de tela, nem
   * para quem escreve teste.
   */
  const label = 'hidden sm:inline';
</script>

<!--
  Só o que se toca enquanto alinha. Pasta, resolução e saída moram no painel
  lateral, porque são coisas de começo e de fim, não de trabalho.
-->
<div
  class="flex h-9 items-center gap-1 border-b border-base-300 bg-base-100 px-2
         [&_.btn]:transition-colors"
>
  <div class="join">
    <button
      class="btn btn-xs join-item btn-primary gap-1.5"
      aria-label={t('toolbar.newSurface')}
      onclick={addSurface}
    >
      <Icon name="plus" class="size-3.5" />
      <span class={label}>{t('toolbar.newSurface')}</span>
    </button>
    <button
      class="btn btn-xs join-item gap-1.5"
      class:btn-active={tools.tool === 'polygon'}
      aria-pressed={tools.tool === 'polygon'}
      aria-label={t('toolbar.polygon')}
      title={t('toolbar.polygonHint')}
      onclick={() => (tools.tool = tools.tool === 'polygon' ? 'select' : 'polygon')}
    >
      <Icon name="polygon" class="size-3.5" />
      <span class={label}>{t('toolbar.polygon')}</span>
    </button>
  </div>

  <span class="mx-1 h-4 w-px bg-base-content/10"></span>

  <div class="join">
    <button
      class="btn btn-xs join-item btn-square"
      aria-label={t('toolbar.undo')}
      title="{t('toolbar.undo')} · {t('toolbar.undoShortcut')}"
      disabled={!store.canUndo}
      onclick={() => store.undo()}
    >
      <Icon name="undo" class="size-3.5" />
    </button>
    <button
      class="btn btn-xs join-item btn-square"
      aria-label={t('toolbar.redo')}
      title="{t('toolbar.redo')} · {t('toolbar.redoShortcut')}"
      disabled={!store.canRedo}
      onclick={() => store.redo()}
    >
      <Icon name="redo" class="size-3.5" />
    </button>
  </div>

  <button
    class="btn btn-xs btn-square"
    class:btn-active={tools.snap}
    aria-pressed={tools.snap}
    aria-label={t('toolbar.snap')}
    title="{t('toolbar.snap')} · {t('toolbar.snapHint')}"
    onclick={() => (tools.snap = !tools.snap)}
  >
    <Icon name="magnet" class="size-3.5" />
  </button>

  <span class="mx-1 h-4 w-px bg-base-content/10"></span>

  <!-- O padrão perdeu o rótulo escrito: o ícone diz o que é e o `title` diz o
       resto, e o que sobrou de largura é o que faz a barra caber no celular. -->
  <label class="flex min-w-0 items-center gap-1.5" for="pattern" title={t('toolbar.patternAllHint')}>
    <Icon name="grid" class="size-3.5 shrink-0 text-base-content/45" />
    <span class="sr-only">{t('toolbar.patternAll')}</span>
    <select
      id="pattern"
      class="select select-xs w-28 sm:w-36"
      value={$store.view.testPattern}
      onchange={(e) => store.setTestPattern(e.currentTarget.value as TestPattern)}
    >
      {#each PATTERNS as id (id)}<option value={id}>{t(`pattern.${id}`)}</option>{/each}
    </select>
  </label>

  {#if overrides > 0}
    <button
      class="btn btn-xs btn-ghost gap-1 px-1.5 font-normal text-base-content/55"
      title={t('toolbar.overridesHint')}
      onclick={() => { for (const id of Object.keys($store.view.surfacePatterns)) store.setSurfacePattern(id, null); }}
    >
      <span class="tabular-nums">{overrides}</span>
      <Icon name="close" class="size-3" />
    </button>
  {/if}

  <span class="grow"></span>

  <button
    class="btn btn-xs btn-ghost btn-square"
    aria-label={t('toolbar.fit')}
    title="{t('toolbar.fit')} · {t('toolbar.fitHint')}"
    onclick={enquadrar}
  >
    <Icon name="frame" class="size-3.5" />
  </button>
  <button
    class="btn btn-xs btn-ghost gap-1.5"
    aria-label={t('toolbar.hideUi')}
    title={t('toolbar.hideUiHint')}
    onclick={() => store.setView({ uiHidden: true })}
  >
    <Icon name="eye-off" class="size-3.5" />
    <span class={label}>{t('toolbar.hideUi')}</span>
  </button>
</div>
