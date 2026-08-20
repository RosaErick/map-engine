<script lang="ts">
  import { store } from './state.svelte.ts';
  import { PATTERNS } from './patterns.ts';
  import { t } from './i18n/index.svelte.ts';
  import type { Blend, Fit, TestPattern } from '../engine/index.ts';

  const s = $derived(
    $store.project.surfaces.find((x) => x.id === $store.view.selectedSurfaceId) ?? null,
  );

  /** The keyboard hint carries its keys as markup, so it goes through `{@html}`
   *  with these two as parameters. */
  const kbd = (label: string): string => `<kbd class="kbd kbd-xs">${label}</kbd>`;
  const ARROWS = ['←', '→', '↑', '↓'].map(kbd).join(' ');
  const SHIFT = kbd('Shift');

  function setShape(kind: 'quad' | 'ellipse'): void {
    if (!s) return;
    store.setSurfaceShape(s.id, kind === 'ellipse' ? { kind: 'ellipse', feather: 0.06 } : { kind: 'quad' });
  }
</script>

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

      <div class="grid grid-cols-2 gap-2">
        <label class="block" for="fit">
          <span class="mb-1 block text-[11px] text-base-content/55">{t('inspector.fit')}</span>
          <select
            id="fit" class="select select-xs w-full" value={s.fit}
            onchange={(e) => store.patchSurface(s.id, { fit: e.currentTarget.value as Fit })}
          >
            <option value="stretch">{t('inspector.fitStretch')}</option>
            <option value="contain">{t('inspector.fitContain')}</option>
            <option value="cover">{t('inspector.fitCover')}</option>
          </select>
        </label>

        <label class="block" for="blend">
          <span class="mb-1 block text-[11px] text-base-content/55">{t('inspector.blend')}</span>
          <select
            id="blend" class="select select-xs w-full" value={s.blend}
            onchange={(e) => store.patchSurface(s.id, { blend: e.currentTarget.value as Blend })}
          >
            <option value="normal">{t('inspector.blendNormal')}</option>
            <option value="add">{t('inspector.blendAdd')}</option>
            <option value="screen">{t('inspector.blendScreen')}</option>
            <option value="multiply">{t('inspector.blendMultiply')}</option>
          </select>
        </label>
      </div>

      <label class="block" for="z">
        <span class="mb-1 block text-[11px] text-base-content/55">{t('inspector.z')}</span>
        <input
          id="z" type="number" class="input input-xs w-full" value={s.z}
          onchange={(e) => store.reorder(s.id, +e.currentTarget.value)}
        />
      </label>

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
