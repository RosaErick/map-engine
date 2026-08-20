// Projection mapping inside someone else's page, in about thirty lines.
//
// The engine takes a canvas and a Project and draws. It imports no framework,
// touches no DOM outside its own canvas and reads no globals — so a host page
// only has to hand it those two things.
//
//   npm run build:lib && npm run example
import { createEngine, emptyProject, newSurface } from '../../dist-lib/map-engine.js';

const canvas = document.getElementById('output');

const project = emptyProject(1280, 720);

// A solid colour on the left…
project.sources.push({ id: 'red', name: 'red', kind: 'color', rgb: [220, 40, 90] });
const left = newSurface(project, 'left');
left.frame = [{ x: 120, y: 120 }, { x: 600, y: 90 }, { x: 620, y: 600 }, { x: 100, y: 620 }];
left.sourceId = 'red';
project.surfaces.push(left);

// …and a generative canvas module on the right, clipped to an ellipse.
project.sources.push({ id: 'sketch', name: 'sketch', kind: 'canvas', moduleId: 'sketch' });
const right = newSurface(project, 'right');
right.frame = [{ x: 700, y: 100 }, { x: 1180, y: 130 }, { x: 1160, y: 620 }, { x: 680, y: 590 }];
right.shape = { kind: 'ellipse', feather: 0.25 };
right.sourceId = 'sketch';
project.surfaces.push(right);

const engine = createEngine(canvas, project, {
  // How project-relative paths become loadable URLs is the host's business.
  resolveUrl: async (path) => new URL(path, location.href).href,
  // A `canvas` source is any module exporting draw(ctx, t).
  loadModule: async () => ({
    size: [512, 512],
    draw(ctx, t) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 12; i++) {
        const a = t * 0.6 + (i / 12) * Math.PI * 2;
        ctx.fillStyle = `hsl(${(i * 30 + t * 40) % 360} 90% 60%)`;
        ctx.beginPath();
        ctx.arc(256 + Math.cos(a) * 150, 256 + Math.sin(a) * 150, 34, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  }),
});

const fit = () => {
  engine.resize(window.innerWidth, window.innerHeight);
  const scale = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
  engine.setView({
    scale,
    tx: (window.innerWidth - 1280 * scale) / 2,
    ty: (window.innerHeight - 720 * scale) / 2,
  });
};
fit();
window.addEventListener('resize', fit);
engine.start();

// Every mutation goes through the store, which is what an OSC or MIDI bridge
// would drive later without touching the renderer.
window.engine = engine;
