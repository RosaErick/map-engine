import type { Vec2 } from '../../engine/index.ts';

export interface DragParams {
  onStart?: (p: Vec2, e: PointerEvent) => void;
  /**
   * Deixa passar o gesto de reenquadrar em vez de agarrar o ponteiro.
   *
   * Ligado só no corpo da superfície, nunca numa alça: Ctrl segurado durante um
   * arrasto de canto desliga o ímã, e essa é a tecla de ajuste fino mais usada
   * que existe. Reenquadrar disputa com mover a superfície inteira, que é gesto
   * grosso — não com o de 1 px.
   */
  reframable?: boolean;
  onMove: (p: Vec2, delta: Vec2, e: PointerEvent) => void;
  onEnd?: () => void;
  /** Skip the gesture entirely — used for locked surfaces. */
  disabled?: boolean;
  button?: number;
}

/**
 * Pointer dragging as a Svelte action.
 *
 * All the imperative pointer bookkeeping — capture, deltas, cleanup — lives
 * here instead of in component markup. Pointer handlers talking to a canvas are
 * where most editor bugs are born; keeping them out of the reactive update
 * cycle is the whole point.
 *
 * Coordinates are relative to the element the action is attached to (or its
 * offsetParent for SVG children), which is the stage.
 */
export function drag(node: Element, params: DragParams) {
  let current = params;
  let last: Vec2 | null = null;

  function localPoint(e: PointerEvent): Vec2 {
    const host = (node as HTMLElement).closest('[data-stage]') ?? node;
    const r = host.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function onDown(e: PointerEvent): void {
    if (current.disabled) return;
    if (current.button !== undefined && e.button !== current.button) return;
    // Sem `stopPropagation`: quem trata é o `panZoom` do palco, uma camada acima.
    if (current.reframable && (e.button === 1 || (e.button === 0 && (e.altKey || e.ctrlKey)))) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    last = localPoint(e);
    current.onStart?.(last, e);
    node.addEventListener('pointermove', onMove as EventListener);
    node.addEventListener('pointerup', onUp as EventListener);
    node.addEventListener('pointercancel', onUp as EventListener);
  }

  function onMove(e: PointerEvent): void {
    if (!last) return;
    const p = localPoint(e);
    current.onMove(p, { x: p.x - last.x, y: p.y - last.y }, e);
    last = p;
  }

  function onUp(): void {
    last = null;
    current.onEnd?.();
    node.removeEventListener('pointermove', onMove as EventListener);
    node.removeEventListener('pointerup', onUp as EventListener);
    node.removeEventListener('pointercancel', onUp as EventListener);
  }

  node.addEventListener('pointerdown', onDown as EventListener);
  return {
    update(next: DragParams) { current = next; },
    destroy() {
      node.removeEventListener('pointerdown', onDown as EventListener);
      onUp();
    },
  };
}

export interface PanZoomParams {
  onPan: (delta: Vec2) => void;
  onZoom: (factor: number, at: Vec2) => void;
}

/** Wheel to zoom about the cursor, middle button or space+drag to pan. */
export function panZoom(node: HTMLElement, params: PanZoomParams) {
  let current = params;
  let panning = false;
  let last: Vec2 = { x: 0, y: 0 };

  function onWheel(e: WheelEvent): void {
    e.preventDefault();
    const r = node.getBoundingClientRect();
    // ~10% per notch, clamped so a trackpad's fine deltas still feel linear.
    const factor = Math.exp(-e.deltaY * 0.0015);
    current.onZoom(factor, { x: e.clientX - r.left, y: e.clientY - r.top });
  }

  function onDown(e: PointerEvent): void {
    // Botão do meio, Alt, ou Ctrl/Cmd: três caminhos para o mesmo gesto, porque
    // nem todo mouse tem botão do meio e nem todo teclado tem Alt livre. Ctrl é
    // o que a pessoa tenta primeiro quando a vista se perdeu.
    const reframing = e.button === 0 && (e.altKey || e.ctrlKey);
    if (e.button !== 1 && !reframing) return;
    e.preventDefault();
    panning = true;
    last = { x: e.clientX, y: e.clientY };
    node.setPointerCapture(e.pointerId);
  }

  function onMove(e: PointerEvent): void {
    if (!panning) return;
    current.onPan({ x: e.clientX - last.x, y: e.clientY - last.y });
    last = { x: e.clientX, y: e.clientY };
  }

  function onUp(): void { panning = false; }

  node.addEventListener('wheel', onWheel, { passive: false });
  node.addEventListener('pointerdown', onDown);
  node.addEventListener('pointermove', onMove);
  node.addEventListener('pointerup', onUp);
  node.addEventListener('pointercancel', onUp);

  return {
    update(next: PanZoomParams) { current = next; },
    destroy() {
      node.removeEventListener('wheel', onWheel);
      node.removeEventListener('pointerdown', onDown);
      node.removeEventListener('pointermove', onMove);
      node.removeEventListener('pointerup', onUp);
      node.removeEventListener('pointercancel', onUp);
    },
  };
}
