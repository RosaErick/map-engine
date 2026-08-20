<script lang="ts">
  import Icon from './Icon.svelte';
  import { store, flash, getEngine } from './state.svelte.ts';
  import { newId, listCameras, type Source } from '../engine/index.ts';
  import { importFile } from './project-folder.ts';

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
    add({ id: newId('src'), name: 'branco', kind: 'color', rgb: [255, 255, 255] });
  }
  function addCapture(): void {
    add({ id: newId('src'), name: 'captura de tela', kind: 'capture' });
  }
  function addCamera(): void {
    add({ id: newId('src'), name: 'câmera', kind: 'camera' });
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

  /** Status vindo direto do pool: arquivo faltando aparece aqui e não só como
   *  retângulo magenta na parede. */
  function statusOf(id: string): { text: string; bad: boolean } {
    const src = getEngine()?.pool.get(id);
    if (!src) return { text: '', bad: false };
    if (src.status === 'error') return { text: src.error ?? 'erro', bad: true };
    if (src.status === 'loading') return { text: 'carregando…', bad: false };
    return { text: `${src.size[0]}×${src.size[1]}`, bad: false };
  }
</script>

<section class="px-4 py-3">
  <h2 class="text-[10px] font-semibold uppercase tracking-[0.14em] text-base-content/45">Conteúdo</h2>
  <p class="mt-1 text-[11px] leading-relaxed text-base-content/55">
    Solte um arquivo direto em cima de uma superfície, ou escolha uma fonte aqui.
  </p>

  <div class="mt-2.5 grid grid-cols-2 gap-1.5">
    <label class="btn btn-xs">
      arquivo
      <input type="file" accept="image/*,video/*" multiple class="hidden" onchange={addFiles} />
    </label>
    <button class="btn btn-xs" onclick={addColor}>cor</button>
    <button
      class="btn btn-xs"
      onclick={addCapture}
      title="Qualquer janela da máquina vira textura ao vivo: um jogo, um player, outra aba"
    >captura de tela</button>
    <button class="btn btn-xs" onclick={addCamera}>câmera</button>
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
            onclick={() => s ? store.setSurfaceSource(s.id, source.id) : flash('Selecione uma superfície primeiro.')}
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
              title="Trocar de câmera"
              onchange={(e) => store.patchSource(source.id, { deviceId: e.currentTarget.value } as Partial<Source>)}
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
                store.patchSource(source.id, { rgb: [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) } as Partial<Source>);
              }}
            />
          {/if}

          <button
            class="btn btn-xs btn-ghost btn-square text-base-content/40 hover:text-error"
            aria-label="Remover fonte"
            title="Remover esta fonte do projeto"
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
      apagar o conteúdo de “{s.name}”
    </button>
  {/if}
</section>
