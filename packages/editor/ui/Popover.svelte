<script module lang="ts">
  /**
   * Pilha dos popovers abertos, para o Esc fechar só o de cima.
   *
   * Enquanto havia um só, `Escape` podia ser um ouvinte solto na janela. O
   * editor de texto abre o seletor de cor *dentro* dele, e aí dois ouvintes
   * respondem à mesma tecla: um Esc para corrigir a cor levava o editor junto.
   */
  const stack: symbol[] = [];
</script>

<script lang="ts">
  /**
   * Painel flutuante ancorado num elemento da página.
   *
   * Existe porque um painel aberto *dentro* da lista empurra tudo para baixo e
   * esconde a parede — que é justamente o que se olha enquanto se escolhe uma
   * cor ou se digita um texto. Foi um defeito real do seletor de cor; o editor
   * de texto precisava do mesmo comportamento, e a segunda ocorrência é o que
   * justifica extrair a primeira.
   *
   * O conteúdo é do chamador, cabeçalho incluído: o que identifica o painel
   * (uma amostra de cor, um título) só quem o abriu sabe.
   */
  import type { Snippet } from 'svelte';
  import { t } from '../i18n/index.svelte.ts';

  interface Props {
    /** O elemento que abriu o painel: é dele que sai a posição na tela. */
    anchor: HTMLElement;
    /** Como o painel se apresenta a quem navega por leitor de tela. */
    label: string;
    /** Largura inicial. O resto é o navegador quem decide, pelo `resize`. */
    width?: number;
    onclose: () => void;
    /** O que aparece no cabeçalho, à esquerda do botão de fechar. */
    head?: Snippet;
    children: Snippet;
  }
  const { anchor, label, width = 248, onclose, head, children }: Props = $props();

  /**
   * Posição na tela, calculada a partir do elemento que o abriu.
   *
   * Vira para cima quando não cabe abaixo, e encosta na margem quando não cabe
   * à direita: numa tela de laptop com o painel colado na borda, os dois casos
   * acontecem sempre.
   */
  const MARGIN = 8;
  /** O tamanho **medido**. Zero até o primeiro `ResizeObserver`, e é por isso
   *  que `place` cai na largura pedida enquanto isso: guardar a prop aqui
   *  congelaria o valor inicial e a posição pararia de acompanhar o resize. */
  let size = $state({ w: 0, h: 0 });
  let panel = $state<HTMLElement | null>(null);

  const place = $derived.by(() => {
    const box = anchor.getBoundingClientRect();
    const w = size.w || width;
    const h = size.h || 232;
    const left = Math.max(MARGIN, Math.min(box.left, window.innerWidth - w - MARGIN));
    const below = box.bottom + 6;
    const top = below + h + MARGIN <= window.innerHeight
      ? below
      : Math.max(MARGIN, box.top - h - 6);
    return { left, top };
  });

  /** O painel é redimensionável, então a posição precisa acompanhar o tamanho
   *  novo — senão arrastar o canto para baixo o empurra para fora da tela. */
  $effect(() => {
    if (!panel) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) size = { w: entry.contentRect.width, h: entry.contentRect.height };
    });
    observer.observe(panel);
    return () => observer.disconnect();
  });

  /** Fechar por fora do painel e por Esc, além do botão: três saídas, porque a
   *  primeira que a pessoa tenta varia e nenhuma delas pode não funcionar. */
  $effect(() => {
    const self = Symbol();
    stack.push(self);
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && stack.at(-1) === self) onclose();
    };
    const onDown = (e: PointerEvent): void => {
      const target = e.target as Node;
      if (!panel?.contains(target) && !anchor.contains(target)) onclose();
    };
    window.addEventListener('keydown', onKey);
    // `capture` para chegar antes dos gestos do palco, que param a propagação.
    window.addEventListener('pointerdown', onDown, true);
    return () => {
      stack.splice(stack.indexOf(self), 1);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown, true);
    };
  });
</script>

<div
  bind:this={panel}
  class="pop"
  style:--pop-w="{width}px"
  style:left="{place.left}px"
  style:top="{place.top}px"
  role="dialog"
  aria-label={label}
>
  <header class="head">
    {@render head?.()}
    <button class="close" onclick={onclose} aria-label={t('ui.done')} title={t('ui.done')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-3.5">
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </button>
  </header>

  <div class="body">
    {@render children()}
  </div>
</div>

<style>
  /*
   * Flutua: aberto dentro da lista, empurrava o painel para baixo e escondia
   * justamente o que se quer olhar enquanto se edita — a parede.
   *
   * `resize` nativo em vez de uma alça própria: o navegador já desenha o canto,
   * já trata o arrasto e já respeita o mínimo. Uma alça escrita à mão seria mais
   * código para chegar no mesmo lugar.
   */
  .pop {
    position: fixed;
    z-index: 50;
    width: var(--pop-w);
    min-width: 200px;
    max-width: min(92vw, 420px);
    min-height: 200px;
    max-height: min(86vh, 520px);
    resize: both;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    border-radius: 8px;
    border: 1px solid var(--color-base-300, #393939);
    background: var(--color-base-100, #161616);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
    animation: pop 120ms ease-out;
  }
  @keyframes pop {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    .pop { animation: none; }
  }

  .head {
    display: flex; align-items: center; gap: 6px;
    padding: 6px 6px 6px 8px;
    border-bottom: 1px solid var(--color-base-300, #393939);
  }
  .close {
    display: grid; place-items: center;
    width: 20px; height: 20px; border-radius: 4px; margin-left: auto;
    opacity: 0.55; cursor: pointer;
  }
  .close:hover { opacity: 1; background: var(--color-base-200, #262626); }

  /* O corpo cresce com o painel, e o conteúdo fica com a sobra: é ele que ganha
     espaço quando alguém aumenta o painel. */
  .body {
    flex: 1; min-height: 0;
    display: flex; flex-direction: column; gap: 8px;
    padding: 8px;
  }
</style>
