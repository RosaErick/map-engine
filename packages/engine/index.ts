/** Public API. Anything not re-exported here is an implementation detail. */
export { createEngine, Engine, type EngineOptions } from './engine.ts';
export { Store, visibleSurfaces, patternFor, type StoreState, type MutateOpts } from './model/store.ts';
export {
  emptyProject, newSurface, newId, parseProject, clamp, normalizeAngle,
  type Project, type Source, type SourceKind, type Surface, type Shape,
  type Fit, type Blend, type Vec2, type ViewState, type TestPattern,
} from './model/project.ts';
export {
  solveUnitToQuad, quadToUnit, invert, apply, applyH,
  type Mat3, type Quad,
} from './math/homography.ts';
export {
  identityWarp, isIdentity, evaluateWarp, unwarp, resampleWarp, tessellate, parseWarp, pointIndex,
  DEFAULT_CELLS, type Warp, type WarpCell, type WarpInterpolation,
} from './model/warp.ts';
export { anchorId, expandSelection, DEFAULT_TEXT, TEXT_FAMILIES, TEXT_ALIGNS } from './model/project.ts';
export type { Cue, Scene, Timeline, TextStyle, TextFamily, TextAlign } from './model/project.ts';
export { presentationOf, currentScene, isFading } from './model/store.ts';
export { hexOf, parseHex, rgbToHsv, hsvToRgb, colorKey, type Rgb, type ColorKey } from './math/color.ts';
export { triangulate, pointInPolygon, pointInUnitEllipse, closestOnSegment, bounds, signedArea, UNIT_QUAD } from './math/geometry.ts';
export { Renderer, IDENTITY_VIEW, type ViewTransform } from './render/renderer.ts';
export { frameToPixel, uvTransform, uvMatrix, isQuarterTurned, frameAspectOf, surfaceOrder } from './model/surface-math.ts';
export { SourcePool, createSource } from './sources/index.ts';
export { listCameras } from './sources/video.ts';
export type { TextureSource, SourceContext, CanvasModule, SourceError, SourceErrorCode } from './sources/types.ts';
