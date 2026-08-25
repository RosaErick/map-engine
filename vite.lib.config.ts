import { resolve } from 'node:path';
import { defineConfig } from 'vite';

/**
 * Builds the engine as a library, separate from the app build.
 *
 * The engine is the half of this project that other people can use: it takes a
 * canvas and a Project and draws, with no framework, no DOM outside its own
 * canvas and no globals. That claim is only real if there is an artifact
 * somebody can import — until this config existed it was a sentence in a README.
 *
 *   npm run build:lib   → dist-lib/projmap.js + .d.ts
 */
export default defineConfig({
  // The PWA assets belong to the app, not to a library someone imports.
  publicDir: false,
  build: {
    outDir: 'dist-lib',
    emptyOutDir: true,
    target: 'es2022',
    // No minification: a consumer's bundler will do it, and readable output is
    // worth more than bytes for a library people are meant to study.
    minify: false,
    lib: {
      entry: resolve(import.meta.dirname, 'packages/engine/index.ts'),
      formats: ['es'],
      // Kept in step with `module`/`exports` in package.json by hand: this is
      // the file those fields name, and a mismatch is an unimportable package.
      fileName: () => 'projmap.js',
    },
    // Zero dependencies means nothing to externalise: the bundle is the engine.
    rollupOptions: { external: [] },
  },
});
