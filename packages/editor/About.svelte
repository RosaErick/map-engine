<script lang="ts">
  import Icon from './Icon.svelte';
  import { REPO_URL } from './links.ts';
  import { t } from './i18n/index.svelte.ts';

  let { open = $bindable(false) }: { open?: boolean } = $props();
  let dialog = $state<HTMLDialogElement>();

  // O <dialog> nativo cuida de foco, camada por cima de tudo e Esc. Não há
  // motivo para reimplementar modal em 2026.
  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  });
</script>

<dialog bind:this={dialog} class="modal" onclose={() => (open = false)}>
  <div class="modal-box max-w-3xl bg-base-100 p-0 overflow-hidden">
    <div class="flex justify-end p-2 sticky top-0 bg-base-100/95 backdrop-blur z-10">
      <button class="btn btn-ghost btn-sm btn-circle" onclick={() => (open = false)} aria-label={t('about.close')}>
        <Icon name="close" />
      </button>
    </div>

    <!-- Tipografia de jornal: coluna estreita, serifa, fios finos, capitular.
         Fontes do sistema apenas — carregar fonte externa quebraria o uso
         offline, que é a razão de existir do build de arquivo único. -->
    <article class="px-8 pb-10 sm:px-12 font-serif text-base-content max-w-[68ch] mx-auto">
      <p class="text-[0.7rem] uppercase tracking-[0.18em] font-sans font-semibold text-primary">
        {t('about.kicker')}
      </p>

      <h1 class="mt-3 text-4xl sm:text-5xl leading-[1.08] font-semibold tracking-tight text-pretty">
        {t('about.headline')}
        <span class="italic">{t('about.headlineEmphasis')}</span>
      </h1>

      <p class="mt-4 text-lg leading-relaxed text-base-content/70">
        {t('about.lede')}
      </p>

      <div class="mt-6 border-t border-base-content/15"></div>
      <p class="mt-3 text-[0.7rem] uppercase tracking-[0.14em] font-sans text-base-content/50">
        {t('about.howItWorks')}
      </p>

      <p class="mt-4 leading-[1.75]
                first-letter:float-left first-letter:mr-2 first-letter:mt-1
                first-letter:text-6xl first-letter:leading-[0.82] first-letter:font-semibold">
        {t('about.paragraph1')}
      </p>

      <p class="mt-4 leading-[1.75]">
        {@html t('about.paragraph2')}
      </p>

      <blockquote class="my-8 border-l-2 border-primary pl-5">
        <p class="text-2xl leading-snug italic">{t('about.quote')}</p>
        <p class="mt-2 text-sm font-sans text-base-content/60">
          {t('about.quoteBody')}
        </p>
      </blockquote>

      <p class="leading-[1.75]">
        {@html t('about.paragraph3')}
      </p>

      <div class="mt-8 border-t border-base-content/15"></div>

      <div class="mt-4 font-sans text-sm text-base-content/70 space-y-3">
        <p>
          {t('about.offline')}
        </p>
        <p>
          {@html t('about.license')}
        </p>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          class="btn btn-neutral btn-sm gap-2 no-underline"
        >
          <Icon name="github" />
          {t('about.viewCode')}
        </a>
      </div>
    </article>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button aria-label={t('about.close')}>{t('about.close')}</button>
  </form>
</dialog>
