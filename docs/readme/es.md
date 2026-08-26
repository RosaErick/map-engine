# ProjMap

[English](../../README.md) · [Português](pt.md) · **Español**

Mi propia herramienta de *projection mapping* que corre en el navegador, desarrollada
desde cero con apoyo de herramientas de IA generativa. Apuntas un proyector a un objeto
físico — una pared con cuadros, una pila de cajas, un mueble —, dibujas formas sobre la
proyección que coinciden con él, y sueltas contenido dentro de cada forma: imagen, video,
GIF, color, captura de pantalla, cámara en vivo, texto o un canvas generativo.

Son dos mitades con una frontera rígida: un **engine** sin interfaz, que recibe un estado
serializable y lo renderiza; y un **editor**, que es solo una de las formas posibles de
producir ese estado. El engine corre solo, importado como biblioteca por cualquier otro
proyecto.

> **El negro es transparente.** Todo píxel negro en la salida es ausencia de luz, y la
> superficie física se ve a través de él. Fuera de las formas mapeadas no se dibuja nada
> — ni un gris, ni un borde, ni un píxel de interfaz.

**Gratuita y de código abierto, hoy y siempre.** Sin versión de pago, sin plan, sin
cuenta, sin marca de agua, sin límite de proyectos y sin nube. La licencia
[AGPL-3.0](#licencia) es lo que lo garantiza: cualquiera puede usar, estudiar y
contribuir, y nadie puede cerrar el código y revenderlo.

Todo el contenido generado por LLMs fue revisado, editado y seleccionado por el
desarrollador antes de entrar al proyecto.

---

## Instalar

**¿No programas?** El paso a paso está en **[`docs/install/`](../install)** — en
[español](../install/es.md), [portugués](../install/pt.md) e
[inglés](../install/en.md). En resumen, dos caminos:

- **Instalar como aplicación** — abre la dirección en Chrome o Edge y haz clic en el
  icono de instalar de la barra de direcciones. Ganas icono propio, una ventana sin barra
  de direcciones, y pasa a funcionar sin internet.
- **Descargar un archivo** — toma `projmap.html` en las
  [Releases](../../../../releases) y haz doble clic. Un solo archivo, ~285 KB, sin
  instalación y sin servidor.

---

## Inicio rápido (desarrollo)

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # dist/ — index.html autocontenido + manifest, iconos y service worker
```

`dist/index.html` funciona solo: los demás archivos existen únicamente para la instalación
como aplicación, y su ausencia no impide nada.

---

## Teclado

| Tecla | Qué hace |
|---|---|
| `↑ ↓ ← →` | Mueve la esquina seleccionada **1 px** — o toda la superficie, si no hay ninguna seleccionada |
| `Shift` + flechas | Lo mismo, **10 px** |
| `Ctrl` (mantener) | Apaga el imán mientras esté presionado |
| `Ctrl+Z` / `Ctrl+Shift+Z` | Deshacer / rehacer |
| `Ctrl+D` | Duplicar la superficie seleccionada |
| `Delete` | Borrar la superficie seleccionada |
| `H` | Ocultar / mostrar la interfaz |
| `X` | Rayos x: apaga el contenido y enciende la estructura |
| `Esc` | Cancelar el trazado de polígono, soltar la selección de esquina |
| Rueda del ratón | Zoom en el punto del cursor |
| Botón central, `Ctrl` o `Alt` + arrastrar | Reencuadrar la vista |
| Doble clic (modo polígono) | Cierra el polígono |

---

## Encaje del contenido

Dentro de cada superficie el contenido tiene cuatro controles independientes, en el panel
de la derecha:

| Control | Qué hace |
|---|---|
| **encaje** | `estirar` ignora la proporción · `contener` muestra todo y deja negro alrededor · `cubrir` llena la forma y recorta el excedente |
| **rotación** | Gira el contenido alrededor del centro del frame, 0–359°, con atajos de 0/90/180/270. El **frame no se mueve**, así que girar es seguro en una superficie ya bloqueada y alineada |
| **opacidad** | 0–100% |
| **mezcla** | `normal` · `suma` · `screen` · `multiply` |

Un cuarto de vuelta intercambia la proporción que usan `contener` y `cubrir`, para que un
video horizontal siga encajando. La rotación libre es para corregir un proyector torcido,
no para reencuadrar.

---

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con HMR |
| `npm run build` | Genera un `dist/index.html` autocontenido |
| `npm test` | 127 pruebas unitarias (`node:test`, cero dependencias) |
| `npm run layers` | Rechaza un `import` que apunta en la dirección equivocada entre las capas |
| `npm run smoke` | Abre el build por `file://` en chromium headless y **lee píxeles** de la salida |
| `npm run i18n` | Rechaza texto fijo en el editor y traducción que perdió un placeholder |
| `npm run verify` | Los cuatro de arriba más el build, en orden — es lo que corre el CI en cada PR |
| `npm run check` | `tsc --noEmit` + `svelte-check` |
| `npm run build:lib` | Genera `dist-lib/` — el engine como biblioteca, con tipos |
| `npm run example` | Corre [`examples/embed/`](../../examples/embed), que consume esa biblioteca |

---

## Tipos de contenido

| Tipo | De dónde viene | Nota |
|---|---|---|
| `image` | archivo en la carpeta | decodificado una vez |
| `video` | archivo en la carpeta | subida guiada por `requestVideoFrameCallback`; WebM con alfa funciona |
| `gif` | archivo en la carpeta | cuadros vía `ImageDecoder` (WebCodecs), con reloj propio |
| `color` | color sólido | textura 1×1 |
| `capture` | `getDisplayMedia()` | **cualquier ventana de la máquina se vuelve textura en vivo** — un juego, un reproductor, otra pestaña |
| `camera` | `getUserMedia()` | cámara en vivo |
| `text` | escrito en la app | fondo negro, glifos de color: solo las letras se encienden |
| `canvas` | un módulo JS tuyo | exporta `draw(ctx, t)`; el punto de extensión para contenido generativo |

Una fuente alimenta varias superficies: la caché es por fuente, nunca por superficie.

---

## Usar el engine sin el editor

El engine no importa ningún framework, no toca el DOM fuera de su propio canvas y no lee
nada global.

```ts
import { createEngine, parseProject } from './packages/engine/index.ts';

const engine = createEngine(canvas, parseProject(json), {
  // cómo las rutas relativas se vuelven URLs cargables — lo decide el host
  resolveUrl: async (path) => new URL(path, base).href,
});

engine.setSurfaceFrame(id, [tl, tr, br, bl]);
engine.setSurfaceSource(id, sourceId);
engine.on('change', (state) => console.log(state.project.surfaces.length));
engine.start();
```

Toda mutación pasa por los métodos del store (`engine.store`), lo que hace de un futuro
puente OSC/MIDI un adaptador puro, sin tocar el renderer.

---

## Requisitos

**Chromium de escritorio (Chrome o Edge).** Varias de las APIs necesarias existen solo
ahí: File System Access, Window Management, `ImageDecoder`, `requestVideoFrameCallback`.
La ausencia de cada una se detecta y se avisa explícitamente — sin carpeta de proyecto la
app sigue funcionando con los medios en memoria y el `project.json` en el navegador, y lo
dice en pantalla.

---

## Documentación

| Documento | Qué es |
|---|---|
| [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md) | Qué hace cada archivo, el trazo de un frame, las cinco trampas de renderizado |
| [`AGENTS.md`](../../AGENTS.md) | Las decisiones de arquitectura en formato ADR, y las reglas para quien vaya a tocar el código |
| [`docs/CHANGELOG.md`](../CHANGELOG.md) | Qué cambió en cada versión, y por qué |
| [`docs/FUTURO.md`](../FUTURO.md) | Ideas más allá de la v1, registradas sin compromiso de hacerlas |
| [`docs/install/`](../install) | Instalación paso a paso, en tres idiomas |

---

## Licencia

**AGPL-3.0-only** ([`LICENSE`](../../LICENSE)). Cualquiera puede usar, estudiar, modificar
y contribuir. Lo que la AGPL impide es el único escenario que este proyecto no quiere: que
alguien tome el código, lo cierre y lo publique como producto propio — incluso alojándolo
como servicio, sin distribuir ningún binario. Si lo modificas y lo publicas, el código
modificado sale junto.

Cómo contribuir está en [`CONTRIBUTING.md`](../../CONTRIBUTING.md).
