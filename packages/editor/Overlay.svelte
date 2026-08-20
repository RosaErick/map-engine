<script lang="ts">
  import { drag } from './actions.ts';
  import { t } from './i18n/index.svelte.ts';
  import {
    store, viewport, tools, frameToOutput, outputToFrame, snapPoint, toOutput, toScreen,
    warpGridPath, warpPointToScreen, screenToFramePoint,
  } from './state.svelte.ts';
  import type { Surface, Vec2 } from '../engine/index.ts';

  const HANDLE = 7;
  // A mesh can carry up to 289 control points at once, so its handles are the
  // smallest of the three: they have to sit on top of the content without
  // burying it.
  const MESH_HANDLE = 3.5;

  function screenPath(frame: readonly Vec2[]): string {
    return frame.map((c, i) => `${i === 0 ? 'M' : 'L'}${fmt(toScreen(c))}`).join(' ') + ' Z';
  }
  function fmt(p: Vec2): string { return `${p.x.toFixed(1)},${p.y.toFixed(1)}`; }

  function isSelected(s: Surface): boolean { return $store.view.selectedSurfaceId === s.id; }

  function pickCorner(s: Surface, i: number): void {
    store.setView({ selectedSurfaceId: s.id, selectedCorner: i });
  }

  // Selecting the surface without a corner: the arrow keys then move the whole
  // surface. Shared by the pointer gestures and by keyboard focus, so reaching a
  // handle with Tab selects exactly what grabbing it with the mouse selects.
  function pickSurface(s: Surface): void {
    store.setView({ selectedSurfaceId: s.id, selectedCorner: null });
  }

  // Same deal for a mesh point: the arrow keys nudge whatever is selected, so
  // pointer and keyboard have to agree on what grabbing a handle means.
  function pickWarpPoint(s: Surface, i: number): void {
    store.setView({ selectedSurfaceId: s.id, selectedCorner: null, selectedWarpPoint: i });
  }

  const outline = $derived($store.project.output);
</script>

<svg class="overlay">
  <!-- The output rectangle: everything outside it will never reach the projector. -->
  <rect
    x={toScreen({ x: 0, y: 0 }).x}
    y={toScreen({ x: 0, y: 0 }).y}
    width={outline.width * viewport.scale}
    height={outline.height * viewport.scale}
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
          onStart: () => pickSurface(surface),
          onMove: (_p, d) => store.moveSurface(surface.id, d.x / viewport.scale, d.y / viewport.scale),
          onEnd: () => store.endGesture(),
        }}
      />
      <text
        x={toScreen(surface.frame[0]).x + 6}
        y={toScreen(surface.frame[0]).y - 6}
        class="label"
      >{surface.name}{surface.locked ? ' 🔒' : ''}</text>

      <!-- The mesh, drawn before the polygon vertices and the frame corners on
           purpose: SVG hit-testing takes the topmost shape, so a control point
           landing under a corner never steals the pointer from that corner. The
           grid lines come first inside the block, under every handle. -->
      {#if isSelected(surface) && !surface.locked && surface.warp}
        {@const warp = surface.warp}
        {#if tools.showWarpGrid}
          {#each warpGridPath(surface) as line, i (i)}
            <path d={line} class="warp-line" />
          {/each}
        {/if}
        {#each warp.points as _point, i (i)}
          {@const screen = warpPointToScreen(surface, i)}
          {#if screen}
            <circle
              cx={screen.x}
              cy={screen.y}
              r={MESH_HANDLE}
              class="warp-point"
              class:active={$store.view.selectedWarpPoint === i}
              role="button"
              tabindex="0"
              aria-label={t('warp.point', { number: i + 1 })}
              onfocus={() => pickWarpPoint(surface, i)}
              use:drag={{
                onStart: () => pickWarpPoint(surface, i),
                onMove: (p) => {
                  const local = screenToFramePoint(surface, p);
                  if (local) store.setWarpPoint(surface.id, i, local, tools.warpFalloff);
                },
                onEnd: () => store.endGesture(),
              }}
            />
          {/if}
        {/each}
      {/if}

      <!-- Vértices do polígono: vivem no espaço do frame, então passam pela
           homografia para virar pixels de saída e só então para a tela. Sem
           alças aqui, um traçado errado obriga a refazer o polígono inteiro. -->
      {#if isSelected(surface) && !surface.locked && surface.shape.kind === 'polygon'}
        {#each surface.shape.points as point, i (i)}
          {@const output = frameToOutput(surface, point.x, point.y)}
          {#if output}
            {@const screen = toScreen(output)}
            <circle
              cx={screen.x}
              cy={screen.y}
              r={HANDLE - 2}
              class="vertex"
              role="button"
              tabindex="0"
              aria-label={t('overlay.vertex', { name: surface.name, number: i + 1 })}
              onfocus={() => pickSurface(surface)}
              use:drag={{
                onStart: () => pickSurface(surface),
                onMove: (p) => {
                  const local = outputToFrame(surface, toOutput(p));
                  if (local) store.setPolygonPoint(surface.id, i, local);
                },
                onEnd: () => store.endGesture(),
              }}
            />
          {/if}
        {/each}
      {/if}

      {#if isSelected(surface) && !surface.locked}
        {#each surface.frame as corner, i (i)}
          <circle
            cx={toScreen(corner).x}
            cy={toScreen(corner).y}
            r={HANDLE}
            class="handle"
            class:active={$store.view.selectedCorner === i}
            role="button"
            tabindex="0"
            aria-label={t('overlay.corner', { number: i + 1 })}
            onfocus={() => pickCorner(surface, i)}
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

  {#if tools.pendingPolygon.length > 0}
    <polyline
      points={tools.pendingPolygon.map((p) => fmt(toScreen(p))).join(' ')}
      class="pending"
    />
    {#each tools.pendingPolygon as p, i (i)}
      <circle cx={toScreen(p).x} cy={toScreen(p).y} r="3" class="pending-dot" />
    {/each}
  {/if}
</svg>

<style>
  /*
   * Paleta fixa, de propósito: estas alças vivem por cima do canvas preto, que é
   * a pré-visualização do projetor e não muda com o tema. Seguir o tema claro
   * aqui deixaria as alças invisíveis contra o preto.
   */
  .overlay { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
  .canvas-bounds { fill: none; stroke: #333; stroke-width: 1; stroke-dasharray: 4 4; }
  .frame {
    fill: transparent; stroke: #6e6e85; stroke-width: 1;
    cursor: move; pointer-events: fill;
    transition: stroke 120ms ease;
  }
  .frame:hover { stroke: #52bdff; }
  g.selected .frame { stroke: #52bdff; stroke-width: 1.5; }
  g.locked .frame { stroke: #55556a; stroke-dasharray: 6 3; cursor: not-allowed; }
  .label {
    fill: #8b8b9c; font-size: 11px; pointer-events: none; user-select: none;
    font-family: ui-sans-serif, system-ui, sans-serif;
  }
  g.selected .label { fill: #52bdff; }
  .handle {
    fill: #0b0b10; stroke: #52bdff; stroke-width: 2;
    cursor: grab; pointer-events: auto;
    transition: r 100ms ease, fill 100ms ease;
  }
  .handle:hover { fill: #10222e; }
  .handle.active { fill: #52bdff; }
  /* O vértice é menor e vazado, para não competir com o canto do frame: são
     duas coisas diferentes e mexer no errado custa caro. */
  .vertex {
    fill: #10222e; stroke: #ffb86c; stroke-width: 2;
    cursor: grab; pointer-events: auto;
    transition: fill 100ms ease;
  }
  .vertex:hover { fill: #ffb86c; }
  /* A malha tem cor própria — violeta, nem o ciano do canto do frame nem o
     laranja do vértice — porque as três alças podem estar na tela ao mesmo
     tempo e mexer na errada custa caro. */
  .warp-line {
    fill: none; stroke: #be95ff; stroke-width: 0.75; opacity: 0.4;
    pointer-events: none;
  }
  .warp-point {
    fill: #1a1230; stroke: #be95ff; stroke-width: 1.5;
    cursor: grab; pointer-events: auto;
    transition: fill 100ms ease;
  }
  .warp-point:hover { fill: #be95ff; }
  .warp-point.active { fill: #be95ff; }
  /* Keyboard focus ring. It has to read against the black work area and against
     every handle colour, so it is white and sits outside the handle instead of
     recolouring it: the accent still says "frame corner", the orange still says
     "polygon vertex" and the violet still says "mesh point" while focused. The
     wider stroke is a second cue for engines that do not paint an outline on
     SVG shapes. */
  .handle:focus-visible,
  .vertex:focus-visible,
  .warp-point:focus-visible {
    outline: 2px solid #ffffff;
    outline-offset: 3px;
    stroke-width: 3;
  }
  .pending { fill: none; stroke: #52bdff; stroke-width: 1.5; stroke-dasharray: 5 3; }
  .pending-dot { fill: #52bdff; }
</style>
