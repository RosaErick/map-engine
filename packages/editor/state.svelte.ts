import {
  Store, anchorId, emptyProject, newSurface, quadToUnit, solveUnitToQuad, apply, frameToPixel,
  pointInPolygon, pointInUnitEllipse, closestOnSegment, evaluateWarp, unwarp,
  type Mat3, type Surface, type Vec2,
} from '../engine/index.ts';
import { t } from './i18n/index.svelte.ts';
import type { Engine } from '../engine/engine.ts';

/** One store for the whole app. The output window shares this exact object —
 *  see packages/output/output.ts for why that beats a message channel here. */
export const store = new Store(emptyProject(1920, 1080));

export type Tool = 'select' | 'polygon';
export type Page = 'editor' | 'docs' | 'about';

/**
 * Estado só do editor: nunca salvo, nunca visto pela engine.
 *
 * Três objetos em vez de um balde, porque são três ciclos de vida diferentes.
 * `viewport` muda a cada roda do mouse e é a única parte que a engine lê;
 * `tools` é o que está na mão do operador agora; `session` é o que está
 * acontecendo com o projeto e a saída. Separar é legibilidade, não desempenho —
 * runes já reagem por propriedade, então o balde não custava re-render extra.
 */

/** Pan e zoom da área de trabalho, em pixels de tela. */
export const viewport = $state({ scale: 0.5, tx: 0, ty: 0 });

/** O que o ponteiro faz agora. */
export const tools = $state({
  tool: 'select' as Tool,
  snap: true,
  /** Tecla segurada desliga o ímã por um instante. */
  snapOff: false,
  pendingPolygon: [] as Vec2[],
  /** Raio, em passos de grade, com que os vizinhos acompanham o ponto arrastado. */
  warpFalloff: 1,
  showWarpGrid: true,
});

/** Onde o projeto está e o que a saída está fazendo. */
export const session = $state({
  page: 'editor' as Page,
  status: '' as string,
  folderName: '' as string,
  /** Uma pasta de projeto de verdade foi aberta — diferente de ter salvo na
   *  memória do navegador, que acontece sozinho no primeiro autosave. */
  hasFolder: false,
  /** Momento do último autosave, zerado por um timer. A barra de cima usa isso
   *  para responder "meu trabalho está salvo?" sem ninguém precisar perguntar. */
  savedAt: 0,
  /** Nome da pasta da sessão anterior que só falta permissão para reabrir. A
   *  permissão não pode ser pedida sozinha na partida, então o nome fica aqui
   *  esperando o clique que tem direito de pedi-la. */
  pendingFolder: '' as string,
  outputOpen: false,
  outputScreen: '',
});

let engineRef: Engine | null = null;
export function setEngine(e: Engine | null): void { engineRef = e; }
export function getEngine(): Engine | null { return engineRef; }

/** Screen pixels (relative to the stage) -> output pixels. */
export function toOutput(p: Vec2): Vec2 {
  return { x: (p.x - viewport.tx) / viewport.scale, y: (p.y - viewport.ty) / viewport.scale };
}

/** Output pixels -> screen pixels. */
export function toScreen(p: Vec2): Vec2 {
  return { x: p.x * viewport.scale + viewport.tx, y: p.y * viewport.scale + viewport.ty };
}

export function fitView(stageW: number, stageH: number): void {
  const { width, height } = store.project.output;
  const scale = Math.min(stageW / width, stageH / height) * 0.9;
  viewport.scale = scale;
  viewport.tx = (stageW - width * scale) / 2;
  viewport.ty = (stageH - height * scale) / 2;
}

/**
 * Impede que a área de trabalho perca a saída de vista.
 *
 * O zoom era preso entre 0,05 e 8 e o pan não era preso em nada, então bastava
 * arrastar longe o bastante para a saída sair inteira da tela — e aí a roda do
 * mouse ampliava o vazio, sem nada na tela para orientar a volta. "Enquadrar"
 * resolvia, mas exigia saber que aquele botão existia.
 *
 * Não é uma trava no gesto: é um limite no resultado, aplicado depois, então o
 * arrasto continua fluido e só para de andar quando encosta.
 */
const KEEP_VISIBLE = 48;

export function clampView(stageW: number, stageH: number): void {
  const { width, height } = store.project.output;
  const w = width * viewport.scale;
  const h = height * viewport.scale;
  // Uma faixa da saída sempre alcançável, ou a saída inteira quando ela é menor
  // que a margem — senão um zoom muito distante ficaria impossível de arrastar.
  const marginX = Math.min(KEEP_VISIBLE, w);
  const marginY = Math.min(KEEP_VISIBLE, h);
  viewport.tx = Math.min(stageW - marginX, Math.max(marginX - w, viewport.tx));
  viewport.ty = Math.min(stageH - marginY, Math.max(marginY - h, viewport.ty));
}

/** Snap radius in output pixels — a fixed screen distance, so zooming in makes
 *  snapping finer instead of stickier. */
const SNAP_PX = 8;

/**
 * Gruda num canto ou numa aresta de outra superfície, o que estiver mais perto.
 *
 * Canto ganha da aresta no empate: quando dois objetos mapeados se encontram, o
 * que precisa coincidir é o canto, e um canto que escorrega pela aresta vizinha
 * é pior do que não grudar. Por isso a aresta só entra se nenhum canto estiver
 * ao alcance.
 */
export function snapPoint(p: Vec2, exceptId: string): Vec2 {
  if (!tools.snap || tools.snapOff) return p;
  const radius = SNAP_PX / viewport.scale;

  let corner: Vec2 | null = null;
  let cornerDist = radius;
  let edge: Vec2 | null = null;
  let edgeDist = radius;

  for (const s of store.project.surfaces) {
    if (s.id === exceptId) continue;
    for (let i = 0; i < s.frame.length; i++) {
      const a = s.frame[i]!;
      const b = s.frame[(i + 1) % s.frame.length]!;

      const d = Math.hypot(a.x - p.x, a.y - p.y);
      if (d < cornerDist) { cornerDist = d; corner = a; }

      const hit = closestOnSegment(p, a, b);
      if (hit.distance < edgeDist) { edgeDist = hit.distance; edge = hit.point; }
    }
  }

  const target = corner ?? edge;
  return target ? { x: target.x, y: target.y } : p;
}

/**
 * Superfície mais ao alto sob um ponto em pixels de saída.
 *
 * O teste é feito contra o **recorte**, não contra o quadrilátero envolvente:
 * clicar no canto vazio da caixa de uma elipse ou de um polígono não deve
 * selecionar aquilo que não está aceso ali.
 */
export function surfaceAt(p: Vec2): Surface | null {
  const sorted = [...store.project.surfaces].sort((a, b) => b.z - a.z);
  for (const s of sorted) {
    if (!s.visible) continue;
    const uv = outputToFrame(s, p);
    if (!uv || uv.x < 0 || uv.x > 1 || uv.y < 0 || uv.y > 1) continue;

    if (s.shape.kind === 'ellipse' && !pointInUnitEllipse(uv)) continue;
    if (s.shape.kind === 'polygon' && !pointInPolygon(uv, s.shape.points)) continue;
    return s;
  }
  return null;
}

/**
 * Homografia de uma superfície e sua inversa, resolvidas uma vez por versão.
 *
 * Resolver o sistema 8×8 é caro e estava acontecendo **por vértice** ao desenhar
 * as alças de polígono, e a cada `pointermove` ao arrastar. A chave é o próprio
 * objeto `Surface`: como `Store.mutate` clona o projeto, qualquer edição cria
 * objetos novos e a entrada velha cai sozinha do WeakMap — não existe código de
 * invalidação aqui para errar.
 */
const transforms = new WeakMap<Surface, { forward: Mat3 | null; inverse: Mat3 | null }>();

function transformsFor(surface: Surface): { forward: Mat3 | null; inverse: Mat3 | null } {
  const cached = transforms.get(surface);
  if (cached) return cached;
  const forward = solveUnitToQuad(surface.frame);
  const entry = { forward, inverse: forward ? quadToUnit(surface.frame) : null };
  transforms.set(surface, entry);
  return entry;
}

/** Ponto do espaço do frame (0..1) em pixels de saída. */
export function frameToOutput(surface: Surface, u: number, v: number): Vec2 | null {
  const { forward } = transformsFor(surface);
  return forward ? frameToPixel(forward, u, v) : null;
}

/**
 * Pixels de saída de volta para o espaço do frame, atravessando a malha.
 *
 * A homografia do frame desfaz a perspectiva; a malha, quando existe, precisa
 * ser desfeita depois — senão clicar numa superfície deformada acerta o lugar
 * errado, e a máscara é testada contra uma coordenada que não é aquela.
 */
export function outputToFrame(surface: Surface, p: Vec2): Vec2 | null {
  const { inverse } = transformsFor(surface);
  if (!inverse) return null;
  const framePoint = apply(inverse, p);
  if (!framePoint) return null;
  return surface.warp ? unwarp(surface.warp, framePoint) : framePoint;
}

/** Onde um ponto de controle está na tela. */
export function warpPointToScreen(surface: Surface, index: number): Vec2 | null {
  const point = surface.warp?.points[index];
  if (!point) return null;
  const output = frameToOutput(surface, point.x, point.y);
  return output ? toScreen(output) : null;
}

/** Um ponto da tela em espaço do frame, sem passar pela malha — é assim que se
 *  arrasta um ponto de controle, que vive antes da deformação. */
export function screenToFramePoint(surface: Surface, screen: Vec2): Vec2 | null {
  const { inverse } = transformsFor(surface);
  return inverse ? apply(inverse, toOutput(screen)) : null;
}

/**
 * Um pixel de saída expresso em unidades do espaço do frame.
 *
 * As setas prometem "1 px" — mas um ponto de malha vive em 0..1 dentro do
 * frame, então o passo depende de quão grande a superfície é na tela. Sem esta
 * conversão, a mesma tecla moveria muito num quad grande e quase nada num
 * pequeno.
 */
export function framePixelStep(surface: Surface): Vec2 {
  const [tl, tr, br, bl] = surface.frame;
  const width = (Math.hypot(tr.x - tl.x, tr.y - tl.y) + Math.hypot(br.x - bl.x, br.y - bl.y)) / 2;
  const height = (Math.hypot(bl.x - tl.x, bl.y - tl.y) + Math.hypot(br.x - tr.x, br.y - tr.y)) / 2;
  return { x: width > 0 ? 1 / width : 0, y: height > 0 ? 1 / height : 0 };
}

/** Onde a linha da malha passa, para desenhar a grade por cima do canvas. */
export function warpGridPath(surface: Surface, samples = 12): string[] {
  const warp = surface.warp;
  if (!warp) return [];
  const paths: string[] = [];
  const line = (points: Vec2[]): string =>
    points
      .map((p, i) => {
        const output = frameToOutput(surface, p.x, p.y);
        if (!output) return '';
        const s = toScreen(output);
        return `${i === 0 ? 'M' : 'L'}${s.x.toFixed(1)},${s.y.toFixed(1)}`;
      })
      .join(' ');

  for (let row = 0; row <= warp.rows; row++) {
    const v = row / warp.rows;
    paths.push(line(Array.from({ length: samples + 1 }, (_, i) => evaluateWarp(warp, i / samples, v))));
  }
  for (let col = 0; col <= warp.cols; col++) {
    const u = col / warp.cols;
    paths.push(line(Array.from({ length: samples + 1 }, (_, i) => evaluateWarp(warp, u, i / samples))));
  }
  return paths.filter((p) => p.length > 0);
}

/** O âncora: a superfície que o inspetor edita e cujo canto as setas movem.
 *  Editar vale para uma, mover vale para todas — ver `selectedSurfaces`. */
export function selected(): Surface | null {
  const id = anchorId(store.view);
  return id ? store.project.surfaces.find((s) => s.id === id) ?? null : null;
}

/** Tudo que está selecionado, na ordem em que foi escolhido. */
export function selectedSurfaces(): Surface[] {
  const byId = new Map(store.project.surfaces.map((s) => [s.id, s]));
  return store.view.selectedIds.map((id) => byId.get(id)).filter((s): s is Surface => !!s);
}

/**
 * Cria uma superfície com nome no idioma da interface.
 *
 * O nome vai para o `project.json` e é dado do projeto, não cópia de interface —
 * por isso a engine inventa um nome em inglês e quem sabe a língua do usuário é
 * quem passa o nome de verdade. Renomear depois não desfaz nada disso.
 */
export function addSurface(): void {
  const number = store.project.surfaces.length + 1;
  store.addSurface(newSurface(store.project, t('surfaces.defaultName', { number })));
}

export function duplicateSelected(): void {
  const s = selected();
  if (s) store.duplicateSurface(s.id, t('surfaces.copyOf', { name: s.name }));
}

export function flash(message: string): void {
  session.status = message;
  setTimeout(() => { if (session.status === message) session.status = ''; }, 4000);
}
