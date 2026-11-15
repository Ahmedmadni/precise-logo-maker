import type { LetteringItem } from "../../calligraphy/model";
import { letteringTransform } from "../../calligraphy/model";
import { outlineContours } from "../../calligraphy/contourComposer";

/** Hit-test complete SVG subpaths, without changing the exported artwork. */
export function GlyphContourOverlay({ item, index, zoom, overridePath }: {
  item: LetteringItem;
  index: number | null;
  zoom: number;
  overridePath?: string | undefined;
}) {
  const contours = outlineContours(overridePath ?? item.pathData ?? "");
  const s = item.size / (item.unitsPerEm || 1000);
  if (!Number.isFinite(s) || s <= 0) return null;
  return (
    <g transform={letteringTransform(item)} aria-label="مسارات الحرف القابلة للتحرير">
      {contours.map((c) => {
        const selected = c.index === index;
        return (
          <g data-contour-index={c.index} key={c.index} className="cursor-move">
            <path d={c.path} transform={`scale(${s} ${-s})`}
              stroke={selected ? "#22c5a9" : "transparent"}
              strokeWidth={(selected ? 2.5 : 20 / Math.max(0.02, zoom)) / s}
              fill="none" pointerEvents="stroke"
              strokeLinejoin="round" />
          </g>
        );
      })}
    </g>
  );
}
