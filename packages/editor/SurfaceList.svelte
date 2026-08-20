<script lang="ts">
  import Icon from './Icon.svelte';
  import { store } from './state.svelte.ts';

  let renaming = $state<string | null>(null);

  function commitRename(id: string, value: string): void {
    const name = value.trim();
    if (name) store.patchSurface(id, { name });
    renaming = null;
  }

  const ordered = $derived([...$store.project.surfaces].sort((a, b) => b.z - a.z));
</script>

<section class="border-b border-base-300 px-4 py-3">
  <div class="flex items-baseline justify-between">
    <h2 class="text-[10px] font-semibold uppercase tracking-[0.14em] text-base-content/45">Superfícies</h2>
    <span class="text-[11px] text-base-content/40">{ordered.length}</span>
  </div>

  {#if ordered.length === 0}
    <!-- Estado vazio que ensina o primeiro passo em vez de só informar que não
         há nada. É a primeira tela que alguém vê. -->
    <ol class="mt-2 space-y-1.5 text-[11px] leading-relaxed text-base-content/55">
      <li><span class="font-semibold text-base-content/80">1.</span> Clique em <strong>+ superfície</strong> na barra de cima.</li>
      <li><span class="font-semibold text-base-content/80">2.</span> Arraste os quatro cantos até cobrirem o objeto real.</li>
      <li><span class="font-semibold text-base-content/80">3.</span> Solte um vídeo ou imagem em cima dela.</li>
    </ol>
  {/if}

  <ul class="mt-2 flex flex-col gap-0.5">
    {#each ordered as s (s.id)}
      <li
        class="group flex items-center gap-0.5 rounded-md border px-1 py-0.5 transition-colors {$store.view.selectedSurfaceId === s.id
          ? 'border-primary bg-primary/10'
          : 'border-transparent hover:bg-base-200'}"
      >
        <button
          class="flex-1 truncate px-2 py-0.5 text-left text-[13px]"
          onclick={() => store.setView({ selectedSurfaceId: s.id, selectedCorner: null })}
          ondblclick={() => (renaming = s.id)}
          title="Duplo clique para renomear"
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
          title="Solo: apaga todas as outras para alinhar esta"
          onclick={() => store.toggleSolo(s.id)}
        >S</button>

        <button
          class="btn btn-xs btn-ghost btn-square"
          aria-pressed={!s.visible}
          title={s.visible ? 'Apagar esta superfície' : 'Acender esta superfície'}
          onclick={() => store.toggleVisible(s.id)}
        >
          <Icon name={s.visible ? 'eye' : 'eye-off'} class="size-3.5" />
        </button>

        <button
          class="btn btn-xs btn-ghost btn-square"
          class:text-warning={s.locked}
          aria-pressed={s.locked}
          title={s.locked ? 'Destravar' : 'Travar: depois de alinhada, ninguém mexe sem querer'}
          onclick={() => store.toggleLock(s.id)}
        >
          <Icon name={s.locked ? 'lock' : 'lock-open'} class="size-3.5" />
        </button>
      </li>
    {/each}
  </ul>

  <div class="mt-2.5 flex gap-1.5">
    <button class="btn btn-xs flex-1" onclick={() => store.addSurface()}>nova</button>
    <button
      class="btn btn-xs flex-1"
      disabled={!$store.view.selectedSurfaceId}
      title="Ctrl+D"
      onclick={() => store.duplicateSurface($store.view.selectedSurfaceId!)}
    >duplicar</button>
    <button
      class="btn btn-xs btn-ghost btn-square text-base-content/50 hover:text-error"
      disabled={!$store.view.selectedSurfaceId}
      aria-label="Apagar superfície"
      title="Apagar a superfície selecionada (Delete)"
      onclick={() => store.removeSurface($store.view.selectedSurfaceId!)}
    >
      <Icon name="trash" class="size-3.5" />
    </button>
  </div>
</section>
