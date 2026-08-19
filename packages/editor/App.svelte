<script lang="ts">
  import Stage from './Stage.svelte';
  import Toolbar from './Toolbar.svelte';
  import SurfaceList from './SurfaceList.svelte';
  import Inspector from './Inspector.svelte';
  import SourcePanel from './SourcePanel.svelte';
  import { store, ui, selected, flash } from './state.svelte.ts';
  import { scheduleSave, localProject, hasFileSystemAccess } from './project-folder.ts';

  // Autosave on every change. Half an hour of alignment must never depend on
  // the user remembering ctrl+S while standing on a ladder.
  let firstRun = true;
  $effect(() => {
    void $store.project;
    if (firstRun) { firstRun = false; return; }
    scheduleSave(store, (where) => { ui.folderName = where; }, flash);
  });

  $effect(() => {
    if (!hasFileSystemAccess) {
      flash('Sem File System Access: o projeto fica na memória do navegador. Use Chrome ou Edge para salvar em pasta.');
      const saved = localProject();
      if (saved) { try { store.load(saved); } catch { /* corrupt autosave, start clean */ } }
    }
  });

  /** Nudging is what separates "almost aligned" from aligned. Arrows move the
   *  selected corner by 1px, or the whole surface when no corner is picked. */
  function onKeyDown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement | null;
    if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

    if (e.key === 'Control') ui.snapOff = true;

    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      e.shiftKey ? store.redo() : store.undo();
      return;
    }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); store.redo(); return; }

    const s = selected();
    if (mod && e.key.toLowerCase() === 'd' && s) { e.preventDefault(); store.duplicateSurface(s.id); return; }

    if (e.key === 'Escape') {
      ui.pendingPolygon = [];
      ui.tool = 'select';
      store.setView({ selectedCorner: null });
      return;
    }
    if (e.key.toLowerCase() === 'h') { store.setView({ uiHidden: !$store.view.uiHidden }); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && s) { store.removeSurface(s.id); return; }

    const step = e.shiftKey ? 10 : 1;
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
    };
    const d = delta[e.key];
    if (d && s) {
      e.preventDefault();
      const corner = $store.view.selectedCorner;
      if (corner !== null) store.nudgeCorner(s.id, corner, d[0], d[1]);
      else store.moveSurface(s.id, d[0], d[1]);
    }
  }

  function onKeyUp(e: KeyboardEvent): void {
    if (e.key === 'Control') ui.snapOff = false;
    if (e.key.startsWith('Arrow')) store.endGesture();
  }
</script>

<svelte:window onkeydown={onKeyDown} onkeyup={onKeyUp} />

<div class="app" class:clean={$store.view.uiHidden}>
  {#if !$store.view.uiHidden}
    <Toolbar />
  {/if}
  <div class="body">
    <Stage />
    {#if !$store.view.uiHidden}
      <aside class="sidebar">
        <SurfaceList />
        <Inspector />
        <SourcePanel />
      </aside>
    {/if}
  </div>
  {#if ui.status && !$store.view.uiHidden}
    <div class="status">{ui.status}</div>
  {/if}
</div>

<style>
  .app { display: flex; flex-direction: column; height: 100%; }
  .body { display: flex; flex: 1; min-height: 0; }
  .sidebar {
    width: 300px;
    border-left: 1px solid var(--line);
    background: var(--panel);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }
  .status {
    position: fixed; bottom: 12px; left: 12px;
    background: var(--panel-2); border: 1px solid var(--accent);
    padding: 8px 12px; border-radius: 8px; max-width: 60ch;
  }
  /* Clean output mode: no UI pixels exist at all. */
  .app.clean { background: #000; }
</style>
