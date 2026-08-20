<script lang="ts">
  import Icon from './Icon.svelte';
  import { store, addSurface, duplicateSelected } from './state.svelte.ts';
  import { anchorId, surfaceOrder } from '../engine/index.ts';
  import { t } from './i18n/index.svelte.ts';

  let renaming = $state<string | null>(null);

  function commitRename(id: string, value: string): void {
    const name = value.trim();
    if (name) store.patchSurface(id, { name });
    renaming = null;
  }

  const ordered = $derived([...$store.project.surfaces].sort((a, b) => b.z - a.z));

  /** O número que o padrão "número" projeta. Vem do engine, e não de um
   *  `index + 1` daqui: número na lista que discorda do número na parede é pior
   *  do que lista sem número nenhum. */
  const numbers = $derived(surfaceOrder($store.project));

  /** Quantas estão selecionadas, e se elas já formam um grupo. A barra de
   *  vínculo só aparece quando há o que ligar ou desligar. */
  const chosen = $derived($store.view.selectedIds.length);
  const anyLinked = $derived(
    $store.project.surfaces.some((s) => s.link && $store.view.selectedIds.includes(s.id)),
  );
</script>

<section class="border-b border-base-300 px-4 py-3">
  <div class="flex items-baseline justify-between">
    <h2 class="text-[10px] font-semibold uppercase tracking-[0.14em] text-base-content/45">{t('surfaces.title')}</h2>
    <span class="text-[11px] text-base-content/40">{ordered.length}</span>
  </div>

  {#if ordered.length === 0}
    <!-- Estado vazio que ensina o primeiro passo em vez de só informar que não
         há nada. É a primeira tela que alguém vê. -->
    <ol class="mt-2 space-y-1.5 text-[11px] leading-relaxed text-base-content/55">
      <li><span class="font-semibold text-base-content/80">1.</span> {@html t('surfaces.step1')}</li>
      <li><span class="font-semibold text-base-content/80">2.</span> {@html t('surfaces.step2')}</li>
      <li><span class="font-semibold text-base-content/80">3.</span> {@html t('surfaces.step3')}</li>
    </ol>
  {/if}

  <ul class="mt-2 flex flex-col gap-0.5">
    {#each ordered as s (s.id)}
      <li
        class="group flex items-center gap-0.5 rounded-md border px-1 py-0.5 transition-colors {$store.view.selectedIds.includes(s.id)
          ? (anchorId($store.view) === s.id ? 'border-primary bg-primary/15' : 'border-primary/40 bg-primary/5')
          : 'border-transparent hover:bg-base-200'}"
      >
        <span class="w-4 shrink-0 text-right text-[10px] tabular-nums text-base-content/35">{numbers.get(s) ?? ''}</span>
        {#if s.link}
          <span class="shrink-0 text-primary/70" title={t('surfaces.linked')} aria-label={t('surfaces.linked')}>
            <Icon name="link" class="size-3" />
          </span>
        {/if}
        <button
          class="flex-1 truncate px-2 py-0.5 text-left text-[13px]"
          onclick={(e) => (e.shiftKey || e.metaKey ? store.toggleSelection(s.id) : store.setSelection([s.id]))}
          ondblclick={() => (renaming = s.id)}
          title={t('surfaces.rename')}
        >
          {#if renaming === s.id}
            <!-- svelte-ignore a11y_autofocus -->
            <input
              autofocus
              class="input input-xs w-full"
              value={s.name}
              onblur={(e) => commitRename(s.id, e.currentTarget.value)}
              onkeydown={(e) => { if (e.key === 'Enter') commitRename(s.id, e.currentTarget.value); }}
            />
          {:else}
            {s.name}
          {/if}
        </button>

        <button
          class="btn btn-xs btn-ghost font-semibold"
          class:btn-active={$store.view.soloId === s.id}
          aria-pressed={$store.view.soloId === s.id}
          title={t('surfaces.solo')}
          onclick={() => store.toggleSolo(s.id)}
        >S</button>

        <button
          class="btn btn-xs btn-ghost btn-square"
          aria-pressed={!s.visible}
          title={s.visible ? t('surfaces.hide') : t('surfaces.show')}
          onclick={() => store.toggleVisible(s.id)}
        >
          <Icon name={s.visible ? 'eye' : 'eye-off'} class="size-3.5" />
        </button>

        <button
          class="btn btn-xs btn-ghost btn-square"
          class:text-warning={s.locked}
          aria-pressed={s.locked}
          title={s.locked ? t('surfaces.unlock') : t('surfaces.lock')}
          onclick={() => store.toggleLock(s.id)}
        >
          <Icon name={s.locked ? 'lock' : 'lock-open'} class="size-3.5" />
        </button>
      </li>
    {/each}
  </ul>

  {#if chosen > 1 || anyLinked}
    <!-- Só aparece quando há o que ligar ou desligar: um botão permanentemente
         desabilitado ocupa a mesma linha e não ensina nada. -->
    <div class="mt-2 flex items-center gap-1.5 rounded-md bg-base-200 px-2 py-1.5">
      <span class="flex-1 text-[11px] text-base-content/55">
        {t('surfaces.chosen', { count: chosen })}
      </span>
      {#if anyLinked}
        <button class="btn btn-xs btn-ghost" onclick={() => store.unlinkSelected()}>
          {t('surfaces.unlink')}
        </button>
      {/if}
      {#if chosen > 1}
        <button class="btn btn-xs" onclick={() => store.linkSelected()}>{t('surfaces.link')}</button>
      {/if}
    </div>
  {/if}

  <div class="mt-2.5 flex gap-1.5">
    <button class="btn btn-xs flex-1" onclick={addSurface}>{t('surfaces.new')}</button>
    <button
      class="btn btn-xs flex-1"
      disabled={$store.view.selectedIds.length === 0}
      title={t('surfaces.duplicateHint')}
      onclick={duplicateSelected}
    >{t('surfaces.duplicate')}</button>
    <button
      class="btn btn-xs btn-ghost btn-square text-base-content/50 hover:text-error"
      disabled={$store.view.selectedIds.length === 0}
      aria-label={t('surfaces.deleteLabel')}
      title={t('surfaces.delete')}
      onclick={() => { for (const id of [...$store.view.selectedIds]) store.removeSurface(id); }}
    >
      <Icon name="trash" class="size-3.5" />
    </button>
  </div>
</section>
