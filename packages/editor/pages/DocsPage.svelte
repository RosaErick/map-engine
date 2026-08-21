<script lang="ts">
  import { guideFor } from '../i18n/docs/index.ts';
  import { i18n, t } from '../i18n/index.svelte.ts';

  const guide = $derived(guideFor(i18n.locale));

  let container = $state<HTMLElement>();
  let active = $state<string>('');

  /**
   * Marca no índice a seção que está sendo lida.
   *
   * O observer serve de gatilho — o navegador já sabe quando algo entra ou sai
   * da tela —, mas quem decide é a geometria: a seção ativa é a última cujo
   * título já passou da linha de leitura. Escolher pela primeira interseção
   * marca a seção anterior, que é errado justamente quando se está lendo o
   * começo de uma nova.
   */
  $effect(() => {
    const root = container;
    if (!root) return;
    const sections = [...root.querySelectorAll<HTMLElement>('[data-section]')];
    if (sections.length === 0) return;

    const update = (): void => {
      const line = root.getBoundingClientRect().top + root.clientHeight * 0.25;
      let current = sections[0]!.id;
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= line) current = section.id;
      }
      active = current;
    };
    update();

    root.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(root);
    return () => {
      root.removeEventListener('scroll', update);
      observer.disconnect();
    };
  });

  function goTo(id: string): void {
    container?.querySelector(`#${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
</script>

<div bind:this={container} class="absolute inset-0 z-40 overflow-y-auto bg-base-100">
  <div class="mx-auto flex w-full max-w-6xl gap-10 px-6 py-10 lg:px-10">
    <!-- Índice fixo à esquerda, como em qualquer documentação técnica: a pessoa
         precisa ver o mapa inteiro sem perder o lugar onde está. -->
    <nav class="sticky top-10 hidden h-fit w-52 shrink-0 lg:block">
      <p class="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-base-content/45">
        {t('docs.onThisPage')}
      </p>
      <ul class="flex flex-col gap-0.5 border-l border-base-300">
        {#each guide as section (section.id)}
          <li>
            <button
              class="-ml-px block w-full border-l-2 py-1 pl-3 text-left text-[13px] transition-colors {active === section.id
                ? 'border-primary text-primary'
                : 'border-transparent text-base-content/60 hover:text-base-content'}"
              onclick={() => goTo(section.id)}
            >{section.title}</button>
          </li>
        {/each}
      </ul>
    </nav>

    <article class="min-w-0 max-w-[72ch] flex-1 pb-24">
      <h1 class="text-3xl font-semibold tracking-tight">{t('docs.title')}</h1>
      <p class="mt-2 text-sm text-base-content/60">{t('docs.subtitle')}</p>

      {#each guide as section (section.id)}
        <section id={section.id} data-section class="scroll-mt-10 pt-10">
          <h2 class="border-b border-base-300 pb-2 text-xl font-semibold tracking-tight">
            {section.title}
          </h2>

          {#each section.blocks as block, i (i)}
            {#if block.kind === 'p'}
              <p class="mt-4 text-[15px] leading-relaxed text-base-content/85">{@html block.text}</p>

            {:else if block.kind === 'steps'}
              <ol class="mt-4 flex flex-col gap-3">
                {#each block.items as item, n (n)}
                  <li class="flex gap-3 text-[15px] leading-relaxed text-base-content/85">
                    <span class="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
                      {n + 1}
                    </span>
                    <span>{@html item}</span>
                  </li>
                {/each}
              </ol>

            {:else if block.kind === 'list'}
              <ul class="mt-4 flex flex-col gap-2">
                {#each block.items as item, n (n)}
                  <li class="flex gap-3 text-[15px] leading-relaxed text-base-content/85">
                    <span class="mt-2 size-1 shrink-0 rounded-full bg-base-content/30"></span>
                    <span>{@html item}</span>
                  </li>
                {/each}
              </ul>

            {:else if block.kind === 'keys'}
              <div class="mt-4 overflow-x-auto">
                <table class="w-full border-collapse text-[14px]">
                  <tbody>
                    {#each block.rows as [keys, meaning], n (n)}
                      <tr class="border-b border-base-300 last:border-0">
                        <td class="whitespace-nowrap py-2 pr-6 align-top">
                          <kbd class="kbd kbd-sm">{keys}</kbd>
                        </td>
                        <td class="py-2 text-base-content/75">{meaning}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>

            {:else if block.kind === 'note'}
              <aside class="mt-4 rounded-r-md border-l-2 border-primary bg-primary/5 px-4 py-3 text-[14px] leading-relaxed text-base-content/80">
                {@html block.text}
              </aside>

            {:else if block.kind === 'code'}
              <pre class="mt-4 overflow-x-auto rounded-md border border-base-300 bg-base-200 p-4 text-[13px] leading-relaxed"><code>{block.code}</code></pre>
            {/if}
          {/each}
        </section>
      {/each}
    </article>
  </div>
</div>

<style>
  /* A tipografia do guia é a da interface, mas com um pouco mais de ar: é texto
     para ler, não rótulo para reconhecer. */
  article :global(code) {
    font-size: 0.9em;
    padding: 0.1em 0.35em;
    border-radius: 0.25rem;
    background: var(--color-base-200);
  }
  pre :global(code) { background: none; padding: 0; }
</style>
