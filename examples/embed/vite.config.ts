import { defineConfig } from 'vite';

// The example imports the built library from outside its own root on purpose:
// it consumes exactly the artifact a third party would, not the source.
export default defineConfig({
  server: { fs: { allow: ['../..'] } },
});
