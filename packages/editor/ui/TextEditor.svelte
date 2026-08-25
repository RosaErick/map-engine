<script lang="ts">
  /**
   * Editor de uma fonte de texto.
   *
   * Flutua pelo mesmo motivo do seletor de cor: dentro da lista, o painel
   * empurraria tudo para baixo e esconderia a parede — e o que se julga ao
   * escrever é como o texto cai na superfície, não como o campo fica no painel.
   *
   * Não guarda estado próprio: a verdade é a prop `style`, e cada tecla sobe por
   * `onchange`. É o que faz o texto aparecer na parede enquanto se digita.
   */
  import { hexOf, TEXT_ALIGNS, TEXT_FAMILIES, type Rgb, type TextStyle } from '../../engine/index.ts';
  import ColorPicker from './ColorPicker.svelte';
  import Popover from './Popover.svelte';
  import { t } from '../i18n/index.svelte.ts';

  interface Props {
    style: TextStyle;
    /** O elemento que abriu o editor: é dele que sai a posição na tela. */
    anchor: HTMLElement;
    onchange: (patch: Partial<TextStyle>) => void;
    onclose: () => void;
  }
  const { style, anchor, onchange, onclose }: Props = $props();

  /** A amostra que abre o seletor de cor. Guardada porque o seletor flutua e
   *  tira a posição dela — o mesmo contrato da lista de fontes. */
  let swatch = $state<HTMLElement | null>(null);
  let pickingColor = $state(false);

  /** Limites do domínio: entrelinha zero empilharia as linhas umas sobre as
   *  outras, e `parseProject` já recorta nos mesmos números. */
  const LINE_HEIGHT = { min: 0.5, max: 4, step: 0.05 };
  const TRACKING = { min: -0.5, max: 2, step: 0.01 };
</script>

<Popover {anchor} {onclose} label={t('text.edit')} width={288}>
  {#snippet head()}
    <span class="title">{t('text.edit')}</span>
  {/snippet}

  <!-- A área de digitação é quem fica com a sobra do painel: redimensionar só
       serve para escrever mais confortavelmente, e um campo de duas linhas num
       painel grande não serviria para nada. -->
  <textarea
    class="textarea textarea-xs w-full flex-1 resize-none leading-snug"
    placeholder={t('text.placeholder')}
    aria-label={t('text.edit')}
    value={style.text}
    oninput={(e) => onchange({ text: e.currentTarget.value })}
  ></textarea>

  <!-- Uma linha compacta com o resto: são controles de acabamento, e ocupar
       metade do painel com eles roubaria espaço de quem escreve. -->
  <div class="flex flex-wrap items-center gap-1">
    <select
      class="select select-xs min-w-0 flex-1"
      aria-label={t('text.family')}
      value={style.family}
      onchange={(e) => onchange({ family: e.currentTarget.value as TextStyle['family'] })}
    >
      {#each TEXT_FAMILIES as family (family)}
        <option value={family}>{t(`text.${family}`)}</option>
      {/each}
    </select>

    <div class="join">
      <button
        class="btn btn-xs join-item font-serif font-bold {style.weight === 700 ? 'btn-active' : ''}"
        aria-label={t('text.bold')}
        title={t('text.bold')}
        aria-pressed={style.weight === 700}
        onclick={() => onchange({ weight: style.weight === 700 ? 400 : 700 })}
      >B</button>
      <button
        class="btn btn-xs join-item font-serif italic {style.italic ? 'btn-active' : ''}"
        aria-label={t('text.italic')}
        title={t('text.italic')}
        aria-pressed={style.italic}
        onclick={() => onchange({ italic: !style.italic })}
      >I</button>
    </div>

    <div class="join" role="group" aria-label={t('text.align')}>
      {#each TEXT_ALIGNS as align (align)}
        <button
          class="btn btn-xs btn-square join-item {style.align === align ? 'btn-active' : ''}"
          aria-label={t(`text.${align}`)}
          title={t(`text.${align}`)}
          aria-pressed={style.align === align}
          onclick={() => onchange({ align })}
        >
          <!-- Linhas desalinhadas do lado certo: o próprio desenho do
               alinhamento, que dispensa rótulo em qualquer língua. -->
          <svg viewBox="0 0 16 16" class="size-3.5" aria-hidden="true">
            <g fill="currentColor">
              <rect x="1" y="3" width="14" height="1.6" rx="0.8" />
              <rect x={align === 'left' ? 1 : align === 'center' ? 3.5 : 6} y="7.2" width="9" height="1.6" rx="0.8" />
              <rect x="1" y="11.4" width="14" height="1.6" rx="0.8" />
            </g>
          </svg>
        </button>
      {/each}
    </div>

    <button
      bind:this={swatch}
      class="swatch"
      style:background-color={hexOf(style.color as Rgb)}
      aria-label={t('text.color')}
      title={t('text.color')}
      onclick={() => (pickingColor = !pickingColor)}
    ></button>
  </div>

  <div class="grid grid-cols-2 gap-1">
    <label class="flex items-center gap-1 text-[10px] text-base-content/45">
      {t('text.lineHeight')}
      <input
        class="input input-xs min-w-0 flex-1 px-1 text-center tabular-nums"
        type="number"
        min={LINE_HEIGHT.min} max={LINE_HEIGHT.max} step={LINE_HEIGHT.step}
        value={style.lineHeight}
        oninput={(e) => onchange({ lineHeight: +e.currentTarget.value })}
      />
    </label>
    <label class="flex items-center gap-1 text-[10px] text-base-content/45">
      {t('text.tracking')}
      <input
        class="input input-xs min-w-0 flex-1 px-1 text-center tabular-nums"
        type="number"
        min={TRACKING.min} max={TRACKING.max} step={TRACKING.step}
        value={style.tracking}
        oninput={(e) => onchange({ tracking: +e.currentTarget.value })}
      />
    </label>
  </div>
</Popover>

{#if pickingColor && swatch}
  <!-- O mesmo seletor da lista de fontes, e não um segundo escrito aqui: a cor
       do texto é uma cor como qualquer outra. -->
  <ColorPicker
    rgb={style.color as Rgb}
    anchor={swatch}
    onpick={(color) => onchange({ color })}
    onclose={() => (pickingColor = false)}
  />
{/if}

<style>
  .title { flex: 1; font-size: 11px; opacity: 0.7; }
  /* Mesma amostra da lista de fontes: um botão que é a própria cor. */
  .swatch {
    width: 28px; height: 24px; flex: none; border-radius: 4px; cursor: pointer;
    border: 1px solid var(--color-base-300, #393939);
  }
</style>
