<script lang="ts">
  import Icon from './Icon.svelte';
  import { store, flash, getEngine } from './state.svelte.ts';
  import { newId, listCameras, type Source } from '../engine/index.ts';
  import { importFile } from './project-folder.ts';
  import { t } from './i18n/index.svelte.ts';

  const s = $derived(
    $store.project.surfaces.find((x) => x.id === $store.view.selectedSurfaceId) ?? null,
  );

  let cameras = $state<{ deviceId: string; label: string }[]>([]);

  /** Só faz sentido buscar quando existe câmera em uso: os rótulos ficam vazios
   *  até a permissão ser concedida uma vez. */
  $effect(() => {
    if (!$store.project.sources.some((src) => src.kind === 'camera')) return;
    void listCameras().then((list) => { cameras = list; });
  });

  function add(source: Source): void {
    store.addSource(source);
    if (s) store.setSurfaceSource(s.id, source.id);
  }

  function addColor(): void {
    add({ id: newId('src'), name: t('sources.white'), kind: 'color', rgb: [255, 255, 255] });
  }
  function addCapture(): void {
    add({ id: newId('src'), name: t('sources.screenCapture'), kind: 'capture' });
  }
  function addCamera(): void {
    add({ id: newId('src'), name: t('sources.camera'), kind: 'camera' });
  }

  /**
   * Módulo JS do usuário: qualquer arquivo que exporte `draw(ctx, t)` vira uma
   * fonte generativa. O arquivo é copiado para a pasta do projeto como qualquer
   * mídia, então o projeto continua sendo uma pasta que se carrega inteira.
   */
  async function addModule(e: Event): Promise<void> {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const path = await importFile(file);
    add({ id: newId('src'), name: file.name, kind: 'canvas', moduleId: path });
  }

  async function addFiles(e: Event): Promise<void> {
    const input = e.currentTarget as HTMLInputElement;
    for (const file of Array.from(input.files ?? [])) {
      const path = await importFile(file);
      const kind = file.type === 'image/gif' ? 'gif' : file.type.startsWith('video/') ? 'video' : 'image';
      add(kind === 'video'
        ? { id: newId('src'), name: file.name, kind, path, loop: true, muted: true, rate: 1 }
        : { id: newId('src'), name: file.name, kind, path });
    }
    input.value = '';
  }

  /**
   * Status vindo do pool, espelhado em estado do Svelte.
   *
   * O pool é da engine e não é reativo: lido direto na renderização, o texto de
   * status congelava em "carregando…" até outra coisa forçar um redesenho. A
   * cópia é atualizada por um relógio lento e só quando algo muda de verdade,
   * então a lista não pisca a cada tique.
   */
  type SourceStatus = { text: string; bad: boolean };
  let statuses = $state<Record<string, SourceStatus>>({});

  $effect(() => {
    const ids = $store.project.sources.map((src) => src.id);
    const read = (): Record<string, SourceStatus> => {
      const pool = getEngine()?.pool;
      const next: Record<string, SourceStatus> = {};
      for (const id of ids) {
        const src = pool?.get(id);
        if (!src) continue;
        if (src.status === 'error') {
          next[id] = { text: src.error ? t(`sourceError.${src.error.code}`) : t('sources.error'), bad: true };
        } else if (src.status === 'loading') {
          next[id] = { text: t('sources.loading'), bad: false };
        } else {
          next[id] = { text: `${src.size[0]}×${src.size[1]}`, bad: false };
        }
      }
      return next;
    };

    const sync = (): void => {
      const next = read();
      // Comparação campo a campo em vez de serializar os dois lados a cada
      // tique: são poucos itens e isso roda num relógio.
      const changed =
        Object.keys(next).length !== Object.keys(statuses).length ||
        Object.entries(next).some(([id, value]) => {
          const before = statuses[id];
          return !before || before.text !== value.text || before.bad !== value.bad;
        });
      if (changed) statuses = next;
    };
    sync();

    // O relógio só existe enquanto algo pode mudar sozinho: uma fonte ainda
    // carregando, ou um stream que pode ser encerrado por fora (captura de tela
    // parada pelo usuário, câmera desconectada). Arquivo já carregado e cor
    // sólida nunca mudam sem uma mutação — e mutação já redesenha por conta.
    const watchable = $store.project.sources.some((src) => {
      if (src.kind === 'capture' || src.kind === 'camera') return true;
      return statuses[src.id] === undefined || statuses[src.id]?.text === t('sources.loading');
    });
    if (!watchable) return;

    const timer = setInterval(sync, 400);
    return () => clearInterval(timer);
  });

  function statusOf(id: string): SourceStatus {
    return statuses[id] ?? { text: '', bad: false };
  }

  /**
   * Aponta uma fonte de arquivo para outro arquivo.
   *
   * O brief pede oferecer religar quando a mídia sumir, e até aqui só existia o
   * padrão magenta avisando que sumiu. Também é a saída de quem abriu sem pasta:
   * a mídia em memória não sobrevive a um reinício, e religar reconstrói o
   * projeto sem apagar e recriar as fontes.
   */
  async function relink(e: Event, source: Source): Promise<void> {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const path = await importFile(file);
    // Qual campo recebe o caminho depende do tipo da fonte; o store estreita.
    store.relinkSource(source.id, path);
  }

  const RELINKABLE = new Set(['image', 'video', 'gif', 'canvas']);
</script>

<section class="px-4 py-3">
  <h2 class="text-[10px] font-semibold uppercase tracking-[0.14em] text-base-content/45">{t('sources.title')}</h2>
  <p class="mt-1 text-[11px] leading-relaxed text-base-content/55">
    {t('sources.blurb')}
  </p>

  <div class="mt-2.5 grid grid-cols-2 gap-1.5">
    <label class="btn btn-xs">
      {t('sources.file')}
      <input type="file" accept="image/*,video/*" multiple class="hidden" onchange={addFiles} />
    </label>
    <button class="btn btn-xs" onclick={addColor}>{t('sources.color')}</button>
    <button
      class="btn btn-xs"
      onclick={addCapture}
      title={t('sources.captureHint')}
    >{t('sources.capture')}</button>
    <button class="btn btn-xs" onclick={addCamera}>{t('sources.camera')}</button>
    <label class="btn btn-xs col-span-2" title={t('sources.moduleHint')}>
      {t('sources.module')}
      <input type="file" accept=".js,.mjs,text/javascript" class="hidden" onchange={addModule} />
    </label>
  </div>

  {#if $store.project.sources.length > 0}
    <ul class="mt-2 flex flex-col gap-0.5">
      {#each $store.project.sources as source (source.id)}
        {@const status = statusOf(source.id)}
        <li
          class="flex items-center gap-1 rounded-md border px-1 py-0.5 transition-colors {s?.sourceId === source.id
            ? 'border-primary bg-primary/10'
            : 'border-transparent hover:bg-base-200'}"
        >
          {#if source.kind === 'color'}
            <span
              class="ml-1 size-3 shrink-0 rounded border border-base-content/20"
              style:background={`rgb(${source.rgb.join(',')})`}
            ></span>
          {/if}

          <button
            class="min-w-0 flex-1 px-1 py-0.5 text-left"
            onclick={() => s ? store.setSurfaceSource(s.id, source.id) : flash(t('surfaces.selectFirst'))}
          >
            <span class="block truncate text-[13px] leading-tight">{source.name}</span>
            <span class="block truncate text-[10px] leading-tight {status.bad ? 'text-error' : 'text-base-content/45'}">
              {source.kind}{status.text ? ` · ${status.text}` : ''}
            </span>
          </button>

          {#if source.kind === 'camera' && cameras.length > 1}
            <select
              class="select select-xs w-24"
              value={source.deviceId ?? ''}
              title={t('sources.switchCamera')}
              onchange={(e) => store.setCameraDevice(source.id, e.currentTarget.value)}
            >
              {#each cameras as cam (cam.deviceId)}
                <option value={cam.deviceId}>{cam.label}</option>
              {/each}
            </select>
          {/if}

          {#if source.kind === 'color'}
            <input
              type="color"
              class="h-6 w-7 shrink-0 cursor-pointer rounded border border-base-300 bg-base-100"
              value={`#${source.rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`}
              oninput={(e) => {
                const hex = e.currentTarget.value;
                const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
                store.setSourceColor(source.id, [r ?? 0, g ?? 0, b ?? 0]);
              }}
            />
          {/if}

          {#if RELINKABLE.has(source.kind)}
            <label
              class="btn btn-xs btn-ghost h-auto min-h-0 px-1 py-0.5 font-normal text-[10px] {status.bad ? 'text-warning' : 'text-base-content/40'}"
              title={t('sources.relinkHint')}
            >
              {t('sources.relink')}
              <input
                type="file"
                accept={source.kind === 'canvas' ? '.js,.mjs,text/javascript' : 'image/*,video/*'}
                class="hidden"
                onchange={(e) => relink(e, source)}
              />
            </label>
          {/if}

          <button
            class="btn btn-xs btn-ghost btn-square text-base-content/40 hover:text-error"
            aria-label={t('sources.removeLabel')}
            title={t('sources.remove')}
            onclick={() => store.removeSource(source.id)}
          >
            <Icon name="trash" class="size-3.5" />
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  {#if s?.sourceId}
    <button class="btn btn-xs btn-ghost btn-block mt-2" onclick={() => store.setSurfaceSource(s.id, null)}>
      {t('sources.clear', { name: s.name })}
    </button>
  {/if}
</section>
