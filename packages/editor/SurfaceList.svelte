<script lang="ts">
  import { store } from './state.svelte.ts';

  let renaming = $state<string | null>(null);

  function commitRename(id: string, value: string): void {
    const name = value.trim();
    if (name) store.patchSurface(id, { name });
    renaming = null;
  }

  const ordered = $derived([...$store.project.surfaces].sort((a, b) => b.z - a.z));
</script>

<section>
  <h2>Superfícies</h2>
  {#if ordered.length === 0}
    <p class="empty">Nenhuma superfície. Clique em “+ superfície” e arraste os cantos até cobrir o objeto real.</p>
  {/if}
  <ul>
    {#each ordered as s (s.id)}
      <li class:sel={$store.view.selectedSurfaceId === s.id}>
        <button class="name" onclick={() => store.setView({ selectedSurfaceId: s.id, selectedCorner: null })} ondblclick={() => (renaming = s.id)}>
          {#if renaming === s.id}
            <!-- svelte-ignore a11y_autofocus -->
            <input
              autofocus
              value={s.name}
              onblur={(e) => commitRename(s.id, e.currentTarget.value)}
              onkeydown={(e) => { if (e.key === 'Enter') commitRename(s.id, e.currentTarget.value); }}
            />
          {:else}
            {s.name}
          {/if}
        </button>
        <button class:on={$store.view.soloId === s.id} title="solo" onclick={() => store.toggleSolo(s.id)}>S</button>
        <button class:on={!s.visible} title="mudo" onclick={() => store.toggleVisible(s.id)}>M</button>
        <button class:on={s.locked} title="travar" onclick={() => store.toggleLock(s.id)}>🔒</button>
      </li>
    {/each}
  </ul>
  <div class="row">
    <button onclick={() => store.addSurface()}>nova</button>
    <button
      disabled={!$store.view.selectedSurfaceId}
      onclick={() => store.duplicateSurface($store.view.selectedSurfaceId!)}
    >duplicar</button>
    <button
      class="danger"
      disabled={!$store.view.selectedSurfaceId}
      onclick={() => store.removeSurface($store.view.selectedSurfaceId!)}
    >apagar</button>
  </div>
</section>

<style>
  section { padding: 10px; border-bottom: 1px solid var(--line); }
  h2 { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); margin: 0 0 8px; }
  ul { list-style: none; margin: 0 0 8px; padding: 0; display: flex; flex-direction: column; gap: 3px; }
  li { display: flex; gap: 3px; align-items: center; }
  li.sel .name { border-color: var(--accent); }
  .name { flex: 1; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .name input { width: 100%; padding: 0; border: none; background: none; }
  .row { display: flex; gap: 4px; }
  .danger:hover { border-color: var(--danger); color: var(--danger); }
  .empty { color: var(--muted); margin: 0 0 8px; line-height: 1.5; }
</style>
