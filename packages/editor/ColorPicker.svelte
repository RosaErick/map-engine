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
  import { hexOf, hsvToRgb, parseHex, rgbToHsv, type Rgb, type Vec2 } from '../engine/index.ts';
  import { drag } from './actions.ts';
  import { t } from './i18n/index.svelte.ts';

  interface Props {
    rgb: Rgb;
    onpick: (rgb: Rgb) => void;
    onend?: () => void;
  }
  const { rgb, onpick, onend }: Props = $props();

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
</script>

<div class="flex flex-col gap-2">
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

  <div class="flex items-center gap-1">
    <input
      class="input input-xs w-[5.5rem] font-mono"
      value={hex}
      aria-label={t('color.hex')}
      oninput={(e) => commitHex(e.currentTarget.value)}
      onblur={() => { typing = null; onend?.(); }}
    />
    {#each CHANNELS as label, i (label)}
      <label class="flex items-center gap-0.5 text-[10px] text-base-content/45">
        {label}
        <input
          class="input input-xs w-11 px-1 text-center tabular-nums"
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

<style>
  .sv-square {
    position: relative; width: 100%; height: 88px; border-radius: 4px;
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
  .swatch {
    flex: 1; height: 18px; border-radius: 3px;
    border: 1px solid rgba(255, 255, 255, 0.18); cursor: pointer;
  }
  .swatch:hover { outline: 2px solid var(--color-primary, #52bdff); outline-offset: 1px; }
</style>
