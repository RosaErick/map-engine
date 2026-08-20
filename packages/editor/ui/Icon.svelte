<script lang="ts">
  /**
   * Ícones em SVG inline. Nada de fonte de ícone nem CDN: o build tem que abrir
   * de um pendrive sem rede, e um ícone que não carrega vira botão sem rótulo.
   *
   * Só entram aqui os ícones que valem mais que uma palavra. Botão de ação
   * continua com texto — é mais explicativo, que é o ponto.
   */
  type Name = 'github' | 'sun' | 'moon' | 'laptop' | 'eye' | 'eye-off' | 'lock' | 'lock-open' | 'close' | 'trash' | 'globe' | 'back' | 'plus' | 'polygon' | 'undo' | 'redo' | 'magnet' | 'frame' | 'grid' | 'mark' | 'link';
  let { name, class: klass = 'size-4' }: { name: Name; class?: string } = $props();
</script>

{#if name === 'github'}
  <svg viewBox="0 0 24 24" fill="currentColor" class={klass} aria-hidden="true">
    <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.21.09 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.34-5.47-5.96 0-1.32.47-2.39 1.24-3.23-.12-.3-.54-1.52.12-3.17 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.87.12 3.17.77.84 1.24 1.91 1.24 3.23 0 4.63-2.8 5.65-5.48 5.95.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12.01 12.01 0 0 0 24 12.5C24 5.87 18.63.5 12 .5z"/>
  </svg>
{:else if name === 'mark'}
  <!--
    A marca: um grid de pixels deformado pela mesma homografia que a ferramenta
    aplica. Um quadrado girado seria um grid girado; um que converge é um grid
    *jogado em cima de alguma coisa* — e essa diferença é a marca inteira.
    A célula acesa usa currentColor para contrastar no tema claro e no escuro;
    as outras são vermelhas em qualquer um.
  -->
  <svg viewBox="0 0 24 24" fill="#ff3b30" class={klass} aria-hidden="true">
      <polygon points="7.39,3.57 10.12,3.57 9.77,6.25 6.54,6.25"/>
      <polygon points="10.64,3.57 13.36,3.57 13.61,6.25 10.39,6.25"/>
      <polygon points="13.88,3.57 16.61,3.57 17.46,6.25 14.23,6.25"/>
      <polygon points="6.35,6.88 9.69,6.88 9.15,11.08 5.02,11.08"/>
      <polygon points="10.33,6.88 13.67,6.88 14.06,11.08 9.94,11.08" fill="currentColor"/>
      <polygon points="14.31,6.88 17.65,6.88 18.98,11.08 14.85,11.08"/>
      <polygon points="4.69,12.12 9.02,12.12 8.04,19.66 2.31,19.66"/>
      <polygon points="9.84,12.12 14.16,12.12 14.87,19.66 9.13,19.66"/>
      <polygon points="14.98,12.12 19.31,12.12 21.69,19.66 15.96,19.66"/>
  </svg>
{:else}
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
       stroke-linecap="round" stroke-linejoin="round" class={klass} aria-hidden="true">
    {#if name === 'sun'}
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>
    {:else if name === 'moon'}
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>
    {:else if name === 'laptop'}
      <rect x="3" y="4" width="18" height="12" rx="2"/>
      <path d="M2 20h20"/>
    {:else if name === 'eye'}
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/>
      <circle cx="12" cy="12" r="3"/>
    {:else if name === 'eye-off'}
      <path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c6.4 0 10 7 10 7a18 18 0 0 1-3.1 4M6.6 6.6A18 18 0 0 0 2 12s3.6 7 10 7a10.7 10.7 0 0 0 4.5-.95"/>
      <path d="M3 3l18 18"/>
    {:else if name === 'lock'}
      <rect x="4" y="11" width="16" height="10" rx="2"/>
      <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
    {:else if name === 'lock-open'}
      <rect x="4" y="11" width="16" height="10" rx="2"/>
      <path d="M8 11V7a4 4 0 0 1 7.5-2"/>
    {:else if name === 'plus'}
      <path d="M12 5v14M5 12h14"/>
    {:else if name === 'polygon'}
      <path d="M12 3.5 20.5 9.6 17.3 19.8H6.7L3.5 9.6Z"/>
    {:else if name === 'undo'}
      <path d="M3 8v6h6"/>
      <path d="M3.5 14a8.5 8.5 0 1 1 2.2 5.6"/>
    {:else if name === 'redo'}
      <path d="M21 8v6h-6"/>
      <path d="M20.5 14a8.5 8.5 0 1 0-2.2 5.6"/>
    {:else if name === 'magnet'}
      <path d="M6 4v8a6 6 0 0 0 12 0V4"/>
      <path d="M6 9h4M14 9h4"/>
    {:else if name === 'frame'}
      <path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4"/>
    {:else if name === 'grid'}
      <rect x="3.5" y="3.5" width="17" height="17" rx="1.5"/>
      <path d="M9.3 3.5v17M14.7 3.5v17M3.5 9.3h17M3.5 14.7h17"/>
    {:else if name === 'back'}
      <path d="M19 12H5"/>
      <path d="m11 18-6-6 6-6"/>
    {:else if name === 'globe'}
      <circle cx="12" cy="12" r="9"/>
      <path d="M3 12h18"/>
      <path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18"/>
    {:else if name === 'link'}
      <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/>
      <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>
    {:else if name === 'trash'}
      <path d="M4 7h16"/>
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
      <path d="M18.5 7 17.7 19a2 2 0 0 1-2 1.9H8.3a2 2 0 0 1-2-1.9L5.5 7"/>
      <path d="M10 11v5M14 11v5"/>
    {:else if name === 'close'}
      <path d="M18 6 6 18M6 6l12 12"/>
    {/if}
  </svg>
{/if}
