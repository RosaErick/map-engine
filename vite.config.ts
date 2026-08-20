import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * Writes the service worker after the bundle exists, stamped with a hash of the
 * built HTML.
 *
 * A service worker only updates when its own bytes change. A hand-written one
 * with a constant version is the classic way to ship a PWA that serves last
 * month's app forever — so the version is derived from what it caches.
 */
function serviceWorker(): Plugin {
  return {
    name: 'map-engine:sw',
    apply: 'build',
    closeBundle() {
      const outDir = resolve(process.cwd(), 'dist');
      const html = readFileSync(resolve(outDir, 'index.html'));
      const version = createHash('sha256').update(html).digest('hex').slice(0, 12);
      const assets = [
        './',
        './index.html',
        './manifest.webmanifest',
        './icon-192.png',
        './icon-512.png',
        './icon-maskable-512.png',
      ];
      writeFileSync(resolve(outDir, 'sw.js'), swSource(version, assets));
    },
  };
}

function swSource(version: string, assets: string[]): string {
  return `// Gerado no build. Não edite: veja serviceWorker() em vite.config.ts.
const CACHE = 'map-engine-${version}';
const ASSETS = ${JSON.stringify(assets)};

self.addEventListener('install', (event) => {
  // Um app de montagem não pode ficar meio instalado: ou cacheia tudo, ou falha.
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  // Cache primeiro: no local da montagem não existe rede, e esperar por um
  // timeout de rede antes de abrir a ferramenta é inaceitável.
  event.respondWith(
    caches.match(req).then((hit) => {
      const network = fetch(req)
        .then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(() => hit);
      return hit || network;
    }),
  );
});
`;
}

// One self-contained .html that opens from a USB stick with no server and no
// network: on site there is no wifi and no time to debug why there isn't.
export default defineConfig({
  base: './',
  plugins: [tailwindcss(), svelte(), viteSingleFile(), serviceWorker()],
  build: { target: 'es2022', assetsInlineLimit: 100_000_000, cssCodeSplit: false },
});
