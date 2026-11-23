import type { PathGeometry } from "../geometry/types";
import {
  thinBrushSamples, vectorBrushOutline,
  type BrushSample, type BrushSettings,
} from "./vectorBrush";

/**
 * A screen-sensitive budget for the transient brush preview only.
 * A zoomed-out canvas needs fewer vertices; closer inspection keeps more.
 * Never apply these limits to the saved brush path or to .logo exports.
 */
export function brushPreviewBudget(zoom: number): number {
  if (!Number.isFinite(zoom) || zoom <= 0) return 0;
  if (zoom < 1.5) return 384;
  if (zoom < 4) return 576;
  return 768;
}

/** Retains the first/last point and salient curvature/pressure peaks. */
export function brushPreviewSamples(
  samples: readonly BrushSample[], zoom: number,
): BrushSample[] {
  const budget = brushPreviewBudget(zoom);
  if (!budget) return [];
  if (samples.length <= budget) return [...samples];
  return thinBrushSamples(samples, budget, zoom);
}

/** A smaller, editable-looking SVG silhouette for live drawing.
 * The *complete* trace must still go through vectorBrushOutline at pointer-up.
 */
export function vectorBrushPreviewOutline(
  samples: readonly BrushSample[],
  settings: BrushSettings,
  zoom: number,
): PathGeometry | null {
  if (brushPreviewBudget(zoom) === 0) return null;
  return vectorBrushOutline(brushPreviewSamples(samples, zoom), settings);
}
