<script lang="ts">
  /**
   * Seletor de cor próprio.
   *
   * O nativo abre um diálogo do sistema: fora do tema, pesado, e sem as cores
   * que esta ferramenta usa o tempo todo. Este cabe no painel, responde ao
   * arrasto, e traz as amostras que servem para conferir projetor — branco,
   * preto, cinza 50% e as três primárias puras.
   *
   * Não guarda estado próprio de cor: a verdade é a prop, e toda mudança sobe
   * por `onpick`. O único estado local é o matiz, porque cinza e preto não têm
   * matiz para lembrar e a trilha ficaria pulando para zero enquanto a pessoa
   * arrasta pelo fundo do quadro.
   */
  import { colorKey, hexOf, hsvToRgb, parseHex, rgbToHsv, type Rgb, type Vec2 } from '../../engine/index.ts';
  import { drag } from './actions.ts';
  import { t } from '../i18n/index.svelte.ts';

  interface Props {
    rgb: Rgb;
    /** O elemento que abriu o seletor: é dele que sai a posição na tela. */
    anchor: HTMLElement;
    onpick: (rgb: Rgb) => void;
    onend?: () => void;
    onclose: () => void;
  }
  const { rgb, anchor, onpick, onend, onclose }: Props = $props();

  const hsv = $derived(rgbToHsv(rgb));
  let hueMemory = $state<number | null>(null);
  const hue = $derived(hueMemory ?? hsv[0]);
  const sat = $derived(hsv[1]);
  const val = $derived(hsv[2]);

  /** O que o campo hex mostra enquanto está sendo digitado. `null` = mostra a
   *  cor real; só um hex inválido segura o texto cru na tela. */
  let typing = $state<string | null>(null);
  const hex = $derived(typing ?? hexOf(rgb));

  /** Amostras do domínio, não uma paleta de decoração: as três primeiras
   *  conferem foco e ponto de preto, as três últimas conferem canal. */
  const SWATCHES: Rgb[] = [
    [255, 255, 255], [128, 128, 128], [0, 0, 0],
    [255, 0, 0], [0, 255, 0], [0, 0, 255],
  ];

  const unit = (value: number, size: number): number =>
    size <= 0 ? 0 : Math.min(1, Math.max(0, value / size));

  function pickFromSquare(p: Vec2, node: HTMLElement): void {
    hueMemory = hue;
    onpick(hsvToRgb([hue, unit(p.x, node.clientWidth), 1 - unit(p.y, node.clientHeight)]));
  }

  function pickFromHue(p: Vec2, node: HTMLElement): void {
    const h = unit(p.x, node.clientWidth) * 360;
    hueMemory = h;
    // Saturação e valor zerados não têm matiz visível; empurra para uma cor que
    // mostre o matiz escolhido, senão arrastar a trilha não faz nada na tela.
    onpick(hsvToRgb([h, sat || 1, val || 1]));
  }

  function commitHex(value: string): void {
    const parsed = parseHex(value);
    if (parsed) { typing = null; hueMemory = null; onpick(parsed); return; }
    typing = value;
  }

  function setChannel(index: number, value: number): void {
    const next = [...rgb] as Rgb;
    next[index] = Math.max(0, Math.min(255, Math.round(value)));
    hueMemory = null;
    onpick(next);
  }

  const CHANNELS = ['R', 'G', 'B'] as const;

  /**
   * Posição na tela, calculada a partir da amostra que o abriu.
   *
   * `fixed` e fora do fluxo de propósito: aberto dentro da lista, o seletor
   * empurrava o painel inteiro para baixo e obrigava a rolar até achá-lo — e o
   * que a pessoa queria ver, a cor mudando na parede, ficava fora da tela.
   *
   * Vira para cima quando não cabe abaixo, e encosta na margem quando não cabe
   * à direita: numa tela de laptop com o painel colado na borda, os dois casos
   * acontecem sempre.
   */
  const MARGIN = 8;
  let size = $state({ w: 248, h: 232 });
  let panel = $state<HTMLElement | null>(null);

  const place = $derived.by(() => {
    const box = anchor.getBoundingClientRect();
    const left = Math.max(MARGIN, Math.min(box.left, window.innerWidth - size.w - MARGIN));
    const below = box.bottom + 6;
    const top = below + size.h + MARGIN <= window.innerHeight
      ? below
      : Math.max(MARGIN, box.top - size.h - 6);
    return { left, top };
  });

  /** O seletor é redimensionável, então a posição precisa acompanhar o tamanho
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
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') onclose(); };
    const onDown = (e: PointerEvent): void => {
      const target = e.target as Node;
      if (!panel?.contains(target) && !anchor.contains(target)) onclose();
    };
    window.addEventListener('keydown', onKey);
    // `capture` para chegar antes dos gestos do palco, que param a propagação.
    window.addEventListener('pointerdown', onDown, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown, true);
    };
  });
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  bind:this={panel}
  class="picker"
  style:left="{place.left}px"
  style:top="{place.top}px"
  role="dialog"
  aria-label={t('color.edit')}
>
  <header class="head">
    <span class="chip" style:background-color={hexOf(rgb)}></span>
    <span class="name">{t(`color.${colorKey(rgb)}`)}</span>
    <button class="close" onclick={onclose} aria-label={t('color.done')} title={t('color.done')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-3.5">
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </button>
  </header>

  <div class="body">
  <!-- Quadro saturação × valor. O fundo é o matiz puro; as duas camadas por
       cima trazem o branco na horizontal e o preto na vertical. -->
  <div
    class="sv-square"
    style:background-color={hexOf(hsvToRgb([hue, 1, 1]))}
    role="slider"
    tabindex="0"
    aria-label={t('color.square')}
    aria-valuenow={Math.round(sat * 100)}
    aria-valuemin="0"
    aria-valuemax="100"
    use:drag={{
      onStart: (p, e) => pickFromSquare(p, e.currentTarget as HTMLElement),
      onMove: (p, _d, e) => pickFromSquare(p, e.currentTarget as HTMLElement),
      onEnd: () => onend?.(),
    }}
  >
    <div class="sv-white"></div>
    <div class="sv-black"></div>
    <div class="sv-dot" style:left="{sat * 100}%" style:top="{(1 - val) * 100}%"></div>
  </div>

  <!-- Trilha de matiz -->
  <div
    class="hue-track"
    role="slider"
    tabindex="0"
    aria-label={t('color.hue')}
    aria-valuenow={Math.round(hue)}
    aria-valuemin="0"
    aria-valuemax="360"
    use:drag={{
      onStart: (p, e) => pickFromHue(p, e.currentTarget as HTMLElement),
      onMove: (p, _d, e) => pickFromHue(p, e.currentTarget as HTMLElement),
      onEnd: () => onend?.(),
    }}
  >
    <div class="hue-dot" style:left="{(hue / 360) * 100}%"></div>
  </div>

  <!-- Hex numa linha e RGB numa grade: os quatro lado a lado cortavam o último
       campo na largura mínima do painel. -->
  <input
    class="input input-xs w-full font-mono"
    value={hex}
    aria-label={t('color.hex')}
    spellcheck="false"
    oninput={(e) => commitHex(e.currentTarget.value)}
    onblur={() => { typing = null; onend?.(); }}
  />

  <div class="grid grid-cols-3 gap-1">
    {#each CHANNELS as label, i (label)}
      <label class="flex items-center gap-1 text-[10px] text-base-content/45">
        {label}
        <input
          class="input input-xs min-w-0 flex-1 px-1 text-center tabular-nums"
          type="number" min="0" max="255" value={rgb[i]}
          oninput={(e) => setChannel(i, +e.currentTarget.value)}
          onchange={() => onend?.()}
        />
      </label>
    {/each}
  </div>

  <div class="flex gap-1">
    {#each SWATCHES as swatch (hexOf(swatch))}
      <button
        class="swatch"
        style:background-color={hexOf(swatch)}
        aria-label={hexOf(swatch)}
        title={hexOf(swatch)}
        onclick={() => { hueMemory = null; onpick(swatch); onend?.(); }}
      ></button>
    {/each}
  </div>
  </div>
</div>

<style>
  /*
   * Flutua: aberto dentro da lista, empurrava o painel para baixo e escondia
   * justamente o que se quer olhar enquanto escolhe a cor — a parede.
   *
   * `resize` nativo em vez de uma alça própria: o navegador já desenha o canto,
   * já trata o arrasto e já respeita o mínimo. Uma alça escrita à mão seria mais
   * código para chegar no mesmo lugar.
   */
  .picker {
    position: fixed;
    z-index: 50;
    width: 248px;
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
    .picker { animation: none; }
  }

  .head {
    display: flex; align-items: center; gap: 6px;
    padding: 6px 6px 6px 8px;
    border-bottom: 1px solid var(--color-base-300, #393939);
  }
  .chip {
    width: 14px; height: 14px; border-radius: 3px; flex: none;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }
  .name { flex: 1; font-size: 11px; opacity: 0.7; }
  .close {
    display: grid; place-items: center;
    width: 20px; height: 20px; border-radius: 4px;
    opacity: 0.55; cursor: pointer;
  }
  .close:hover { opacity: 1; background: var(--color-base-200, #262626); }

  /* O corpo cresce com o painel, e é o quadro que fica com a sobra: é ele que
     ganha precisão quando alguém aumenta o seletor. */
  .body {
    flex: 1; min-height: 0;
    display: flex; flex-direction: column; gap: 8px;
    padding: 8px;
  }

  .sv-square {
    position: relative; width: 100%; flex: 1; min-height: 72px; border-radius: 4px;
    cursor: crosshair; touch-action: none; overflow: hidden;
  }
  .sv-white, .sv-black { position: absolute; inset: 0; }
  .sv-white { background: linear-gradient(to right, #fff, transparent); }
  .sv-black { background: linear-gradient(to top, #000, transparent); }
  .sv-dot, .hue-dot {
    position: absolute; width: 10px; height: 10px; border-radius: 50%;
    border: 2px solid #fff; box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.6);
    transform: translate(-50%, -50%); pointer-events: none;
  }
  .hue-track {
    position: relative; width: 100%; height: 12px; border-radius: 999px;
    cursor: ew-resize; touch-action: none;
    background: linear-gradient(to right,
      #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%);
  }
  .hue-dot { top: 50%; }
  /* Borda cinza, e não branca: a amostra branca desaparecia no tema claro —
     justamente a que mais se usa para conferir uma borda projetada. */
  .swatch {
    flex: 1; height: 20px; border-radius: 3px;
    border: 1px solid rgba(128, 128, 128, 0.45); cursor: pointer;
  }
  .swatch:hover { outline: 2px solid var(--color-primary, #52bdff); outline-offset: 1px; }
</style>
