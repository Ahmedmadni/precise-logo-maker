import type { LetteringItem } from "./model";
import { worldJoinAnchor, type GlyphAnchor, type JoinSide } from "./contourComposer";

export interface JoinAnalysis {
  from: GlyphAnchor;
  to: GlyphAnchor;
  deltaX: number;
  deltaY: number;
  distance: number;
}

export interface JoinGuideSelection {
  sourceId: string;
  targetId: string;
  sourceSide: JoinSide;
  targetSide: JoinSide;
}

/**
 * Geometric measurements between two user-chosen outline anchors.
 * Distances use artboard units (usually px), not physical screen pixels.
 * This is a positioning guide, not an Arabic joining or stroke-smoothing engine.
 */
export function analyzeJoin(
  source: LetteringItem, sourceSide: JoinSide,
  target: LetteringItem, targetSide: JoinSide,
): JoinAnalysis | null {
  if (source.id === target.id || source.kind !== "outline" || target.kind !== "outline") return null;
  const from = worldJoinAnchor(source, sourceSide);
  const to = worldJoinAnchor(target, targetSide);
  if (!from || !to) return null;
  const deltaX = to.x - from.x, deltaY = to.y - from.y;
  if (![deltaX, deltaY].every(Number.isFinite)) return null;
  return { from, to, deltaX, deltaY, distance: Math.hypot(deltaX, deltaY) };
}

/** Align the selected glyph's anchor to the target, with optional deliberate
 * clearance between the anchors; geometry is translated, never warped. */
export function alignJoinWithClearance(
  source: LetteringItem, sourceSide: JoinSide,
  target: LetteringItem, targetSide: JoinSide,
  offsetX = 0, offsetY = 0,
): { x: number; y: number } | null {
  if (![offsetX, offsetY].every(Number.isFinite) || Math.abs(offsetX) > 200 || Math.abs(offsetY) > 200)
    return null;
  const analysis = analyzeJoin(source, sourceSide, target, targetSide);
  if (!analysis) return null;
  return { x: source.x + analysis.deltaX + offsetX,
    y: source.y + analysis.deltaY + offsetY };
}
