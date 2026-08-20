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

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** A perspective quad with its four corner handles — the whole tool in one mark. */
function svg(pad) {
  const s = 512;
  const k = pad; // inset for the maskable safe zone
  const p = (x, y) => `${k + x * (s - 2 * k) / 512},${k + y * (s - 2 * k) / 512}`;
  const corners = [[112, 96], [420, 150], [386, 430], [78, 372]];
  const path = corners.map(([x, y], i) => `${i ? 'L' : 'M'}${p(x, y)}`).join(' ') + ' Z';
  const handles = corners.map(([x, y]) => `<circle cx="${p(x, y).split(',')[0]}" cy="${p(x, y).split(',')[1]}" r="${26 * (s - 2 * k) / 512}" fill="#0b0b10" stroke="#5ac8fa" stroke-width="${14 * (s - 2 * k) / 512}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <rect width="512" height="512" fill="#000"/>
    <path d="${path}" fill="#5ac8fa" fill-opacity="0.16" stroke="#5ac8fa" stroke-width="${12 * (s - 2 * k) / 512}"/>
    ${handles}
  </svg>`;
}

const browser = await chromium.launch();
const targets = [
  { file: 'public/icon-192.png', size: 192, pad: 0 },
  { file: 'public/icon-512.png', size: 512, pad: 0 },
  // Maskable icons get cropped to a circle by the OS: keep the mark inside 80%.
  { file: 'public/icon-maskable-512.png', size: 512, pad: 64 },
];

for (const { file, size, pad } of targets) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<body style="margin:0;background:#000">${svg(pad).replace('width="512" height="512"', `width="${size}" height="${size}"`)}</body>`,
  );
  await page.screenshot({ path: resolve(root, file) });
  await page.close();
  console.log(`ok ${file} ${size}x${size}`);
}
await browser.close();
