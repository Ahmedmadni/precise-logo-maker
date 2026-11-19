import type { BrushPreset, BrushSettings, BrushSample } from "../../core/tracing/vectorBrush";
import { vectorBrushOutline, DEFAULT_BRUSH } from "../../core/tracing/vectorBrush";
import { geometryToPathData } from "../../objects/render";

/**
 * Vector-only thumbnails use the same engine as exported SVG, so the icon is
 * an accurate example of the actual preset (not a generic brush icon).
 */
const swatch: BrushSample[] = [
  { x: 9, y: 38, pressure: 0.5 },
  { x: 24, y: 17, pressure: 0.55 },
  { x: 45, y: 37, pressure: 0.75 },
  { x: 65, y: 14, pressure: 0.9 },
  { x: 91, y: 27, pressure: 0.45 },
];

export function BrushPresetPreview({ preset, settings, className = "" }: {
  preset: BrushPreset;
  settings?: BrushSettings | undefined;
  className?: string | undefined;
}) {
  const shape = vectorBrushOutline(swatch, {
    ...(settings ?? DEFAULT_BRUSH),
    preset, size: 13, pressure: false, smoothing: 0.18,
  });
  return (
    <svg viewBox="0 0 102 54" aria-hidden="true" preserveAspectRatio="xMidYMid meet"
      className={"block h-10 w-full max-w-28 text-current " + className}>
      {shape && <path d={geometryToPathData(shape)} fill="currentColor" stroke="none" />}
    </svg>
  );
}
