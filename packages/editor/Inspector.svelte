<script lang="ts">
  import { store } from './state.svelte.ts';
  import type { Blend, Fit } from '../engine/index.ts';

  const s = $derived(
    $store.project.surfaces.find((x) => x.id === $store.view.selectedSurfaceId) ?? null,
  );

  function setShape(kind: 'quad' | 'ellipse'): void {
    if (!s) return;
    store.setSurfaceShape(s.id, kind === 'ellipse' ? { kind: 'ellipse', feather: 0.06 } : { kind: 'quad' });
  }
</script>

<section>
  <h2>Superfície</h2>
  {#if !s}
    <p class="empty">Selecione uma superfície.</p>
  {:else}
    <label for="shape">forma</label>
    <div class="row">
      <button class:on={s.shape.kind === 'quad'} onclick={() => setShape('quad')}>quad</button>
      <button class:on={s.shape.kind === 'ellipse'} onclick={() => setShape('ellipse')}>elipse</button>
      <button class:on={s.shape.kind === 'polygon'} disabled title="Trace com a ferramenta polígono">polígono</button>
    </div>

    {#if s.shape.kind === 'ellipse'}
      <label for="feather">feather {s.shape.feather.toFixed(2)}</label>
      <input
        id="feather" type="range" min="0" max="1" step="0.01"
        value={s.shape.feather}
        oninput={(e) => store.setSurfaceShape(s.id, { kind: 'ellipse', feather: +e.currentTarget.value })}
      />
    {/if}

    <label for="opacity">opacidade {(s.opacity * 100).toFixed(0)}%</label>
    <input id="opacity" type="range" min="0" max="1" step="0.01" value={s.opacity}
      oninput={(e) => store.setOpacity(s.id, +e.currentTarget.value)}
      onchange={() => store.endGesture()} />

    <label for="fit">encaixe</label>
    <select id="fit" value={s.fit} onchange={(e) => store.patchSurface(s.id, { fit: e.currentTarget.value as Fit })}>
      <option value="stretch">esticar</option>
      <option value="contain">caber</option>
      <option value="cover">preencher</option>
    </select>

    <label for="blend">mistura</label>
    <select id="blend" value={s.blend} onchange={(e) => store.patchSurface(s.id, { blend: e.currentTarget.value as Blend })}>
      <option value="normal">normal</option>
      <option value="add">soma</option>
      <option value="screen">screen</option>
      <option value="multiply">multiply</option>
    </select>

    <label for="z">ordem (z)</label>
    <input id="z" type="number" value={s.z} onchange={(e) => store.reorder(s.id, +e.currentTarget.value)} />

    <p class="hint">
      Setas movem 1px, com Shift 10px. Clique num canto para ajustá-lo; sem canto
      selecionado as setas movem a superfície inteira.
    </p>
  {/if}
</section>

<style>
  section { padding: 10px; border-bottom: 1px solid var(--line); }
  h2 { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); margin: 0 0 8px; }
  .row { display: flex; gap: 4px; }
  select, input[type='number'] { width: 100%; }
  .empty, .hint { color: var(--muted); line-height: 1.5; margin: 8px 0 0; }
</style>
