<script lang="ts">
  import Icon from '../ui/Icon.svelte';
  import { REPO_URL } from '../links.ts';
  import { t } from '../i18n/index.svelte.ts';
</script>

<!--
  Página inteira, como o guia — não mais um modal. Tipografia de jornal: coluna
  estreita, serifa, fios finos, capitular. Só fontes do sistema, porque carregar
  fonte externa quebraria o uso offline, que é metade do motivo de esta
  ferramenta existir.
-->
<div class="absolute inset-0 z-40 overflow-y-auto bg-base-100">
  <article class="mx-auto max-w-[68ch] px-6 py-14 font-serif text-base-content sm:px-10">
    <p class="font-sans text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-primary">
      {t('about.kicker')}
    </p>

    <h1 class="mt-3 text-pretty text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
      {t('about.headline')}
      <span class="italic">{t('about.headlineEmphasis')}</span>
    </h1>

    <p class="mt-5 text-lg leading-relaxed text-base-content/70">{t('about.lede')}</p>

    <div class="mt-8 border-t border-base-content/15"></div>
    <p class="mt-3 font-sans text-[0.7rem] uppercase tracking-[0.14em] text-base-content/50">
      {t('about.whyTitle')}
    </p>

    <p
      class="mt-4 leading-[1.75] first-letter:float-left first-letter:mr-2 first-letter:mt-1
             first-letter:text-6xl first-letter:font-semibold first-letter:leading-[0.82]"
    >{@html t('about.why1')}</p>

    <p class="mt-4 leading-[1.75]">{@html t('about.why2')}</p>

    <blockquote class="my-9 border-l-2 border-primary pl-5">
      <p class="text-2xl italic leading-snug">{t('about.quote')}</p>
      <p class="mt-2 font-sans text-sm text-base-content/60">{t('about.quoteBody')}</p>
    </blockquote>

    <div class="border-t border-base-content/15"></div>
    <p class="mt-3 font-sans text-[0.7rem] uppercase tracking-[0.14em] text-base-content/50">
      {t('about.freeTitle')}
    </p>

    <p class="mt-4 leading-[1.75]">{@html t('about.free1')}</p>
    <p class="mt-4 leading-[1.75]">{@html t('about.free2')}</p>

    <div class="mt-9 border-t border-base-content/15"></div>

    <div class="mt-4 space-y-4 font-sans text-sm text-base-content/70">
      <p>{t('about.madeWith')}</p>
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
