<script lang="ts">
  import Icon from './Icon.svelte';
  import { REPO_URL } from './links.ts';
  import { store, ui } from './state.svelte.ts';
  import { theme, applyTheme, type Theme } from './theme.svelte.ts';

  let { onAbout }: { onAbout: () => void } = $props();

  const themes: { id: Theme; icon: 'laptop' | 'sun' | 'moon'; label: string }[] = [
    { id: 'system', icon: 'laptop', label: 'Sistema' },
    { id: 'light', icon: 'sun', label: 'Claro' },
    { id: 'dark', icon: 'moon', label: 'Escuro' },
  ];
  const current = $derived(themes.find((t) => t.id === theme.value) ?? themes[0]!);
  const surfaces = $derived($store.project.surfaces.length);

  /** daisyUI fecha o dropdown quando o foco sai; sem isto o menu fica aberto
   *  depois de escolher. */
  function pick(id: Theme): void {
    applyTheme(id);
    (document.activeElement as HTMLElement | null)?.blur();
  }
</script>

<header class="flex h-11 items-center gap-3 border-b border-base-300 bg-base-100 pl-3 pr-2">
  <div class="flex items-center gap-2">
    <Icon name="mark" class="size-5 text-primary" />
    <span class="text-sm font-semibold tracking-tight">Projection Mapping</span>
  </div>

  <!-- O meio da barra responde, sem ninguém perguntar, o que uma pessoa quer
       saber de relance no meio de uma montagem: onde isto está sendo salvo, em
       que resolução a saída está, quantas superfícies existem e se a projeção
       está no ar. Informação, não mais botões. -->
  <div class="mx-2 hidden min-w-0 flex-1 items-center justify-center gap-3 text-[11px] text-base-content/50 md:flex">
    {#if ui.folderName}
      <span class="flex min-w-0 items-center gap-1.5" title="Onde o projeto está sendo salvo — o salvamento é automático">
        <span
          class="size-1.5 shrink-0 rounded-full transition-colors duration-500 {ui.savedAt
            ? 'bg-success'
            : 'bg-base-content/20'}"
        ></span>
        <span class="truncate">{ui.savedAt ? 'salvo' : ui.folderName}</span>
      </span>
      <span class="h-3 w-px bg-base-content/10"></span>
    {/if}

    <span class="whitespace-nowrap tabular-nums" title="Resolução da saída">
      {$store.project.output.width}×{$store.project.output.height}
    </span>
    <span class="h-3 w-px bg-base-content/10"></span>
    <span class="whitespace-nowrap">
      {surfaces} {surfaces === 1 ? 'superfície' : 'superfícies'}
    </span>

    {#if ui.outputOpen}
      <span class="h-3 w-px bg-base-content/10"></span>
      <span class="flex items-center gap-1.5 text-primary" title="A janela de saída está aberta">
        <span class="size-1.5 shrink-0 animate-pulse rounded-full bg-primary"></span>
        <span class="truncate">no projetor{ui.outputScreen ? ` · ${ui.outputScreen}` : ''}</span>
      </span>
    {/if}
  </div>

  <div class="flex items-center gap-0.5">
    <button class="btn btn-ghost btn-xs font-normal" onclick={onAbout}>sobre</button>

    <a
      href={REPO_URL}
      target="_blank"
      rel="noreferrer"
      class="btn btn-ghost btn-xs btn-square text-base-content/60 hover:text-base-content"
      aria-label="Repositório no GitHub"
      title="Código no GitHub — AGPL-3.0"
    >
      <Icon name="github" class="size-3.5" />
    </a>

    <div class="dropdown dropdown-end">
      <div
        tabindex="0"
        role="button"
        class="btn btn-ghost btn-xs btn-square text-base-content/60 hover:text-base-content"
        aria-label="Tema: {current.label}"
        title="Tema: {current.label}"
      >
        <Icon name={current.icon} class="size-3.5" />
      </div>
      <ul class="dropdown-content menu menu-sm z-50 mt-1 w-36 rounded-box border border-base-300 bg-base-100 p-1 shadow-lg">
        {#each themes as t (t.id)}
          <li>
            <button class="gap-2" class:menu-active={theme.value === t.id} onclick={() => pick(t.id)}>
              <Icon name={t.icon} class="size-3.5" />
              {t.label}
            </button>
          </li>
        {/each}
      </ul>
    </div>
  </div>
</header>
