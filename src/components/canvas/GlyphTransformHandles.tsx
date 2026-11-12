import type { LetteringItem } from "../../calligraphy/model";
import { outlineNodes, glyphPointToWorld } from "../../calligraphy/pathEditor";

export type GlyphHandleAxis = "scaleX" | "scaleY" | "rotation";
export type GlyphHandleEdge = "right" | "left" | "top" | "bottom" | "rotate";
export interface GlyphHandle { edge: GlyphHandleEdge; x: number; y: number; axis: GlyphHandleAxis; side: number; }

/** Controls follow the outline's own rotated axes, not a misleading viewport rectangle. */
export function glyphTransformHandles(item: LetteringItem): GlyphHandle[] {
  if (item.kind !== "outline" || !item.pathData) return [];
  const nodes = outlineNodes(item.pathData);
  if (!nodes.length) return [];
  const xs = nodes.map((p) => p.x), ys = nodes.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const midX = (minX + maxX) / 2, midY = (minY + maxY) / 2;
  const fontOffset = Math.max(25, (item.unitsPerEm || 1000) * 24 / Math.max(20, item.size));
  const specs: { edge: GlyphHandleEdge; x: number; y: number; axis: GlyphHandleAxis; side: number }[] = [
    { edge: "right", x: maxX, y: midY, axis: "scaleX", side: 1 },
    { edge: "left", x: minX, y: midY, axis: "scaleX", side: -1 },
    { edge: "top", x: midX, y: maxY, axis: "scaleY", side: -1 },
    { edge: "bottom", x: midX, y: minY, axis: "scaleY", side: 1 },
    { edge: "rotate", x: midX, y: maxY + fontOffset, axis: "rotation", side: 1 },
  ];
  return specs.map((spec) => {
    const world = glyphPointToWorld(item, spec.x, spec.y);
    return { edge: spec.edge, x: world.x, y: world.y, axis: spec.axis, side: spec.side };
  });
}

/** Interactive on-canvas glyph handles are not rendered in exported SVG. */
export function GlyphTransformHandles({ item, zoom }: { item: LetteringItem; zoom: number }) {
  const handles = glyphTransformHandles(item);
  const top = handles.find((h) => h.edge === "top");
  const rotate = handles.find((h) => h.edge === "rotate");
  return (
    <g pointerEvents="all" aria-label="مقابض تحجيم الحرف وتدويره">
      {top && rotate && <path d={`M${top.x} ${top.y}L${rotate.x} ${rotate.y}`}
        stroke="#d9b76e" strokeWidth={1.5 / zoom} strokeDasharray={`${4 / zoom} ${4 / zoom}`} pointerEvents="none" />}
      {handles.map((handle) => (
        <g key={handle.edge} data-glyph-handle={handle.edge}
          className={handle.axis === "rotation" ? "cursor-grab" : "cursor-nwse-resize"}>
          <circle cx={handle.x} cy={handle.y} r={19 / zoom} fill="transparent"
            stroke="none" pointerEvents="all" />
          <circle cx={handle.x} cy={handle.y} r={6 / zoom}
            fill={handle.axis === "rotation" ? "#40bfbf" : "#d1a95e"}
            stroke="#111111" strokeWidth={1.5 / zoom} pointerEvents="none" />
        </g>
      ))}
    </g>
  );
}
