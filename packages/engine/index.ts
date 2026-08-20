/** Public API. Anything not re-exported here is an implementation detail. */
export { createEngine, Engine, type EngineOptions } from './engine.ts';
export { Store, visibleSurfaces, patternFor, type StoreState, type MutateOpts } from './store.ts';
export {
  emptyProject, newSurface, newId, parseProject, clamp, normalizeAngle,
  type Project, type Source, type SourceKind, type Surface, type Shape,
  type Fit, type Blend, type Vec2, type ViewState, type TestPattern,
} from './project.ts';
export {
  solveUnitToQuad, quadToUnit, invert, apply, applyH,
  type Mat3, type Quad,
} from './homography.ts';
export {
  identityWarp, isIdentity, evaluateWarp, unwarp, resampleWarp, tessellate, parseWarp, pointIndex,
  DEFAULT_CELLS, type Warp, type WarpCell, type WarpInterpolation,
} from './warp.ts';
export { triangulate, pointInPolygon, pointInUnitEllipse, closestOnSegment, bounds, signedArea, UNIT_QUAD } from './geometry.ts';
export { Renderer, IDENTITY_VIEW, type ViewTransform } from './renderer.ts';
export { frameToPixel, uvTransform, uvMatrix, isQuarterTurned, frameAspectOf, surfaceOrder } from './surface-math.ts';
export { SourcePool, createSource } from './sources/index.ts';
export { listCameras } from './sources/video.ts';
export type { TextureSource, SourceContext, CanvasModule, SourceError, SourceErrorCode } from './sources/types.ts';
