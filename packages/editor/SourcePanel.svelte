<script lang="ts">
  import { store, flash, getEngine } from './state.svelte.ts';
  import { newId, type Source } from '../engine/index.ts';
  import { importFile } from './project-folder.ts';

  const s = $derived(
    $store.project.surfaces.find((x) => x.id === $store.view.selectedSurfaceId) ?? null,
  );

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

  /** Live status straight from the pool, so a missing file is visible here and
   *  not only as a magenta rectangle on the wall. */
  function statusOf(id: string): string {
    const src = getEngine()?.pool.get(id);
    if (!src) return '';
    if (src.status === 'error') return src.error ?? 'erro';
    if (src.status === 'loading') return 'carregando…';
    return `${src.size[0]}x${src.size[1]}`;
  }

  function colorOf(source: Source): string {
    return source.kind === 'color' ? `rgb(${source.rgb.join(',')})` : 'transparent';
  }
</script>

<section>
  <h2>Fontes</h2>
  <div class="row wrap">
    <button onclick={addColor}>cor</button>
    <button onclick={addCapture} title="getDisplayMedia: qualquer janela da máquina vira textura">captura</button>
    <button onclick={addCamera}>câmera</button>
    <label class="file">
      arquivo
      <input type="file" accept="image/*,video/*" multiple onchange={addFiles} />
    </label>
  </div>

  <ul>
    {#each $store.project.sources as source (source.id)}
      <li class:sel={s?.sourceId === source.id}>
        <span class="swatch" style:background={colorOf(source)}></span>
        <button
          class="name"
          onclick={() => s ? store.setSurfaceSource(s.id, source.id) : flash('Selecione uma superfície primeiro.')}
          title={statusOf(source.id)}
        >
          <span class="kind">{source.kind}</span>{source.name}
        </button>
        {#if source.kind === 'color'}
          <input
            type="color"
            value={`#${source.rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`}
            oninput={(e) => {
              const hex = e.currentTarget.value;
              store.patchSource(source.id, { rgb: [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) } as Partial<Source>);
            }}
          />
        {/if}
        <button class="x" title="remover" onclick={() => store.removeSource(source.id)}>×</button>
      </li>
    {/each}
  </ul>

  {#if s}
    <button class="clear" onclick={() => store.setSurfaceSource(s.id, null)}>
      tirar fonte de “{s.name}”
    </button>
  {/if}
  <p class="hint">Arraste um arquivo direto para cima de uma superfície para atribuir.</p>
</section>

<style>
  section { padding: 10px; }
  h2 { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); margin: 0 0 8px; }
  .row { display: flex; gap: 4px; }
  .row.wrap { flex-wrap: wrap; }
  ul { list-style: none; margin: 8px 0; padding: 0; display: flex; flex-direction: column; gap: 3px; }
  li { display: flex; gap: 3px; align-items: center; }
  li.sel .name { border-color: var(--accent); }
  .name { flex: 1; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .kind { color: var(--muted); margin-right: 6px; }
  .swatch { width: 10px; height: 10px; border-radius: 2px; border: 1px solid var(--line); flex: none; }
  .file { display: inline-block; margin: 0; padding: 4px 8px; border: 1px solid var(--line); border-radius: 6px; background: var(--panel-2); color: var(--text); cursor: pointer; }
  .file input { display: none; }
  input[type='color'] { width: 28px; padding: 0; height: 24px; }
  .x:hover { border-color: var(--danger); color: var(--danger); }
  .clear { width: 100%; }
  .hint { color: var(--muted); line-height: 1.5; }
</style>
