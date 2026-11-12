import { outlineNodes, parseOutline } from "./pathEditor";
import type { LetteringItem } from "./model";

export type MorphDirection = "right" | "left" | "up" | "down";
type CoordinatePair = { x: number; y: number };
const round = (value: number): string => Number(value.toFixed(4)).toString();

/**
 * This operates on glyph outlines, not on Unicode letters or a visual CSS scale.
 * It preserves the original start of a stroke and gradually extends its far end.
 * All Bézier anchors and handles are warped together, so edits survive SVG export.
 */
export function morphOutline(
  d: string,
  direction: MorphDirection,
  amountInFontUnits: number,
): string | null {
  if (!Number.isFinite(amountInFontUnits) || Math.abs(amountInFontUnits) > 5000) return null;
  const segments = parseOutline(d);
  const nodes = outlineNodes(d);
  if (!segments || !nodes.length) return null;
  if (amountInFontUnits === 0) return d;
  const axis = direction === "left" || direction === "right" ? "x" : "y";
  const values = nodes.map((point) => point[axis]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  if (span < 0.01) return null;
  const atPositiveEnd = direction === "right" || direction === "up";
  const amount = Math.min(span * 1.5, Math.max(-span * 0.4, amountInFontUnits));
  let hasChange = false;
  const warped = segments.map((segment) => {
    if (segment.cmd === "Z") return "Z";
    const v = [...segment.values];
    for (let j = 0; j < v.length; j += 2) {
      const coordinate = v[j + (axis === "x" ? 0 : 1)]!;
      const t = (coordinate - min) / span;
      // Smooth easing keeps the joining/base region almost unchanged.
      const influence = atPositiveEnd ? t * t : (1 - t) * (1 - t);
      const delta = influence * amount * (atPositiveEnd ? 1 : -1);
      const index = j + (axis === "x" ? 0 : 1);
      v[index] = coordinate + delta;
      if (Math.abs(delta) > 0.00001) hasChange = true;
    }
    return segment.cmd + v.map(round).join(" ");
  }).join(" ");
  return hasChange ? warped : null;
}

/** Unit conversion lets the designer request an extension in canvas pixels. */
export function morphGlyphPixels(item: LetteringItem, direction: MorphDirection, pixels: number): string | null {
  if (item.kind !== "outline" || !item.pathData || !Number.isFinite(pixels)) return null;
  const axisScale = direction === "left" || direction === "right" ? item.scaleX ?? 1 : item.scaleY ?? 1;
  const ratio = item.size / (item.unitsPerEm || 1000);
  if (!Number.isFinite(ratio) || ratio <= 0 || Math.abs(axisScale) < 0.01) return null;
  const units = Math.max(-2000, Math.min(2000, pixels / (ratio * Math.abs(axisScale))));
  return morphOutline(item.pathData, direction, units);
}

export function letteringGroupBounds(items: LetteringItem[]): { x: number; y: number; width: number; height: number } | null {
  const points: CoordinatePair[] = [];
  for (const item of items) {
    if (item.kind !== "outline" || !item.pathData) continue;
    const nodes = outlineNodes(item.pathData);
    const s = item.size / (item.unitsPerEm || 1000);
    const angle = item.rotation * Math.PI / 180;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    for (const n of nodes) {
      const x = n.x * s * (item.scaleX ?? 1);
      const y = -n.y * s * (item.scaleY ?? 1);
      points.push({ x: item.x + x * cos - y * sin, y: item.y + x * sin + y * cos });
    }
  }
  if (!points.length) return null;
  const minX = Math.min(...points.map((p) => p.x)), maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y)), maxY = Math.max(...points.map((p) => p.y));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Keep a recomposed variant on exactly the same visual center as its predecessor. */
export function centerLetteringAt(items: LetteringItem[], target: CoordinatePair): LetteringItem[] {
  const bounds = letteringGroupBounds(items);
  if (!bounds) return items;
  const dx = target.x - (bounds.x + bounds.width / 2);
  const dy = target.y - (bounds.y + bounds.height / 2);
  return items.map((item) => ({ ...item, x: item.x + dx, y: item.y + dy }));
}
