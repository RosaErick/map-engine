<script lang="ts">
  import Icon from './Icon.svelte';
  import { REPO_URL } from './links.ts';

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
      <button class="btn btn-ghost btn-sm btn-circle" onclick={() => (open = false)} aria-label="Fechar">
        <Icon name="close" />
      </button>
    </div>

    <!-- Tipografia de jornal: coluna estreita, serifa, fios finos, capitular.
         Fontes do sistema apenas — carregar fonte externa quebraria o uso
         offline, que é a razão de existir do build de arquivo único. -->
    <article class="px-8 pb-10 sm:px-12 font-serif text-base-content max-w-[68ch] mx-auto">
      <p class="text-[0.7rem] uppercase tracking-[0.18em] font-sans font-semibold text-primary">
        Ferramenta · Projeção
      </p>

      <h1 class="mt-3 text-4xl sm:text-5xl leading-[1.08] font-semibold tracking-tight text-pretty">
        Luz que veste
        <span class="italic">objetos reais</span>
      </h1>

      <p class="mt-4 text-lg leading-relaxed text-base-content/70">
        Um projetor, uma parede com quadros, uma pilha de caixas. Você desenha formas
        por cima da projeção que coincidem com as coisas de verdade, e joga conteúdo
        dentro de cada uma.
      </p>

      <div class="mt-6 border-t border-base-content/15"></div>
      <p class="mt-3 text-[0.7rem] uppercase tracking-[0.14em] font-sans text-base-content/50">
        Como funciona
      </p>

      <p class="mt-4 leading-[1.75]
                first-letter:float-left first-letter:mr-2 first-letter:mt-1
                first-letter:text-6xl first-letter:leading-[0.82] first-letter:font-semibold">
        Toda superfície é um quadrilátero de quatro cantos. São eles que carregam a
        perspectiva: você arrasta cada canto até a borda projetada coincidir com a
        borda real do objeto, e o conteúdo se deforma junto. Dentro desse quadrilátero
        cabe um recorte — retângulo, elipse com borda suave, ou um polígono que você
        traça em volta de um objeto torto.
      </p>

      <p class="mt-4 leading-[1.75]">
        O ajuste que decide tudo são as <strong>setas do teclado</strong>: um pixel por
        vez, dez com Shift. É esse acerto fino que separa “quase encaixado” de
        encaixado — e é por isso que dá para travar uma superfície depois de alinhá-la,
        para nunca mais esbarrar nela sem querer.
      </p>

      <blockquote class="my-8 border-l-2 border-primary pl-5">
        <p class="text-2xl leading-snug italic">Preto é transparência.</p>
        <p class="mt-2 text-sm font-sans text-base-content/60">
          Todo pixel preto é ausência de luz, e a superfície física aparece através
          dele. Fora das formas mapeadas, nada é desenhado — nem um cinza, nem uma
          borda, nem um pixel de interface.
        </p>
      </blockquote>

      <p class="leading-[1.75]">
        O conteúdo pode ser imagem, vídeo, GIF, cor sólida, a câmera ao vivo — ou a
        <strong>captura de qualquer janela da máquina</strong>, que transforma um jogo,
        um player ou outra aba em textura projetada.
      </p>

      <div class="mt-8 border-t border-base-content/15"></div>

      <div class="mt-4 font-sans text-sm text-base-content/70 space-y-3">
        <p>
          Funciona sem servidor e sem internet: o app inteiro é um arquivo só, que abre
          com dois cliques e cabe num pendrive.
        </p>
        <p>
          Código aberto sob <strong>AGPL-3.0</strong>. Qualquer um pode usar, estudar e
          contribuir; ninguém pode fechar e revender.
        </p>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          class="btn btn-neutral btn-sm gap-2 no-underline"
        >
          <Icon name="github" />
          Ver o código no GitHub
        </a>
      </div>
    </article>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button aria-label="Fechar">fechar</button>
  </form>
</dialog>
