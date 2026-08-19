<script lang="ts">
  import { drag } from './actions.ts';
  import { store, ui, toScreen, toOutput, snapPoint } from './state.svelte.ts';
  import type { Surface, Vec2 } from '../engine/index.ts';

  const HANDLE = 7;

  function screenPath(frame: readonly Vec2[]): string {
    return frame.map((c, i) => `${i === 0 ? 'M' : 'L'}${fmt(toScreen(c))}`).join(' ') + ' Z';
  }
  function fmt(p: Vec2): string { return `${p.x.toFixed(1)},${p.y.toFixed(1)}`; }

  function isSelected(s: Surface): boolean { return $store.view.selectedSurfaceId === s.id; }

  function pickCorner(s: Surface, i: number): void {
    store.setView({ selectedSurfaceId: s.id, selectedCorner: i });
  }

  const outline = $derived($store.project.output);
</script>

<svg class="overlay">
  <!-- The output rectangle: everything outside it will never reach the projector. -->
  <rect
    x={toScreen({ x: 0, y: 0 }).x}
    y={toScreen({ x: 0, y: 0 }).y}
    width={outline.width * ui.scale}
    height={outline.height * ui.scale}
    class="canvas-bounds"
  />

  {#each $store.project.surfaces as surface (surface.id)}
    <g class:selected={isSelected(surface)} class:locked={surface.locked}>
      <path
        d={screenPath(surface.frame)}
        class="frame"
        role="button"
        tabindex="-1"
        aria-label={surface.name}
        use:drag={{
          disabled: surface.locked,
          onStart: () => store.setView({ selectedSurfaceId: surface.id, selectedCorner: null }),
          onMove: (_p, d) => store.moveSurface(surface.id, d.x / ui.scale, d.y / ui.scale),
          onEnd: () => store.endGesture(),
        }}
      />
      <text
        x={toScreen(surface.frame[0]).x + 6}
        y={toScreen(surface.frame[0]).y - 6}
        class="label"
      >{surface.name}{surface.locked ? ' 🔒' : ''}</text>

      {#if isSelected(surface) && !surface.locked}
        {#each surface.frame as corner, i (i)}
          <circle
            cx={toScreen(corner).x}
            cy={toScreen(corner).y}
            r={HANDLE}
            class="handle"
            class:active={$store.view.selectedCorner === i}
            role="button"
            tabindex="-1"
            aria-label={`Canto ${i + 1}`}
            use:drag={{
              onStart: () => pickCorner(surface, i),
              onMove: (p) => store.setCorner(surface.id, i, snapPoint(toOutput(p), surface.id)),
              onEnd: () => store.endGesture(),
            }}
          />
        {/each}
      {/if}
    </g>
  {/each}

  {#if ui.pendingPolygon.length > 0}
    <polyline
      points={ui.pendingPolygon.map((p) => fmt(toScreen(p))).join(' ')}
      class="pending"
    />
    {#each ui.pendingPolygon as p, i (i)}
      <circle cx={toScreen(p).x} cy={toScreen(p).y} r="3" class="pending-dot" />
    {/each}
  {/if}
</svg>

<style>
  /* The svg is a see-through layer: only handles and frame interiors take clicks,
     so empty space still reaches the stage below for deselect and tracing. */
  .overlay { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
  .canvas-bounds { fill: none; stroke: #333; stroke-width: 1; stroke-dasharray: 4 4; }
  .frame { fill: transparent; stroke: #6e6e85; stroke-width: 1; cursor: move; pointer-events: fill; }
  .frame:hover { stroke: var(--accent); }
  g.selected .frame { stroke: var(--accent); stroke-width: 1.5; }
  g.locked .frame { stroke: #55556a; stroke-dasharray: 6 3; cursor: not-allowed; }
  .label { fill: var(--muted); font-size: 11px; pointer-events: none; user-select: none; }
  g.selected .label { fill: var(--accent); }
  .handle { fill: #0b0b10; stroke: var(--accent); stroke-width: 2; cursor: grab; pointer-events: auto; }
  .handle.active { fill: var(--accent); }
  .pending { fill: none; stroke: var(--accent); stroke-width: 1.5; stroke-dasharray: 5 3; }
  .pending-dot { fill: var(--accent); }
</style>
