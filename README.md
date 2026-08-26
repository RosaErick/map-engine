# ProjMap

**English** · [Português](docs/readme/pt.md) · [Español](docs/readme/es.md)

My own *projection mapping* tool that runs in the browser, built from scratch with the
help of generative AI tools. You point a projector at a physical object — a wall with
picture frames, a stack of boxes, a piece of furniture —, draw shapes over the projection
that line up with it, and drop content inside each shape: image, video, GIF, colour,
screen capture, live camera, text or a generative canvas.

It is two halves with a hard border between them: an **engine** with no interface, which
takes a serialisable state and renders it; and an **editor**, which is only one of the
possible ways to produce that state. The engine runs on its own, imported as a library
by any other project.

> **Black is transparent.** Every black pixel in the output is an absence of light, and
> the physical surface shows through it. Outside the mapped shapes nothing is drawn — not
> a grey, not a border, not one pixel of interface.

**Free and open source, today and always.** No paid tier, no plan, no account, no
watermark, no project limit and no cloud. The [AGPL-3.0](#license) licence is what
guarantees that: anyone may use, study and contribute, and nobody may close the source
and resell it.

Every piece of LLM-generated content was reviewed, edited and selected by the developer
before going into the project.

---

## Install

**Not a programmer?** The step by step is in **[`docs/install/`](docs/install)** — in
[English](docs/install/en.md), [Portuguese](docs/install/pt.md) and
[Spanish](docs/install/es.md). In short, two paths:

- **Install as an app** — open the address in Chrome or Edge and click the install icon
  in the address bar. You get an icon of your own, a window with no address bar, and it
  starts working without internet.
- **Download one file** — grab `projmap.html` from the [Releases](../../releases) and
  double click it. A single file, ~285 KB, no install and no server.

---

## Quick start (development)

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # dist/ — self-contained index.html plus manifest, icons and service worker
```

`dist/index.html` works on its own: the other files exist only for installing as an app,
and their absence stops nothing.

---

## Keyboard

| Key | What it does |
|---|---|
| `↑ ↓ ← →` | Moves the selected corner **1 px** — or the whole surface, when no corner is selected |
| `Shift` + arrows | The same, **10 px** |
| `Ctrl` (hold) | Turns the magnet off while held |
| `Ctrl+Z` / `Ctrl+Shift+Z` | Undo / redo |
| `Ctrl+D` | Duplicate the selected surface |
| `Delete` | Delete the selected surface |
| `H` | Hide / show the interface |
| `X` | X-ray: dims the content and lights up the structure |
| `Esc` | Cancel the polygon trace, drop the corner selection |
| Mouse wheel | Zoom at the cursor |
| Middle button, `Ctrl` or `Alt` + drag | Reframe the view |
| Double click (polygon mode) | Closes the polygon |

---

## Fitting the content

Inside each surface the content has four independent controls, in the right-hand panel:

| Control | What it does |
|---|---|
| **fit** | `stretch` ignores the aspect ratio · `contain` shows everything and leaves black around it · `cover` fills the shape and crops the excess |
| **rotation** | Spins the content around the centre of the frame, 0–359°, with 0/90/180/270 shortcuts. The **frame does not move**, so rotating is safe on a surface that is already locked and aligned |
| **opacity** | 0–100% |
| **blend** | `normal` · `add` · `screen` · `multiply` |

A quarter turn swaps the aspect ratio used by `contain` and `cover`, so a landscape video
keeps fitting. Free rotation is for correcting a crooked projector, not for reframing.

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server with HMR |
| `npm run build` | Produces a self-contained `dist/index.html` |
| `npm test` | 127 unit tests (`node:test`, zero dependencies) |
| `npm run layers` | Fails an `import` that points the wrong way across the layers |
| `npm run smoke` | Opens the build over `file://` in headless chromium and **reads pixels** off the output |
| `npm run i18n` | Fails hardcoded copy in the editor and a translation that lost a placeholder |
| `npm run verify` | The four above plus the build, in order — it is what CI runs on every PR |
| `npm run check` | `tsc --noEmit` + `svelte-check` |
| `npm run build:lib` | Produces `dist-lib/` — the engine as a library, with types |
| `npm run example` | Runs [`examples/embed/`](examples/embed), which consumes that library |

---

## Content kinds

| Kind | Where it comes from | Note |
|---|---|---|
| `image` | file in the folder | decoded once |
| `video` | file in the folder | upload driven by `requestVideoFrameCallback`; WebM with alpha works |
| `gif` | file in the folder | frames through `ImageDecoder` (WebCodecs), on a clock of its own |
| `color` | solid colour | 1×1 texture |
| `capture` | `getDisplayMedia()` | **any window on the machine becomes a live texture** — a game, a player, another tab |
| `camera` | `getUserMedia()` | live camera |
| `text` | written in the app | black background, coloured glyphs: only the letters light up |
| `canvas` | a JS module of yours | exports `draw(ctx, t)`; the extension point for generative content |

One source feeds many surfaces: the cache is per source, never per surface.

---

## Using the engine without the editor

The engine imports no framework, touches no DOM outside its own canvas and reads nothing
global.

```ts
import { createEngine, parseProject } from './packages/engine/index.ts';

const engine = createEngine(canvas, parseProject(json), {
  // how relative paths become loadable URLs — the host decides
  resolveUrl: async (path) => new URL(path, base).href,
});

engine.setSurfaceFrame(id, [tl, tr, br, bl]);
engine.setSurfaceSource(id, sourceId);
engine.on('change', (state) => console.log(state.project.surfaces.length));
engine.start();
```

Every mutation goes through the store's methods (`engine.store`), which makes a future
OSC/MIDI bridge a pure adapter, without touching the renderer.

---

## Requirements

**Chromium desktop (Chrome or Edge).** Several of the APIs it needs exist only there:
File System Access, Window Management, `ImageDecoder`, `requestVideoFrameCallback`. The
absence of each one is detected and reported explicitly — with no project folder the app
keeps working with the media in memory and the `project.json` in the browser, and says so
on screen.

---

## Documentation

| Document | What it is |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | What each file does, the trace of one frame, the five rendering traps |
| [`AGENTS.md`](AGENTS.md) | The architecture decisions as ADRs, and the rules for anyone touching the code |
| [`docs/CHANGELOG.md`](docs/CHANGELOG.md) | What changed in each version, and why |
| [`docs/FUTURO.md`](docs/FUTURO.md) | Ideas beyond v1, recorded with no commitment to build them |
| [`docs/install/`](docs/install) | Step by step installation, in three languages |

---

## License

**AGPL-3.0-only** ([`LICENSE`](LICENSE)). Anyone may use, study, modify and contribute.
What the AGPL prevents is the one scenario this project does not want: someone taking the
code, closing it and publishing it as their own product — including hosting it as a
service, without distributing any binary. Modify it and publish it, and the modified code
goes out with it.

How to contribute is in [`CONTRIBUTING.md`](CONTRIBUTING.md).
