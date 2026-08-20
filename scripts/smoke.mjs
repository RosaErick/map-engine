/**
 * Smoke test against the real build, in a real browser, over file://.
 *
 * This is the check that acceptance criterion 1 and 11 actually hold: the
 * single-file build opens with no server, the console stays clean, and every
 * pixel outside a mapped surface is absolute black.
 *
 *   node scripts/smoke.mjs [--headed]
 */
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const build = resolve(root, 'dist/index.html');
if (!existsSync(build)) {
  console.error('dist/index.html não existe — rode `npm run build` antes.');
  process.exit(1);
}

const failures = [];
function check(name, ok, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(name);
}

// --- checks that need no browser ------------------------------------------

const html = readFileSync(build, 'utf8');
// Everything the app needs to run must be inside the file. The PWA assets are
// the only allowed exceptions, and they are optional by design.
// './index.html' is the app offering itself for download — a self reference.
const PWA_FILES = ['./manifest.webmanifest', './icon-192.png', './sw.js', './index.html'];
const external = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map((m) => m[1])
  .filter((url) => !url.startsWith('data:') && !url.startsWith('#') && !PWA_FILES.includes(url));
check('AC-14: build não referencia nada fora do arquivo', external.length === 0, external.join(' | '));

// A service worker only updates when its own bytes change. If the version stops
// tracking the HTML, the PWA serves last month's app forever.
const swPath = resolve(root, 'dist/sw.js');
if (existsSync(swPath)) {
  const sw = readFileSync(swPath, 'utf8');
  const expected = createHash('sha256').update(readFileSync(build)).digest('hex').slice(0, 12);
  check('AC-31: service worker versionado pelo hash do build', sw.includes(expected), `esperado ${expected}`);
} else {
  check('AC-31: service worker versionado pelo hash do build', false, 'dist/sw.js não existe');
}

const browser = await chromium.launch({
  headless: !process.argv.includes('--headed'),
  // SwiftShader gives headless chromium a real WebGL2 implementation.
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--use-gl=angle'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push(String(e)));

await page.goto(pathToFileURL(build).href);
await page.waitForFunction(() => Boolean(window.engine), null, { timeout: 10_000 });

check('AC-14: build abre por file:// e monta a engine', true);

/** Reads a pixel straight out of the GL buffer, right after a forced frame. */
async function pixel(x, y) {
  return page.evaluate(([px, py]) => {
    const engine = window.engine;
    engine.renderFrame();
    const gl = engine.renderer.gl;
    const out = new Uint8Array(4);
    // readPixels' origin is bottom-left; callers think top-left.
    gl.readPixels(px, gl.drawingBufferHeight - py, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
    return [...out];
  }, [x, y]);
}

const size = await page.evaluate(() => {
  const gl = window.engine.renderer.gl;
  return [gl.drawingBufferWidth, gl.drawingBufferHeight];
});
const [W, H] = size;

// Empty project: the projector must be completely dark.
const emptyCentre = await pixel(Math.round(W / 2), Math.round(H / 2));
check('AC-15: projeto vazio não acende nenhum pixel', emptyCentre.slice(0, 3).every((v) => v === 0), `rgb=${emptyCentre}`);

// New surface, still without a source: nothing may be drawn on the wall.
await page.getByRole('button', { name: '+ superfície' }).click();
const noSource = await pixel(Math.round(W / 2), Math.round(H / 2));
check('AC-16: superfície sem fonte não põe luz no objeto', noSource.slice(0, 3).every((v) => v === 0), `rgb=${noSource}`);

// Assign a white colour source: the middle lights up, the edges stay black.
await page.getByRole('button', { name: 'cor', exact: true }).click();
await page.waitForTimeout(200);
const lit = await pixel(Math.round(W / 2), Math.round(H / 2));
check('AC-17: fonte de cor acende o interior da superfície', lit[0] > 200 && lit[1] > 200 && lit[2] > 200, `rgb=${lit}`);

for (const [name, x, y] of [['canto sup-esq', 4, 4], ['canto inf-dir', W - 5, H - 5]]) {
  const p = await pixel(x, y);
  check(`AC-15: fora da superfície é preto absoluto (${name})`, p.slice(0, 3).every((v) => v === 0), `rgb=${p}`);
}

// Ellipse mask: the corners of the frame must be cut away.
const frameCorner = await page.evaluate(() => {
  const engine = window.engine;
  const s = engine.store.project.surfaces[0];
  engine.store.setSurfaceShape(s.id, { kind: 'ellipse', feather: 0 });
  const view = engine.view;
  const c = s.frame[0];
  const dpr = window.devicePixelRatio;
  // A few pixels inside the frame's top-left corner, in device pixels.
  return [Math.round((c.x * view.scale + view.tx) * dpr) + 6, Math.round((c.y * view.scale + view.ty) * dpr) + 6];
});
const cut = await pixel(frameCorner[0], frameCorner[1]);
check('AC-18: máscara de elipse corta os cantos do frame', cut.slice(0, 3).every((v) => v < 20), `rgb=${cut}`);
const stillLit = await pixel(Math.round(W / 2), Math.round(H / 2));
check('AC-18: centro da elipse continua aceso', stillLit[0] > 200, `rgb=${stillLit}`);

// Test patterns must reach the output.
await page.selectOption('#pattern', 'grid');
await page.waitForTimeout(100);
const gridSample = await page.evaluate(() => {
  const engine = window.engine;
  engine.renderFrame();
  const gl = engine.renderer.gl;
  const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
  const buf = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  let white = 0, black = 0;
  for (let i = 0; i < buf.length; i += 4) {
    if (buf[i] > 200) white++; else if (buf[i] === 0) black++;
  }
  return { white, black, total: w * h };
});
check('AC-19: padrão de teste chega na saída',
  gridSample.white > 500 && gridSample.white < gridSample.total * 0.2,
  `brancos=${gridSample.white}`);

await page.selectOption('#pattern', 'none'); // a test pattern would bypass the uv matrix

// Rotation reaches the shader: at 45 degrees the sampled window's corners fall
// outside the source, get discarded, and the lit area becomes a diamond
// inscribed in the frame. Corners dark, centre and edge midpoints lit.
const rotated = await page.evaluate(() => {
  const engine = window.engine;
  const s = engine.store.project.surfaces[0];
  engine.store.setSurfaceShape(s.id, { kind: 'quad' });
  engine.store.setSurfaceFrame(s.id, [
    { x: 660, y: 240 }, { x: 1260, y: 240 }, { x: 1260, y: 840 }, { x: 660, y: 840 },
  ]);
  engine.store.setRotation(s.id, 45);
  engine.store.endGesture();
  const v = engine.view;
  const dpr = window.devicePixelRatio;
  const toPx = (x, y) => [Math.round((x * v.scale + v.tx) * dpr), Math.round((y * v.scale + v.ty) * dpr)];
  return {
    corner: toPx(672, 252),     // just inside the frame's top-left corner
    edgeMid: toPx(960, 252 + 8), // middle of the top edge
    centre: toPx(960, 540),
  };
});
await page.waitForTimeout(50);
const rotCorner = await pixel(...rotated.corner);
const rotEdge = await pixel(...rotated.edgeMid);
const rotCentre = await pixel(...rotated.centre);
check('AC-28: rotação de 45° corta os cantos do frame', rotCorner.slice(0, 3).every((v) => v < 20), `rgb=${rotCorner}`);
check('AC-28: meio da aresta e centro continuam acesos',
  rotEdge[0] > 200 && rotCentre[0] > 200, `aresta=${rotEdge} centro=${rotCentre}`);

await page.evaluate(() => {
  const engine = window.engine;
  engine.store.setRotation(engine.store.project.surfaces[0].id, 0);
  engine.store.endGesture();
});

// Trap 1: perspective-correct UV. A homography maps straight lines to straight
// lines, so on a strongly skewed quad the boundary between two colour bars must
// stay straight. The classic linearly-interpolated-UV bug kinks it exactly at
// the diagonal where the two triangles meet.
await page.evaluate(() => {
  const engine = window.engine;
  const s = engine.store.project.surfaces[0];
  engine.store.setSurfaceShape(s.id, { kind: 'quad' });
  engine.store.setSurfaceFrame(s.id, [
    { x: 220, y: 140 }, { x: 1680, y: 60 }, { x: 1820, y: 980 }, { x: 90, y: 1040 },
  ]);
  engine.store.setTestPattern('bars');
});
await page.waitForTimeout(100);
const straightness = await page.evaluate(() => {
  const engine = window.engine;
  engine.renderFrame();
  const gl = engine.renderer.gl;
  const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
  const buf = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  const at = (x, y) => (y * w + x) * 4;

  // The first bar is white, the second yellow: the boundary is where blue drops.
  const pts = [];
  for (let row = 0; row < h; row++) {
    for (let x = 1; x < w; x++) {
      const i0 = at(x - 1, row), i1 = at(x, row);
      // white (255,255,255) -> yellow (255,255,0): only the blue channel drops.
      // Green must stay high, or the magenta->red boundary further right matches too.
      const white = buf[i0] > 200 && buf[i0 + 1] > 200 && buf[i0 + 2] > 200;
      const yellow = buf[i1] > 200 && buf[i1 + 1] > 200 && buf[i1 + 2] < 60;
      if (white && yellow) {
        pts.push([x, row]);
        break;
      }
    }
  }
  if (pts.length < 20) return { count: pts.length, maxResidual: Infinity };

  // Least-squares fit of x = a*y + b, then the worst deviation from it.
  const n = pts.length;
  const sy = pts.reduce((t, p) => t + p[1], 0);
  const sx = pts.reduce((t, p) => t + p[0], 0);
  const syy = pts.reduce((t, p) => t + p[1] * p[1], 0);
  const sxy = pts.reduce((t, p) => t + p[0] * p[1], 0);
  const a = (n * sxy - sx * sy) / (n * syy - sy * sy);
  const b = (sx - a * sy) / n;
  const maxResidual = Math.max(...pts.map(([x, y]) => Math.abs(x - (a * y + b))));
  return { count: pts.length, maxResidual };
});
check('AC-20: UV com correção de perspectiva — borda reta, sem dobra diagonal',
  straightness.maxResidual <= 1.5,
  `amostras=${straightness.count} desvio máx=${straightness.maxResidual.toFixed(2)}px`);

await page.selectOption('#pattern', 'none');

// Per-surface test pattern: one surface can override the global one while its
// neighbour keeps it. Both get the same white colour source, then one is told
// to draw black — if the override reaches the GPU, only that one goes dark.
const spots = await page.evaluate(() => {
  const engine = window.engine;
  const store = engine.store;
  const src = store.project.sources[0].id;

  const a = store.project.surfaces[0];
  store.setSurfaceShape(a.id, { kind: 'quad' });
  store.setSurfaceFrame(a.id, [
    { x: 200, y: 200 }, { x: 800, y: 200 }, { x: 800, y: 700 }, { x: 200, y: 700 },
  ]);
  store.setSurfaceSource(a.id, src);

  const b = store.addSurface();
  store.setSurfaceFrame(b.id, [
    { x: 1000, y: 200 }, { x: 1700, y: 200 }, { x: 1700, y: 700 }, { x: 1000, y: 700 },
  ]);
  store.setSurfaceSource(b.id, src);

  store.setTestPattern('none');
  store.setSurfacePattern(a.id, 'black');

  const v = engine.view;
  const dpr = window.devicePixelRatio;
  const toPx = (x, y) => [Math.round((x * v.scale + v.tx) * dpr), Math.round((y * v.scale + v.ty) * dpr)];
  return { a: toPx(500, 450), b: toPx(1350, 450), ids: [a.id, b.id] };
});
await page.waitForTimeout(80);
const patched = await pixel(...spots.a);
const untouched = await pixel(...spots.b);
check('AC-32: padrão próprio de uma superfície vale só nela',
  patched.slice(0, 3).every((v) => v === 0), `rgb=${patched}`);
check('AC-32: a vizinha continua seguindo o padrão global',
  untouched[0] > 200, `rgb=${untouched}`);

await page.evaluate((ids) => {
  const store = window.engine.store;
  store.setSurfacePattern(ids[0], null);
  store.removeSurface(ids[1]);
}, spots.ids);

// Undo must walk the geometry back.
const undoOk = await page.evaluate(() => {
  const engine = window.engine;
  const s = engine.store.project.surfaces[0];
  const before = s.frame[0].x;
  engine.store.setCorner(s.id, 0, { x: before - 100, y: s.frame[0].y });
  engine.store.endGesture();
  const moved = engine.store.project.surfaces[0].frame[0].x;
  engine.store.undo();
  return { before, moved, after: engine.store.project.surfaces[0].frame[0].x };
});
check('AC-7: desfazer volta o canto arrastado pela UI real', undoOk.after === undoOk.before && undoOk.moved !== undoOk.before, JSON.stringify(undoOk));

check('AC-14: console sem erros', consoleErrors.length === 0, consoleErrors.join(' | '));

await browser.close();
console.log(failures.length ? `\n${failures.length} falha(s)` : '\ntudo passou');
process.exit(failures.length ? 1 : 0);
