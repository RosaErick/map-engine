<script lang="ts">
  import Icon from '../ui/Icon.svelte';
  import { store } from '../state.svelte.ts';
  import { isFading, type Scene } from '../../engine/index.ts';
  import { t } from '../i18n/index.svelte.ts';

  /**
   * A barra de cenas, no rodapé do palco.
   *
   * Recolhida por padrão: quem não usa timeline não paga espaço nenhum por ela.
   * O componente fica montado mesmo com a interface escondida — só a marcação
   * some — porque é ele que segura o relógio, e esconder a interface com `H` no
   * meio de um show não pode parar o show.
   */
  let open = $state(false);
  let renaming = $state<string | null>(null);
  /** A cena que a barra está editando. Separada do playhead de propósito: a
   *  timeline avança sozinha, e os campos de `segura`/`transição` não podem
   *  pular de cena embaixo do dedo de quem está digitando. */
  let selectedId = $state<string | null>(null);
  let dragId = $state<string | null>(null);
  let dropIndex = $state<number | null>(null);

  const scenes = $derived($store.project.timeline?.scenes ?? []);
  const loop = $derived($store.project.timeline?.loop ?? false);
  const playback = $derived($store.view.playback);
  const current = $derived(playback ? scenes[playback.sceneIndex] ?? null : null);
  const selectedScene = $derived(scenes.find((s) => s.id === selectedId) ?? null);

  /**
   * O relógio.
   *
   * O tempo decorrido é calculado aqui, a partir de `playback.since`, e nunca
   * escrito no store: é isso que faz um show de quatro horas não custar escrita
   * nenhuma. A única escrita do laço é `advanceIfDue`, que só faz alguma coisa
   * quando uma cena venceu — uma por cena, nunca uma por frame.
   *
   * Ele para sozinho quando não há mais o que animar. O critério é o mesmo que
   * acorda o laço de render da engine (`isFading`): uma transição mexe na
   * opacidade continuamente sem escrever nada, e o playhead precisa acompanhá-la
   * mesmo com o transporte pausado.
   */
  let now = $state(Date.now());

  $effect(() => {
    const state = $store;
    if (!state.view.playback) return;
    now = Date.now();
    if (!state.view.playback.playing && !isFading(state)) return;

    let raf = 0;
    const tick = (): void => {
      now = Date.now();
      const live = store.state;
      if (live.view.playback?.playing) {
        store.advanceIfDue();
      } else if (!isFading(live)) {
        return; // acabou a transição: nada mais se move, o relógio se recolhe
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  });

  const elapsed = $derived(playback ? Math.max(0, (now - playback.since) / 1000) : 0);

  /** Quanto da cena corrente já passou, de 0 a 1. Uma cena de `hold: 0` enche
   *  na transição e fica cheia: dali em diante ela está esperando o GO. */
  const progress = $derived.by(() => {
    if (!current) return 0;
    const span = current.hold > 0 ? current.fade + current.hold : current.fade;
    return span > 0 ? Math.min(1, elapsed / span) : 1;
  });

  const waiting = $derived(!!current && current.hold <= 0 && elapsed >= current.fade);
  const nextIndex = $derived.by(() => {
    if (!playback) return null;
    const next = playback.sceneIndex + 1;
    if (next < scenes.length) return next;
    return loop && scenes.length > 0 ? 0 : null;
  });

  /**
   * Largura do bloco: proporcional a `fade + hold`, com teto e piso.
   *
   * Sem teto, uma cena de dez minutos empurraria todas as outras para fora da
   * tela; sem piso, uma de meio segundo viraria um fio impossível de clicar.
   */
  const PX_PER_SECOND = 22;
  const MIN_WIDTH = 52;
  const MAX_WIDTH = 220;

  function widthOf(scene: Scene): number {
    // `hold: 0` espera o GO: não tem duração para desenhar, então ganha o piso.
    if (scene.hold <= 0) return MIN_WIDTH;
    const span = (scene.fade + scene.hold) * PX_PER_SECOND;
    return Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, span)));
  }

  /** A fatia do bloco que é transição, para o olho separar o que entra do que
   *  segura. */
  function fadeShare(scene: Scene): number {
    const span = scene.hold > 0 ? scene.fade + scene.hold : scene.fade;
    return span > 0 ? Math.min(1, scene.fade / span) : 0;
  }

  function capture(): void {
    store.captureScene(t('timeline.sceneName', { number: scenes.length + 1 }));
    selectedId = store.project.timeline?.scenes.at(-1)?.id ?? null;
  }

  function park(index: number, scene: Scene): void {
    selectedId = scene.id;
    store.goToScene(index);
  }

  function commitRename(id: string, value: string): void {
    const name = value.trim();
    if (name) store.patchScene(id, { name });
    store.endGesture();
    renaming = null;
  }

  /** Manda seguir. É o que `hold: 0` está esperando. */
  function go(): void {
    if (nextIndex !== null) store.goToScene(nextIndex, { playing: true });
  }

  function drop(to: number): void {
    if (dragId) store.moveScene(dragId, to);
    dragId = null;
    dropIndex = null;
  }

  /**
   * Cancela a propagação dos gestos que o palco escuta uma camada acima.
   *
   * Sem isto, clicar num bloco começaria um laço de seleção no palco e rolar a
   * fila de cenas daria zoom no canvas. Uma ação, e não handlers no markup,
   * porque a raiz da barra é um contêiner: pendurar `onpointerdown` nela
   * reprovaria na verificação de acessibilidade por parecer um controle.
   */
  function shield(node: HTMLElement) {
    const stop = (e: Event): void => e.stopPropagation();
    const events = ['pointerdown', 'wheel', 'dblclick', 'dragover', 'drop'];
    for (const name of events) node.addEventListener(name, stop);
    return {
      destroy(): void {
        for (const name of events) node.removeEventListener(name, stop);
      },
    };
  }
</script>

{#if !$store.view.uiHidden}
  <!-- `pointer-events-none` na moldura: só os controles pegam o ponteiro, e o
       resto do rodapé continua sendo palco clicável. -->
  <div class="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-start" use:shield>
    {#if !open}
      <div class="pointer-events-auto m-2 flex items-center gap-1 rounded-full border border-base-300 bg-base-100/90 px-1 py-1 text-base-content shadow-lg backdrop-blur">
        <button
          class="btn btn-ghost btn-xs gap-1.5 rounded-full"
          title={t('timeline.show')}
          onclick={() => (open = true)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-3.5" aria-hidden="true">
            <path d="M4 7h16M4 12h10M4 17h6" stroke-linecap="round" />
          </svg>
          <span class="text-[11px] uppercase tracking-[0.14em]">{t('timeline.title')}</span>
          {#if scenes.length > 0}
            <span class="text-[11px] tabular-nums opacity-50">{scenes.length}</span>
          {/if}
        </button>

        {#if playback}
          <!-- O aviso vem junto mesmo recolhido: com a timeline no comando, o
               controle de opacidade do inspetor parece quebrado sem ele. -->
          <span class="badge badge-primary badge-xs gap-1 px-2 text-[10px]">{t('timeline.live')}</span>
          <button
            class="btn btn-ghost btn-xs btn-square rounded-full"
            aria-label={t('timeline.eject')}
            title={t('timeline.eject')}
            onclick={() => store.eject()}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" class="size-3.5" aria-hidden="true">
              <path d="M12 4 4 14h16L12 4Z" /><rect x="4" y="16.5" width="16" height="3" rx="1" />
            </svg>
          </button>
        {/if}
      </div>
    {:else}
      <div class="pointer-events-auto w-full border-t border-base-300 bg-base-100/95 text-base-content shadow-[0_-4px_16px_rgba(0,0,0,0.25)] backdrop-blur">
        <!-- Transporte. Envolve em tela estreita em vez de espremer: a barra
             precisa continuar operável a 390 px. -->
        <div class="flex flex-wrap items-center gap-1 px-2 py-1.5">
          <div class="join">
            <button
              class="btn btn-xs join-item btn-square"
              disabled={scenes.length === 0}
              aria-label={playback?.playing ? t('timeline.pause') : t('timeline.play')}
              title={playback?.playing ? t('timeline.pause') : t('timeline.play')}
              onclick={() => (playback?.playing ? store.pause() : store.play())}
            >
              {#if playback?.playing}
                <svg viewBox="0 0 24 24" fill="currentColor" class="size-3.5" aria-hidden="true">
                  <rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              {:else}
                <svg viewBox="0 0 24 24" fill="currentColor" class="size-3.5" aria-hidden="true">
                  <path d="M8 5.5v13l11-6.5L8 5.5Z" />
                </svg>
              {/if}
            </button>
            <button
              class="btn btn-xs join-item btn-square"
              disabled={!playback}
              aria-label={t('timeline.eject')}
              title={t('timeline.eject')}
              onclick={() => store.eject()}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" class="size-3.5" aria-hidden="true">
                <path d="M12 4 4 14h16L12 4Z" /><rect x="4" y="16.5" width="16" height="3" rx="1" />
              </svg>
            </button>
            <button
              class="btn btn-xs join-item btn-square"
              class:btn-active={loop}
              aria-pressed={loop}
              disabled={scenes.length === 0}
              aria-label={t('timeline.loop')}
              title={t('timeline.loop')}
              onclick={() => store.setLoop(!loop)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                   stroke-linecap="round" stroke-linejoin="round" class="size-3.5" aria-hidden="true">
                <path d="M17 2.5 20.5 6 17 9.5" /><path d="M3.5 12V9a3 3 0 0 1 3-3h14" />
                <path d="M7 21.5 3.5 18 7 14.5" /><path d="M20.5 12v3a3 3 0 0 1-3 3h-14" />
              </svg>
            </button>
          </div>

          {#if waiting && nextIndex !== null}
            <!-- `hold: 0` segura até alguém mandar seguir. Este é o "alguém". -->
            <button class="btn btn-primary btn-xs font-semibold tracking-[0.14em]" onclick={go}>
              {t('timeline.go')}
            </button>
          {/if}

          {#if playback}
            <span class="badge badge-primary badge-xs px-2 text-[10px]">{t('timeline.live')}</span>
            {#if waiting}
              <span class="text-[11px] text-base-content/55">{t('timeline.waiting')}</span>
            {/if}
          {:else if scenes.length > 0}
            <span class="text-[11px] text-base-content/45">{t('timeline.ejected')}</span>
          {/if}

          <span class="flex-1"></span>

          <button class="btn btn-xs gap-1.5" onclick={capture}>
            <Icon name="plus" class="size-3.5" />
            {t('timeline.capture')}
          </button>
          <button
            class="btn btn-ghost btn-xs btn-square"
            aria-label={t('timeline.hide')}
            title={t('timeline.hide')}
            onclick={() => (open = false)}
          >
            <Icon name="close" class="size-3.5" />
          </button>
        </div>

        {#if scenes.length === 0}
          <!-- Estado vazio que ensina o primeiro passo, no mesmo tom da lista de
               superfícies: o que fazer, e o que a cena vai guardar. -->
          <p class="px-3 pb-2.5 text-[11px] leading-relaxed text-base-content/55">{t('timeline.empty')}</p>
        {:else}
          <ul class="flex items-stretch gap-1 overflow-x-auto px-2 pb-2">
            {#each scenes as scene, i (scene.id)}
              <li class="shrink-0" style:width="{widthOf(scene)}px">
                <button
                  class="relative h-11 w-full overflow-hidden rounded-md border text-left transition-colors
                         {selectedId === scene.id
                           ? 'border-primary bg-primary/15'
                           : 'border-base-300 bg-base-200 hover:border-base-content/25'}"
                  class:opacity-40={dragId === scene.id}
                  class:border-dashed={dropIndex === i && dragId !== scene.id}
                  draggable={renaming !== scene.id}
                  title={t('timeline.rename')}
                  onclick={() => park(i, scene)}
                  ondblclick={() => (renaming = scene.id)}
                  ondragstart={() => (dragId = scene.id)}
                  ondragover={(e) => { e.preventDefault(); dropIndex = i; }}
                  ondrop={(e) => { e.preventDefault(); drop(i); }}
                  ondragend={() => { dragId = null; dropIndex = null; }}
                >
                  <!-- A fatia de transição, para o olho separar o que entra do
                       que segura dentro do mesmo bloco. -->
                  {#if fadeShare(scene) > 0}
                    <span class="pointer-events-none absolute inset-y-0 left-0 bg-base-content/10"
                          style:width="{fadeShare(scene) * 100}%"></span>
                  {/if}

                  {#if current === scene && playback}
                    <span class="pointer-events-none absolute inset-y-0 left-0 bg-primary/20"
                          style:width="{progress * 100}%"></span>
                    <span class="pointer-events-none absolute inset-y-0 w-0.5 bg-primary"
                          style:left="{progress * 100}%"></span>
                  {/if}

                  <span class="relative flex h-full flex-col justify-center gap-0.5 px-1.5">
                    {#if renaming === scene.id}
                      <!-- svelte-ignore a11y_autofocus -->
                      <input
                        autofocus
                        class="input input-xs w-full"
                        value={scene.name}
                        onclick={(e) => e.stopPropagation()}
                        onblur={(e) => commitRename(scene.id, e.currentTarget.value)}
                        onkeydown={(e) => { if (e.key === 'Enter') commitRename(scene.id, e.currentTarget.value); }}
                      />
                    {:else}
                      <span class="truncate text-[11px] leading-tight">{scene.name}</span>
                      <span class="flex items-center gap-1 text-[10px] tabular-nums text-base-content/50">
                        {#if scene.hold <= 0}
                          <span class="font-semibold tracking-[0.1em] text-warning">{t('timeline.go')}</span>
                        {:else}
                          <span>{scene.hold}{t('timeline.seconds')}</span>
                        {/if}
                      </span>
                    {/if}
                  </span>
                </button>
              </li>
            {/each}
          </ul>

          {#if selectedScene}
            <!-- Só a cena escolhida abre os campos: são dois números por cena, e
                 abri-los em todas viraria uma planilha. -->
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-base-300 px-3 py-1.5">
              <span class="max-w-[9rem] truncate text-[11px] text-base-content/70">{selectedScene.name}</span>

              <label class="flex items-center gap-1 text-[11px] text-base-content/55">
                {t('timeline.fade')}
                <input
                  class="input input-xs w-14 tabular-nums"
                  type="number" min="0" step="0.1" value={selectedScene.fade}
                  oninput={(e) => store.patchScene(selectedScene.id, { fade: e.currentTarget.valueAsNumber || 0 })}
                  onchange={() => store.endGesture()}
                />
                {t('timeline.seconds')}
              </label>

              <label class="flex items-center gap-1 text-[11px] text-base-content/55">
                {t('timeline.hold')}
                <input
                  class="input input-xs w-14 tabular-nums"
                  type="number" min="0" step="0.5" value={selectedScene.hold}
                  oninput={(e) => store.patchScene(selectedScene.id, { hold: e.currentTarget.valueAsNumber || 0 })}
                  onchange={() => store.endGesture()}
                />
                {t('timeline.seconds')}
              </label>

              {#if selectedScene.hold <= 0}
                <span class="text-[10px] uppercase tracking-[0.1em] text-warning">{t('timeline.waiting')}</span>
              {/if}

              <span class="flex-1"></span>

              <button
                class="btn btn-ghost btn-xs btn-square text-base-content/50 hover:text-error"
                aria-label={t('timeline.remove')}
                title={t('timeline.remove')}
                onclick={() => store.removeScene(selectedScene.id)}
              >
                <Icon name="trash" class="size-3.5" />
              </button>
            </div>
          {/if}
        {/if}
      </div>
    {/if}
  </div>
{/if}
