/** Public API. Anything not re-exported here is an implementation detail. */
export { createEngine, Engine, type EngineOptions } from './engine.ts';
export { Store, visibleSurfaces, type StoreState, type MutateOpts } from './store.ts';
export {
  emptyProject, newSurface, newId, parseProject, clamp, normalizeAngle,
  type Project, type Source, type SourceKind, type Surface, type Shape,
  type Fit, type Blend, type Vec2, type ViewState, type TestPattern,
} from './project.ts';
export {
  solveUnitToQuad, quadToUnit, invert, apply, applyH,
  type Mat3, type Quad,
} from './homography.ts';
export { triangulate, pointInPolygon, bounds, signedArea, UNIT_QUAD } from './geometry.ts';
export { Renderer, IDENTITY_VIEW, frameToPixel, uvTransform, uvMatrix, isQuarterTurned, frameAspectOf, surfaceNumber, type ViewTransform } from './renderer.ts';
export { SourcePool, createSource } from './sources/index.ts';
export type { TextureSource, SourceContext, CanvasModule } from './sources/types.ts';
