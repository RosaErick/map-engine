<script lang="ts">
  import { store, tools } from './state.svelte.ts';
  import { PATTERNS } from './patterns.ts';
  import { t, type MessageKey } from './i18n/index.svelte.ts';
  import { anchorId, type Blend, type Fit, type TestPattern } from '../engine/index.ts';

  /**
   * The fit and blend options, in the order the selects show them.
   *
   * Same idea as `PATTERNS`, one step stronger: the list is keyed by the
   * engine's union type, so completeness is checked by the compiler. Add a
   * member to `Fit` or `Blend` and this object literal is missing a property,
   * which `Record<Fit, MessageKey>` rejects — the option cannot be forgotten.
   * The label still lives in the catalogue, and typing the values as
   * `MessageKey` means a key that is not in the catalogue fails too.
   *
   * The keys are camelCase (`inspector.fitStretch`) while the union members are
   * lowercase, so a `` t(`inspector.fit${id}`) `` template would build a key
   * that does not exist. Hence the explicit mapping instead of a cast.
   *
   * `Object.entries` keeps the order the members are written in, which is the
   * order the options had before.
   */
  const FIT_OPTIONS: Record<Fit, MessageKey> = {
    stretch: 'inspector.fitStretch',
    contain: 'inspector.fitContain',
    cover: 'inspector.fitCover',
  };
  const BLEND_OPTIONS: Record<Blend, MessageKey> = {
    normal: 'inspector.blendNormal',
    add: 'inspector.blendAdd',
    screen: 'inspector.blendScreen',
    multiply: 'inspector.blendMultiply',
  };
  const FITS = Object.entries(FIT_OPTIONS);
  const BLENDS = Object.entries(BLEND_OPTIONS);

  const s = $derived(
    $store.project.surfaces.find((x) => x.id === anchorId($store.view)) ?? null,
  );

  /** The keyboard hint carries its keys as markup, so it goes through `{@html}`
   *  with these two as parameters. */
  const kbd = (label: string): string => `<kbd class="kbd kbd-xs">${label}</kbd>`;
  const ARROWS = ['←', '→', '↑', '↓'].map(kbd).join(' ');
  const SHIFT = kbd('Shift');

  /** A crop tighter than the whole source — worth flagging on the folded
   *  header, since the values themselves are out of sight there. */
  const cropped = $derived(
    !!s && (s.crop.x !== 0 || s.crop.y !== 0 || s.crop.w !== 1 || s.crop.h !== 1),
  );

  /** Opacity below full, shown on the folded header so a dimmed surface never
   *  becomes a mystery once the section is closed. */
  const faded = $derived(!!s && s.opacity < 1);

  /** The mesh of the selected surface, or null when it has none. Its own flag
   *  rather than `cropped`: the two sections warn about different things, and a
   *  surface can carry either without the other. */
  const warp = $derived(s?.warp ?? null);

  function setShape(kind: 'quad' | 'ellipse'): void {
    if (!s) return;
    store.setSurfaceShape(s.id, kind === 'ellipse' ? { kind: 'ellipse', feather: 0.06 } : { kind: 'quad' });
  }
</script>

<!-- The header every folded section shares: chevron, label, and an optional
     badge that says the section is doing something while it is closed. -->
{#snippet fold(label: string, badge: string | null)}
  <summary class="flex cursor-pointer list-none items-center gap-1 text-[11px] text-base-content/55 hover:text-base-content">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
         class="size-3 transition-transform group-open:rotate-90" aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
    {label}
    {#if badge}<span class="ml-auto text-[10px] text-primary">{badge}</span>{/if}
  </summary>
{/snippet}

<section class="border-b border-base-300 px-4 py-3">
  <h2 class="text-[10px] font-semibold uppercase tracking-[0.14em] text-base-content/45">
    {s ? s.name : t('inspector.title')}
  </h2>

  {#if !s}
    <p class="mt-2 text-[11px] leading-relaxed text-base-content/55">
      {t('inspector.empty')}
    </p>
  {:else}
    <div class="mt-2.5 space-y-3">
      <div>
        <span class="mb-1 block text-[11px] text-base-content/55">{t('inspector.shape')}</span>
        <div class="join w-full">
          <button
            class="btn btn-xs join-item flex-1"
            class:btn-active={s.shape.kind === 'quad'}
            onclick={() => setShape('quad')}
          >{t('inspector.rectangle')}</button>
          <button
            class="btn btn-xs join-item flex-1"
            class:btn-active={s.shape.kind === 'ellipse'}
            onclick={() => setShape('ellipse')}
          >{t('inspector.ellipse')}</button>
          <button
            class="btn btn-xs join-item flex-1"
            class:btn-active={s.shape.kind === 'polygon'}
            disabled
            title={t('inspector.polygonHint')}
          >{t('inspector.polygon')}</button>
        </div>
      </div>

      {#if s.shape.kind === 'ellipse'}
        <label class="block" for="feather">
          <span class="mb-1 flex justify-between text-[11px] text-base-content/55">
            <span>{t('inspector.feather')}</span><span>{(s.shape.feather * 100).toFixed(0)}%</span>
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
          <span>{t('inspector.rotation')}</span><span>{s.rotation.toFixed(0)}°</span>
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

      <details class="group">
        {@render fold(t('inspector.look'), faded ? `${(s.opacity * 100).toFixed(0)}%` : null)}

        <div class="mt-2 space-y-3">
          <label class="block" for="opacity">
            <span class="mb-1 flex justify-between text-[11px] text-base-content/55">
              <span>{t('inspector.opacity')}</span><span>{(s.opacity * 100).toFixed(0)}%</span>
            </span>
            <input
              id="opacity" type="range" min="0" max="1" step="0.01" class="range range-xs range-primary"
              value={s.opacity}
              oninput={(e) => store.setOpacity(s.id, +e.currentTarget.value)}
              onchange={() => store.endGesture()}
            />
          </label>
          <label class="block" for="z">
            <span class="mb-1 block text-[11px] text-base-content/55">{t('inspector.z')}</span>
            <input
              id="z" type="number" class="input input-xs w-full" value={s.z}
              onchange={(e) => store.reorder(s.id, +e.currentTarget.value)}
            />
          </label>
        </div>
      </details>

      <!-- Crop folds away: four fields open at all times pushed fit, blend and
           pattern off screen, and cropping is the exception — most projects use
           the whole source. -->
      <details class="group">
        {@render fold(t('inspector.crop'), cropped ? t('inspector.cropActive') : null)}

        <div class="mt-2 grid grid-cols-2 gap-2">
          {#each [
            { key: 'x', label: 'X', value: s.crop.x },
            { key: 'y', label: 'Y', value: s.crop.y },
            { key: 'w', label: t('inspector.cropWidth'), value: s.crop.w },
            { key: 'h', label: t('inspector.cropHeight'), value: s.crop.h },
          ] as field (field.key)}
            <label class="flex items-center gap-1.5 text-[11px] text-base-content/55">
              <span class="w-10 shrink-0 truncate">{field.label}</span>
              <input
                type="number" min="0" max="100" step="1"
                class="input input-xs w-full"
                value={Math.round(field.value * 100)}
                onchange={(e) => {
                  store.setCrop(s.id, { [field.key]: +e.currentTarget.value / 100 });
                  store.endGesture();
                }}
              />
            </label>
          {/each}
        </div>

        {#if cropped}
          <button
            class="btn btn-ghost btn-xs btn-block mt-1 font-normal"
            onclick={() => { store.setCrop(s.id, { x: 0, y: 0, w: 1, h: 1 }); store.endGesture(); }}
          >{t('inspector.cropReset')}</button>
        {/if}
      </details>

      <!-- Free mesh: folded away like the crop for the same reason — most
           surfaces are flat, and the whole panel below would be pushed off
           screen by controls that only a curved wall ever needs. -->
      <details class="group">
        {@render fold(t('warp.title'), warp ? t('warp.active') : null)}

        {#if !warp}
          <p class="mt-2 text-[11px] leading-relaxed text-base-content/55">{t('warp.blurb')}</p>
          <button
            class="btn btn-xs btn-block mt-2 font-normal"
            onclick={() => store.enableWarp(s.id)}
          >{t('warp.enable')}</button>
        {:else}
          <div class="mt-2 space-y-3">
            <div>
              <span id="warp-grid-label" class="mb-1 flex justify-between text-[11px] text-base-content/55">
                <span>{t('warp.grid')}</span>
                <span>{warp.cols + 1} × {warp.rows + 1}</span>
              </span>
              <div class="flex items-center gap-1.5" role="group" aria-labelledby="warp-grid-label">
                <input
                  id="warp-cols" type="number" min="1" max="16" step="1"
                  class="input input-xs w-full"
                  aria-label={t('warp.columns')}
                  value={warp.cols}
                  onchange={(e) => store.setWarpGrid(s.id, +e.currentTarget.value, warp.rows)}
                />
                <span class="text-[11px] text-base-content/45" aria-hidden="true">×</span>
                <input
                  id="warp-rows" type="number" min="1" max="16" step="1"
                  class="input input-xs w-full"
                  aria-label={t('warp.rows')}
                  value={warp.rows}
                  onchange={(e) => store.setWarpGrid(s.id, warp.cols, +e.currentTarget.value)}
                />
              </div>
            </div>

            <div>
              <span class="mb-1 block text-[11px] text-base-content/55">{t('warp.interpolation')}</span>
              <div class="join w-full">
                <button
                  class="btn btn-xs join-item flex-1"
                  class:btn-active={warp.interpolation === 'smooth'}
                  title={t('warp.smoothHint')}
                  onclick={() => store.setWarpInterpolation(s.id, 'smooth')}
                >{t('warp.smooth')}</button>
                <button
                  class="btn btn-xs join-item flex-1"
                  class:btn-active={warp.interpolation === 'linear'}
                  title={t('warp.linearHint')}
                  onclick={() => store.setWarpInterpolation(s.id, 'linear')}
                >{t('warp.linear')}</button>
              </div>
            </div>

            <label class="block" for="warp-falloff">
              <span class="mb-1 flex justify-between text-[11px] text-base-content/55">
                <span>{t('warp.falloff')}</span><span>{tools.warpFalloff.toFixed(1)}</span>
              </span>
              <input
                id="warp-falloff" type="range" min="0" max="4" step="0.5"
                class="range range-xs range-primary"
                title={t('warp.falloffHint')}
                bind:value={tools.warpFalloff}
              />
            </label>

            <label class="flex cursor-pointer items-center gap-2 text-[11px] text-base-content/55" for="warp-show-grid">
              <input
                id="warp-show-grid" type="checkbox" class="checkbox checkbox-xs"
                bind:checked={tools.showWarpGrid}
              />
              <span>{t('warp.showGrid')}</span>
            </label>

            <div class="grid grid-cols-2 gap-2">
              <button
                class="btn btn-ghost btn-xs font-normal"
                onclick={() => store.resetWarp(s.id)}
              >{t('warp.reset')}</button>
              <button
                class="btn btn-ghost btn-xs font-normal"
                onclick={() => store.disableWarp(s.id)}
              >{t('warp.disable')}</button>
            </div>

            <p class="rounded-md bg-base-200 px-3 py-2 text-[11px] leading-relaxed text-base-content/60">
              {t('warp.hint')}
            </p>
          </div>
        {/if}
      </details>

      <div class="grid grid-cols-2 gap-2">
        <label class="block" for="fit">
          <span class="mb-1 block text-[11px] text-base-content/55">{t('inspector.fit')}</span>
          <select
            id="fit" class="select select-xs w-full" value={s.fit}
            onchange={(e) => store.patchSurface(s.id, { fit: e.currentTarget.value as Fit })}
          >
            {#each FITS as [id, key] (id)}<option value={id}>{t(key)}</option>{/each}
          </select>
        </label>

        <label class="block" for="blend">
          <span class="mb-1 block text-[11px] text-base-content/55">{t('inspector.blend')}</span>
          <select
            id="blend" class="select select-xs w-full" value={s.blend}
            onchange={(e) => store.patchSurface(s.id, { blend: e.currentTarget.value as Blend })}
          >
            {#each BLENDS as [id, key] (id)}<option value={id}>{t(key)}</option>{/each}
          </select>
        </label>
      </div>


      <label class="block" for="surface-pattern">
        <span class="mb-1 block text-[11px] text-base-content/55">{t('inspector.surfacePattern')}</span>
        <select
          id="surface-pattern"
          class="select select-xs w-full"
          value={$store.view.surfacePatterns[s.id] ?? ''}
          onchange={(e) => store.setSurfacePattern(s.id, e.currentTarget.value === '' ? null : e.currentTarget.value as TestPattern)}
        >
          <option value="">{t('inspector.followAll', { name: t(`pattern.${$store.view.testPattern}`) })}</option>
          {#each PATTERNS as id (id)}<option value={id}>{t(`pattern.${id}`)}</option>{/each}
        </select>
      </label>

      <p class="rounded-md bg-base-200 px-3 py-2 text-[11px] leading-relaxed text-base-content/60">
        {@html t('inspector.keyboardHint', { keys: ARROWS, shift: SHIFT })}
      </p>
    </div>
  {/if}
</section>
