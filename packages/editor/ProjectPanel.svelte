<script lang="ts">
  import { store, ui, flash, getEngine } from './state.svelte.ts';
  import { openFolder, save, downloadProject, hasFileSystemAccess, invalidateUrls, resolveUrl } from './project-folder.ts';
  import { openOutput, listScreens, type OutputScreen } from '../output/output.ts';

  // As telas são enumeradas na montagem, e não no clique: pedir a lista dentro
  // do handler gastaria a ativação de usuário que window.open e
  // requestFullscreen ainda precisam.
  let screens = $state<OutputScreen[]>([]);
  let screenIndex = $state(0);
  let output = $state<{ close(): void } | null>(null);

  const servedOverHttp = location.protocol.startsWith('http');

  $effect(() => {
    void listScreens().then((list) => {
      screens = list;
      const external = list.findIndex((s) => !s.isInternal);
      if (list.length > 1) screenIndex = external >= 0 ? external : 1;
    });
  });

  function screenLabel(s: OutputScreen, i: number): string {
    return `${i + 1}. ${s.label || (s.isInternal ? 'notebook' : 'externa')} — ${s.width}×${s.height}`;
  }

  /** A saída tem que ser a resolução nativa do projetor: escalonar duas vezes
   *  borra exatamente o que foi alinhado com precisão de pixel. */
  function matchScreen(): void {
    const s = screens[screenIndex];
    if (!s) return;
    store.setOutputSize(Math.round(s.width * s.devicePixelRatio), Math.round(s.height * s.devicePixelRatio));
    flash(`Saída em ${store.project.output.width}×${store.project.output.height}.`);
  }

  async function onOpenFolder(): Promise<void> {
    try {
      const json = await openFolder();
      invalidateUrls();
      if (json) store.load(json);
      ui.hasFolder = true;
      ui.folderName = 'pasta aberta';
      flash(json ? 'Projeto carregado.' : 'Pasta vazia: projeto novo.');
    } catch (e) {
      flash(String((e as Error).message ?? e));
    }
  }

  function onOutput(): void {
    if (output) { output.close(); return; }
    const pool = getEngine()?.pool;
    const screen = screens[screenIndex];
    output = openOutput(store, {
      ...(screens[screenIndex] ? { screen: screens[screenIndex] } : {}),
      // Um decode, um pedido de permissão de captura: a saída pega emprestadas
      // as fontes do editor em vez de montar as suas.
      ...(pool ? { pool } : {}),
      resolveUrl,
      onWarn: flash,
      onClose: () => {
        output = null;
        ui.outputOpen = false;
        ui.outputScreen = '';
      },
    });
    ui.outputOpen = !!output;
    ui.outputScreen = output && screen ? (screen.label || `tela ${screenIndex + 1}`) : '';
  }
</script>

<!-- Abrir pasta e casar resolução são trabalho de começo e de fim de montagem.
     Ficam recolhidos assim que existe uma pasta, para o painel não empurrar as
     superfícies para fora da tela durante o alinhamento, que é o trabalho real. -->
<details class="collapse-arrow collapse border-b border-base-300 rounded-none" open={!ui.hasFolder}>
  <summary class="collapse-title min-h-0 px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-base-content/45">
    Projeto e saída
  </summary>
  <div class="collapse-content px-4 pb-4">
  <p class="text-[11px] leading-relaxed text-base-content/55">
    Um projeto é uma pasta: o arquivo do projeto e a mídia ficam lado a lado, e tudo é
    salvo sozinho.
  </p>

  <div class="mt-3 flex flex-wrap gap-2">
    <button class="btn btn-xs" onclick={onOpenFolder} disabled={!hasFileSystemAccess}>
      abrir pasta
    </button>
    <button class="btn btn-xs btn-ghost" onclick={() => save(store, (w) => flash(`Salvo em ${w}.`), flash)}>
      salvar agora
    </button>
    {#if !hasFileSystemAccess}
      <button class="btn btn-xs btn-ghost" onclick={() => downloadProject(store)}>baixar json</button>
    {/if}
  </div>
  {#if ui.folderName}
    <p class="mt-2 text-[11px] text-base-content/50">{ui.folderName}</p>
  {/if}

  <div class="divider my-4"></div>

  <h3 class="text-[10px] font-semibold uppercase tracking-[0.14em] text-base-content/45">Projetor</h3>
  <p class="mt-1 text-[11px] leading-relaxed text-base-content/55">
    A resolução precisa ser a nativa do projetor.
  </p>

  {#if screens.length > 1}
    <select class="select select-xs mt-3 w-full" bind:value={screenIndex}>
      {#each screens as s, i (i)}<option value={i}>{screenLabel(s, i)}</option>{/each}
    </select>
    <button class="btn btn-xs btn-block mt-2" onclick={matchScreen}>
      casar resolução com esta tela
    </button>
  {/if}

  <div class="mt-3 flex items-center gap-2">
    <input
      type="number"
      class="input input-xs w-full"
      aria-label="Largura da saída"
      value={$store.project.output.width}
      onchange={(e) => store.setOutputSize(+e.currentTarget.value, $store.project.output.height)}
    />
    <span class="text-base-content/40">×</span>
    <input
      type="number"
      class="input input-xs w-full"
      aria-label="Altura da saída"
      value={$store.project.output.height}
      onchange={(e) => store.setOutputSize($store.project.output.width, +e.currentTarget.value)}
    />
  </div>

  <button
    class="btn btn-sm btn-block mt-3"
    class:btn-primary={!output}
    class:btn-outline={!!output}
    onclick={onOutput}
  >
    {output ? 'fechar saída' : 'enviar para o projetor'}
  </button>

  {#if servedOverHttp}
    <a
      class="btn btn-xs btn-ghost btn-block mt-2 font-normal"
      href="./index.html"
      download="projection-mapping.html"
      title="Um arquivo só: abre sem servidor e sem internet"
    >
      baixar para uso offline
    </a>
  {/if}
  </div>
</details>
