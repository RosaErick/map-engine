<script lang="ts">
  import Icon from './Icon.svelte';
  import { REPO_URL } from './links.ts';
  import { store, session } from './state.svelte.ts';
  import { theme, applyTheme, type Theme } from './theme.svelte.ts';
  import { t, i18n, setLocale, LOCALES, type Locale, type MessageKey } from './i18n/index.svelte.ts';

  const themes: { id: Theme; icon: 'laptop' | 'sun' | 'moon'; key: MessageKey }[] = [
    { id: 'system', icon: 'laptop', key: 'topbar.themeSystem' },
    { id: 'light', icon: 'sun', key: 'topbar.themeLight' },
    { id: 'dark', icon: 'moon', key: 'topbar.themeDark' },
  ];
  const currentTheme = $derived(themes.find((x) => x.id === theme.value) ?? themes[0]!);
  const currentLocale = $derived(LOCALES.find((l) => l.id === i18n.locale) ?? LOCALES[0]!);
  const surfaces = $derived($store.project.surfaces.length);

  /** daisyUI fecha o dropdown quando o foco sai; sem isto o menu fica aberto
   *  depois de escolher. */
  function close(): void {
    (document.activeElement as HTMLElement | null)?.blur();
  }
</script>

<header class="flex h-11 items-center gap-3 border-b border-base-300 bg-base-100 pl-3 pr-2">
  <div class="flex items-center gap-2">
    <Icon name="mark" class="size-5 text-primary" />
    <span class="text-sm font-semibold tracking-tight">{t('app.name')}</span>
  </div>

  <!-- O meio da barra responde, sem ninguém perguntar, o que uma pessoa quer
       saber de relance no meio de uma montagem. Informação, não mais botões. -->
  <div class="mx-2 hidden min-w-0 flex-1 items-center justify-center gap-3 text-[11px] text-base-content/50 md:flex">
    {#if session.folderName}
      <span class="flex min-w-0 items-center gap-1.5" title={t('topbar.savedTo')}>
        <span
          class="size-1.5 shrink-0 rounded-full transition-colors duration-500 {session.savedAt
            ? 'bg-success'
            : 'bg-base-content/20'}"
        ></span>
        <span class="truncate">{session.savedAt ? t('topbar.saved') : session.folderName}</span>
      </span>
      <span class="h-3 w-px bg-base-content/10"></span>
    {/if}

    <span class="whitespace-nowrap tabular-nums" title={t('topbar.outputResolution')}>
      {$store.project.output.width}×{$store.project.output.height}
    </span>
    <span class="h-3 w-px bg-base-content/10"></span>
    <span class="whitespace-nowrap">{t('topbar.surfaces', { count: surfaces })}</span>

    {#if session.outputOpen}
      <span class="h-3 w-px bg-base-content/10"></span>
      <span class="flex items-center gap-1.5 text-primary" title={t('topbar.outputOpen')}>
        <span class="size-1.5 shrink-0 animate-pulse rounded-full bg-primary"></span>
        <span class="truncate">
          {t('topbar.onProjector')}{session.outputScreen ? ` · ${session.outputScreen}` : ''}
        </span>
      </span>
    {/if}
  </div>

  <div class="flex items-center gap-0.5">
    <button
      class="btn btn-ghost btn-xs font-normal"
      class:btn-active={session.page === 'docs'}
      onclick={() => (session.page = session.page === 'docs' ? 'editor' : 'docs')}
    >{session.page === 'docs' ? t('topbar.backToEditor') : t('topbar.guide')}</button>

    <button
      class="btn btn-ghost btn-xs font-normal"
      class:btn-active={session.page === 'about'}
      onclick={() => (session.page = session.page === 'about' ? 'editor' : 'about')}
    >{t('topbar.about')}</button>

    <a
      href={REPO_URL}
      target="_blank"
      rel="noreferrer"
      class="btn btn-ghost btn-xs btn-square text-base-content/60 hover:text-base-content"
      aria-label={t('topbar.githubLabel')}
      title={t('topbar.github')}
    >
      <Icon name="github" class="size-3.5" />
    </a>

    <!-- Idioma e tema seguem o mesmo padrão: um controle discreto que abre um
         menu, e não uma fileira de botões competindo com o trabalho. -->
    <div class="dropdown dropdown-end">
      <div
        tabindex="0"
        role="button"
        class="btn btn-ghost btn-xs gap-1 px-1.5 font-normal text-base-content/60 hover:text-base-content"
        aria-label={t('topbar.language', { name: currentLocale.label })}
        title={t('topbar.language', { name: currentLocale.label })}
      >
        <Icon name="globe" class="size-3.5" />
        <span class="text-[10px] font-semibold tracking-wide">{currentLocale.short}</span>
      </div>
      <ul class="dropdown-content menu menu-sm z-50 mt-1 w-36 rounded-box border border-base-300 bg-base-100 p-1 shadow-lg">
        {#each LOCALES as locale (locale.id)}
          <li>
            <button
              class="justify-between"
              class:menu-active={i18n.locale === locale.id}
              onclick={() => { setLocale(locale.id as Locale); close(); }}
            >
              {locale.label}
              <span class="text-[10px] opacity-50">{locale.short}</span>
            </button>
          </li>
        {/each}
      </ul>
    </div>

    <div class="dropdown dropdown-end">
      <div
        tabindex="0"
        role="button"
        class="btn btn-ghost btn-xs btn-square text-base-content/60 hover:text-base-content"
        aria-label={t('topbar.theme', { name: t(currentTheme.key) })}
        title={t('topbar.theme', { name: t(currentTheme.key) })}
      >
        <Icon name={currentTheme.icon} class="size-3.5" />
      </div>
      <ul class="dropdown-content menu menu-sm z-50 mt-1 w-36 rounded-box border border-base-300 bg-base-100 p-1 shadow-lg">
        {#each themes as option (option.id)}
          <li>
            <button
              class="gap-2"
              class:menu-active={theme.value === option.id}
              onclick={() => { applyTheme(option.id); close(); }}
            >
              <Icon name={option.icon} class="size-3.5" />
              {t(option.key)}
            </button>
          </li>
        {/each}
      </ul>
    </div>
  </div>
</header>
