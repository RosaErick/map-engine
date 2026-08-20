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

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const html = `<body style="margin:0;width:1200px;height:630px;background:#0f1013;
  font-family:ui-sans-serif,system-ui,sans-serif;color:#f4f4f4;overflow:hidden;position:relative">
  <!-- O mesmo quad em perspectiva da marca, grande e sangrando na borda -->
  <svg viewBox="0 0 24 24" width="560" height="560" fill="none"
       style="position:absolute;right:-40px;top:35px;opacity:.9">
    <path d="M5.5 4.5 19 6.8 17.6 19 3.6 17.3Z" fill="#52bdff" fill-opacity="0.10"
          stroke="#52bdff" stroke-width="0.5" stroke-linejoin="round"/>
    <circle cx="5.5" cy="4.5" r="0.75" fill="#0f1013" stroke="#52bdff" stroke-width="0.42"/>
    <circle cx="19" cy="6.8" r="0.75" fill="#0f1013" stroke="#52bdff" stroke-width="0.42"/>
    <circle cx="17.6" cy="19" r="0.75" fill="#0f1013" stroke="#52bdff" stroke-width="0.42"/>
    <circle cx="3.6" cy="17.3" r="0.75" fill="#0f1013" stroke="#52bdff" stroke-width="0.42"/>
  </svg>

  <div style="position:absolute;left:72px;top:150px;width:640px">
    <div style="font-size:19px;letter-spacing:.18em;text-transform:uppercase;color:#52bdff;font-weight:600">
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
