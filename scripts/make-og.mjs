/**
 * Renders the social preview card (1200×630) with the browser already used by
 * the smoke test — same reasoning as make-icons.mjs: no image library for an
 * asset that changes once a year.
 *
 *   node scripts/make-og.mjs
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { markSvg } from './mark.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const html = `<body style="margin:0;width:1200px;height:630px;background:#0f1013;
  font-family:ui-sans-serif,system-ui,sans-serif;color:#f4f4f4;overflow:hidden;position:relative">
  <!-- A marca em grande, sangrando na borda direita. -->
  <svg viewBox="0 0 560 560" width="560" height="560"
       style="position:absolute;right:-20px;top:35px">${markSvg(560)}</svg>

  <div style="position:absolute;left:72px;top:150px;width:640px">
    <div style="font-size:19px;letter-spacing:.18em;text-transform:uppercase;color:#ff3b30;font-weight:600">
      Projection mapping
    </div>
    <div style="font-size:74px;line-height:1.04;font-weight:600;letter-spacing:-.02em;margin-top:20px">
      Map light onto<br/>real objects
    </div>
    <div style="font-size:26px;line-height:1.45;color:#b6b8bb;margin-top:26px">
      In the browser. No install, no account, no cloud.
    </div>
    <div style="font-size:20px;color:#f4f4f4;margin-top:34px">
      <span style="border:1px solid #393939;border-radius:999px;padding:8px 16px">Free forever</span>
      <span style="border:1px solid #393939;border-radius:999px;padding:8px 16px;margin-left:8px">AGPL-3.0</span>
      <span style="border:1px solid #393939;border-radius:999px;padding:8px 16px;margin-left:8px">Works offline</span>
    </div>
  </div>
</body>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.screenshot({ path: resolve(root, 'public/og.png') });
await browser.close();
console.log('ok public/og.png 1200x630');
