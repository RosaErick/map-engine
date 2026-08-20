<script lang="ts">
  import { store } from './state.svelte.ts';
  import { PATTERNS, patternLabel } from './patterns.ts';
  import type { Blend, Fit, TestPattern } from '../engine/index.ts';

  const s = $derived(
    $store.project.surfaces.find((x) => x.id === $store.view.selectedSurfaceId) ?? null,
  );

  function setShape(kind: 'quad' | 'ellipse'): void {
    if (!s) return;
    store.setSurfaceShape(s.id, kind === 'ellipse' ? { kind: 'ellipse', feather: 0.06 } : { kind: 'quad' });
  }
</script>

<section class="border-b border-base-300 px-4 py-3">
  <h2 class="text-[10px] font-semibold uppercase tracking-[0.14em] text-base-content/45">
    {s ? s.name : 'Superfície'}
  </h2>

  {#if !s}
    <p class="mt-2 text-[11px] leading-relaxed text-base-content/55">
      Selecione uma superfície na lista, ou clique nela na área de trabalho.
    </p>
  {:else}
    <div class="mt-2.5 space-y-3">
      <div>
        <span class="mb-1 block text-[11px] text-base-content/55">forma do recorte</span>
        <div class="join w-full">
          <button
            class="btn btn-xs join-item flex-1"
            class:btn-active={s.shape.kind === 'quad'}
            onclick={() => setShape('quad')}
          >retângulo</button>
          <button
            class="btn btn-xs join-item flex-1"
            class:btn-active={s.shape.kind === 'ellipse'}
            onclick={() => setShape('ellipse')}
          >elipse</button>
          <button
            class="btn btn-xs join-item flex-1"
            class:btn-active={s.shape.kind === 'polygon'}
            disabled
            title="Traçado com a ferramenta polígono"
          >polígono</button>
        </div>
      </div>

      {#if s.shape.kind === 'ellipse'}
        <label class="block" for="feather">
          <span class="mb-1 flex justify-between text-[11px] text-base-content/55">
            <span>borda suave</span><span>{(s.shape.feather * 100).toFixed(0)}%</span>
          </span>
          <input
            id="feather" type="range" min="0" max="1" step="0.01" class="range range-xs range-primary"
            value={s.shape.feather}
            oninput={(e) => store.setSurfaceShape(s.id, { kind: 'ellipse', feather: +e.currentTarget.value })}
          />
        </label>
      {/if}

      <label class="block" for="rotation">
        <span class="mb-1 flex justify-between text-[11px] text-base-content/55">
          <span>rotação do conteúdo</span><span>{s.rotation.toFixed(0)}°</span>
        </span>
        <input
          id="rotation" type="range" min="0" max="359" step="1" class="range range-xs range-primary"
          value={s.rotation}
          oninput={(e) => store.setRotation(s.id, +e.currentTarget.value)}
          onchange={() => store.endGesture()}
        />
        <div class="join mt-2 w-full">
          {#each [0, 90, 180, 270] as deg (deg)}
            <button
              class="btn btn-xs join-item flex-1"
              class:btn-active={Math.round(s.rotation) === deg}
              onclick={() => { store.setRotation(s.id, deg); store.endGesture(); }}
            >{deg}°</button>
          {/each}
        </div>
      </label>

      <label class="block" for="opacity">
        <span class="mb-1 flex justify-between text-[11px] text-base-content/55">
          <span>opacidade</span><span>{(s.opacity * 100).toFixed(0)}%</span>
        </span>
        <input
          id="opacity" type="range" min="0" max="1" step="0.01" class="range range-xs range-primary"
          value={s.opacity}
          oninput={(e) => store.setOpacity(s.id, +e.currentTarget.value)}
          onchange={() => store.endGesture()}
        />
      </label>

      <div class="grid grid-cols-2 gap-2">
        <label class="block" for="fit">
          <span class="mb-1 block text-[11px] text-base-content/55">encaixe</span>
          <select
            id="fit" class="select select-xs w-full" value={s.fit}
            onchange={(e) => store.patchSurface(s.id, { fit: e.currentTarget.value as Fit })}
          >
            <option value="stretch">esticar</option>
            <option value="contain">caber</option>
            <option value="cover">preencher</option>
          </select>
        </label>

        <label class="block" for="blend">
          <span class="mb-1 block text-[11px] text-base-content/55">mistura</span>
          <select
            id="blend" class="select select-xs w-full" value={s.blend}
            onchange={(e) => store.patchSurface(s.id, { blend: e.currentTarget.value as Blend })}
          >
            <option value="normal">normal</option>
            <option value="add">soma</option>
            <option value="screen">screen</option>
            <option value="multiply">multiply</option>
          </select>
        </label>
      </div>

      <label class="block" for="z">
        <span class="mb-1 block text-[11px] text-base-content/55">ordem de desenho</span>
        <input
          id="z" type="number" class="input input-xs w-full" value={s.z}
          onchange={(e) => store.reorder(s.id, +e.currentTarget.value)}
        />
      </label>

      <label class="block" for="surface-pattern">
        <span class="mb-1 block text-[11px] text-base-content/55">padrão de teste desta superfície</span>
        <select
          id="surface-pattern"
          class="select select-xs w-full"
          value={$store.view.surfacePatterns[s.id] ?? ''}
          onchange={(e) => store.setSurfacePattern(s.id, e.currentTarget.value === '' ? null : e.currentTarget.value as TestPattern)}
        >
          <option value="">seguir todas ({patternLabel($store.view.testPattern)})</option>
          {#each PATTERNS as p (p.id)}<option value={p.id}>{p.label}</option>{/each}
        </select>
      </label>

      <p class="rounded-md bg-base-200 px-3 py-2 text-[11px] leading-relaxed text-base-content/60">
        Clique num canto e use as <kbd class="kbd kbd-xs">←</kbd>
        <kbd class="kbd kbd-xs">→</kbd> <kbd class="kbd kbd-xs">↑</kbd>
        <kbd class="kbd kbd-xs">↓</kbd> para mover 1 px — com
        <kbd class="kbd kbd-xs">Shift</kbd>, 10 px. Sem canto selecionado, as setas movem
        a superfície inteira.
      </p>
    </div>
  {/if}
</section>
