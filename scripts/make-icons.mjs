/**
 * Renders the app icons with the browser that is already a dev dependency.
 *
 * ponytail: no image library. Playwright is here for the smoke test anyway, and
 * screenshotting an SVG at a fixed size is exactly what it does. Run it only
 * when the mark changes: `node scripts/make-icons.mjs`.
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { markSvg } from './mark.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** `pad` is the maskable safe zone: the OS crops the icon to a circle. */
function icon(size, pad = 0) {
  const inner = size - pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="#000"/>
    <g transform="translate(${pad} ${pad})">${markSvg(inner)}</g>
  </svg>`;
}

const browser = await chromium.launch();
const targets = [
  { file: 'public/icon-192.png', size: 192, pad: 0 },
  { file: 'public/icon-512.png', size: 512, pad: 0 },
  { file: 'public/icon-maskable-512.png', size: 512, pad: 56 },
];

for (const { file, size, pad } of targets) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<body style="margin:0;background:#000">${icon(size, pad)}</body>`);
  await page.screenshot({ path: resolve(root, file) });
  await page.close();
  console.log(`ok ${file} ${size}x${size}`);
}
await browser.close();
