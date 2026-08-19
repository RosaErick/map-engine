import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { viteSingleFile } from 'vite-plugin-singlefile';

// One self-contained .html that opens from a USB stick with no server and no
// network: on site there is no wifi and no time to debug why there isn't.
export default defineConfig({
  base: './',
  plugins: [svelte(), viteSingleFile()],
  build: { target: 'es2022', assetsInlineLimit: 100_000_000, cssCodeSplit: false },
});
