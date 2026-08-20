import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
// @ts-expect-error — módulo .mjs sem tipos, usado só para gerar a marca
import { markSvg } from './scripts/mark.mjs';

/**
 * Injeta o favicon como SVG embutido no próprio HTML.
 *
 * Um PNG de 192 reduzido para 16 fica borrado, e arquivo externo não carrega
 * quando alguém abre o build direto do disco — que é justamente o caminho que
 * este projeto vende. Como data URI ele é nítido em qualquer tamanho, não custa
 * requisição, e sai da mesma função que desenha o ícone do app, então nunca
 * dessincroniza.
 */
function favicon(): Plugin {
  return {
    name: 'map-engine:favicon',
    transformIndexHtml: {
      order: 'pre',
      handler(html: string) {
        const svg =
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
          '<rect width="64" height="64" fill="#000"/>' +
          markSvg(64) +
          '</svg>';
        return html.replace('%FAVICON%', `data:image/svg+xml,${encodeURIComponent(svg)}`);
      },
    },
  };
}

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
  plugins: [favicon(), tailwindcss(), svelte(), viteSingleFile(), serviceWorker()],
  build: { target: 'es2022', assetsInlineLimit: 100_000_000, cssCodeSplit: false },
});
