import type { LetteringItem } from "../../calligraphy/model";
import { ribbonHandleGeometry, type RibbonHandleId } from "../../calligraphy/ribbonHandles";

/**
 * Direct manipulation for a selected live ribbon. The three circles are
 * canvas-only controls and do not enter a project export.
 */
export function RibbonEditHandles({ item, glyphs, zoom }: {
  item: LetteringItem;
  glyphs: LetteringItem[];
  zoom: number;
}) {
  const geo = ribbonHandleGeometry(item, glyphs);
  if (!geo || !Number.isFinite(zoom) || zoom <= 0) return null;
  const keys = [
    { id: "start", point: geo.start, color: "#27c9b3", title: "اتجاه بداية الوصلة" },
    { id: "end", point: geo.end, color: "#e7ac56", title: "اتجاه نهاية الوصلة" },
    { id: "bend", point: geo.bend, color: "#7ca9ff", title: "انحناء الوصلة" },
  ] as const;
  return (
    <g aria-label="مقابض تحرير الوصلة" data-ribbon-edit-guide="true">
      <polyline points={geo.centerline.map((p) => p.x + "," + p.y).join(" ")}
        stroke="#95aabd" strokeOpacity={0.75} strokeDasharray={4 / zoom + " " + 4 / zoom}
        strokeWidth={1.4 / zoom} fill="none" pointerEvents="none" />
      <line x1={geo.startCap.x} y1={geo.startCap.y} x2={geo.start.x} y2={geo.start.y}
        stroke="#27c9b3" strokeWidth={1.5 / zoom} pointerEvents="none" />
      <line x1={geo.endCap.x} y1={geo.endCap.y} x2={geo.end.x} y2={geo.end.y}
        stroke="#e7ac56" strokeWidth={1.5 / zoom} pointerEvents="none" />
      {keys.map(({ id, point, color, title }) => (
        <g key={id} data-ribbon-handle={id} className="cursor-crosshair" aria-label={title}>
          <circle cx={point.x} cy={point.y} r={21 / zoom} stroke="none"
            fill="transparent" pointerEvents="all" />
          <circle cx={point.x} cy={point.y} r={8 / zoom} fill={color}
            stroke="#15212b" strokeWidth={2 / zoom} pointerEvents="none" />
        </g>
      ))}
    </g>
  );
}
