import type { Guide } from './types.ts';

export const guideEn: Guide = [
  {
    id: 'what',
    title: 'What this is',
    blocks: [
      { kind: 'p', text: 'You point a projector at a physical thing — a wall with picture frames, a stack of boxes, a window, a piece of furniture. You draw shapes on top of the projection that line up with the real objects, and put content inside each shape.' },
      { kind: 'p', text: 'The rule that governs everything: <b>black is transparency</b>. Every black pixel is an absence of light, so the physical surface shows through it. Outside the shapes you mapped, nothing is drawn.' },
      { kind: 'note', text: 'Use Chrome or Edge. Other browsers open the app but lose folder access, GIF timing and automatic screen placement.' },
    ],
  },
  {
    id: 'start',
    title: 'First run',
    blocks: [
      { kind: 'p', text: 'Six steps, about a minute, in this order.' },
      {
        kind: 'steps',
        items: [
          '<b>Open folder</b> — pick an empty folder. The project file and your media live there, and everything saves on its own.',
          '<b>Match this screen</b> — choose the projector in the list and click it. This makes the app work at the projector native resolution.',
          '<b>+ surface</b> — a rectangle appears. Drag its four corners until they cover the real object.',
          'Drag a video or an image <b>onto the surface</b> to fill it.',
          '<b>Send to projector</b> — the projection goes to the second screen and the controls stay on your laptop.',
          'Press <b>H</b> to hide the interface. Press H again to bring it back.',
        ],
      },
      { kind: 'note', text: 'Match the resolution before aligning. Aligning first and changing the resolution afterwards throws the alignment away.' },
    ],
  },
  {
    id: 'surfaces',
    title: 'Surfaces',
    blocks: [
      { kind: 'p', text: 'A surface is a quadrilateral with four corners. Those corners carry the perspective: drag them until the projected edge sits on the real edge, and the content warps along.' },
      {
        kind: 'list',
        items: [
          'Drag <b>inside</b> a surface to move it whole; drag a <b>corner</b> to deform it.',
          'Click a corner and use the <b>arrow keys</b> to move it one pixel at a time. This is the adjustment that decides everything.',
          'With no corner selected, the arrows move the whole surface.',
          'The <b>magnet</b> sticks corners to the corners of other surfaces. Hold Ctrl to switch it off for a moment.',
          'Double click a name in the list to rename it. A list of “Surface 7” helps nobody.',
        ],
      },
      { kind: 'p', text: 'Each row in the list carries three switches: <b>S</b> solos the surface and blanks every other one, the <b>eye</b> blanks this one, and the <b>padlock</b> locks it.' },
      { kind: 'note', text: 'Lock a surface as soon as it is aligned. Bumping an aligned corner is the most expensive accident there is, and a locked surface refuses every move — mouse, arrows and all.' },
    ],
  },
  {
    id: 'shapes',
    title: 'Shapes',
    blocks: [
      { kind: 'p', text: 'Inside the quadrilateral goes a cutout. The frame keeps the perspective; the cutout decides what is lit.' },
      {
        kind: 'list',
        items: [
          '<b>Rectangle</b> — fills the whole frame.',
          '<b>Ellipse</b> — for round objects, with a soft edge you can dial from a hard line to a wide fade.',
          '<b>Polygon</b> — click the polygon tool, click around the object, double click to close. Esc cancels.',
        ],
      },
      { kind: 'p', text: 'Moving the frame carries the cutout with it, so aligning never means redrawing the shape.' },
    ],
  },
  {
    id: 'content',
    title: 'Content',
    blocks: [
      { kind: 'p', text: 'Drop a file straight onto a surface, or pick a source in the Content panel. One source can feed several surfaces.' },
      {
        kind: 'list',
        items: [
          '<b>File</b> — image, video or GIF. Videos loop muted.',
          '<b>Color</b> — a solid colour, the fastest way to check an edge.',
          '<b>Screen capture</b> — any window on the machine, live. A game, a player, another tab.',
          '<b>Camera</b> — a live webcam.',
          '<b>JS module</b> — your own generative drawing. See below.',
        ],
      },
      { kind: 'p', text: 'Once a surface has content, four controls shape it: <b>fit</b> (stretch ignores proportion, contain shows everything and leaves black, cover fills and crops), <b>rotation</b>, <b>opacity</b> and <b>blend</b>.' },
      { kind: 'note', text: 'Rotation turns the content, never the frame — so it is safe on a surface you already aligned and locked.' },
    ],
  },
  {
    id: 'module',
    title: 'Your own content in JavaScript',
    blocks: [
      { kind: 'p', text: 'A <b>JS module</b> source is any <code>.js</code> file that exports a <code>draw</code> function. The app calls it every frame with a 2D canvas context and the elapsed time in seconds, and whatever you paint becomes a projected texture.' },
      {
        kind: 'code',
        code: `export const size = [512, 512];

export function draw(ctx, t) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 512, 512);

  ctx.fillStyle = '#fff';
  const x = 256 + Math.cos(t) * 160;
  ctx.beginPath();
  ctx.arc(x, 256, 40, 0, Math.PI * 2);
  ctx.fill();
}`,
      },
      { kind: 'p', text: 'Save it in the project folder and pick it with the <b>js module</b> button. If it throws, the surface shows the missing-media pattern instead of taking the show down.' },
    ],
  },
  {
    id: 'patterns',
    title: 'Test patterns',
    blocks: [
      { kind: 'p', text: 'Patterns replace the content so you can see what you are aligning. Set one for everything in the top bar, or one for a single surface in its panel — a surface pattern wins over the global one.' },
      {
        kind: 'list',
        items: [
          '<b>Grid</b> — shows whether the surface is distorted. Straight lines have to stay straight.',
          '<b>Number</b> — projects each surface position, so you know which one you are touching.',
          '<b>Crosshair</b> — centre and diagonals, for centring on an object.',
          '<b>White</b> / <b>black</b> — check the exact edge, and check the black point.',
          '<b>Color bars</b> — check colour and projector settings.',
          '<b>Sweep</b> — a moving line, to feel the latency.',
        ],
      },
    ],
  },
  {
    id: 'output',
    title: 'Output and screens',
    blocks: [
      { kind: 'p', text: '<b>Send to projector</b> opens a clean window on the chosen screen: no interface, no cursor, no border. The editor stays where it is.' },
      {
        kind: 'list',
        items: [
          'Press <b>Esc</b> in the output window to close it.',
          'If the browser blocks the pop-up, allow pop-ups for this page and try again.',
          'If it does not go fullscreen, click the output window and press F11.',
          'Without a second screen, drag the output window onto the projector by hand.',
        ],
      },
      { kind: 'note', text: 'In clean output the only lit pixels are inside your surfaces. Cover the lens with your hand and the wall should be completely dark.' },
    ],
  },
  {
    id: 'project',
    title: 'The project on disk',
    blocks: [
      { kind: 'p', text: 'A project is a folder, not a file. Inside it there is a <code>project.json</code> with relative paths and the media next to it, which is what survives being copied to a USB stick.' },
      {
        kind: 'list',
        items: [
          'Saving is automatic, moments after each change.',
          'Files you drop are copied into the folder, so the project carries its media.',
          'If a file goes missing, the surface shows loud magenta stripes — never silence, and never light on a physical object with nothing behind it.',
          'Without folder access the project stays in browser memory and the media does not survive a restart. The app tells you when that happens.',
        ],
      },
    ],
  },
  {
    id: 'keyboard',
    title: 'Keyboard',
    blocks: [
      {
        kind: 'keys',
        rows: [
          ['↑ ↓ ← →', 'Move the selected corner 1 px — or the whole surface, with no corner selected'],
          ['Shift + arrows', 'The same, 10 px'],
          ['Ctrl (hold)', 'Switch the magnet off while held'],
          ['Ctrl+Z / Ctrl+Shift+Z', 'Undo / redo'],
          ['Ctrl+D', 'Duplicate the selected surface'],
          ['Delete', 'Delete the selected surface'],
          ['H', 'Hide or show the interface'],
          ['Esc', 'Cancel the polygon, drop the corner selection'],
          ['Mouse wheel', 'Zoom at the cursor'],
          ['Middle button, or Alt + drag', 'Pan'],
        ],
      },
    ],
  },
];
