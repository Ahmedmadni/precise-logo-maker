import type { LetteringItem } from "./model";
import { parseOutline, glyphPointToWorld, worldToGlyphPoint } from "./pathEditor";
import { selectJoiningContour } from "./joinAnchorGeometry";

export type ContourRole = "unassigned" | "head" | "body" | "tail" | "join" | "dot" | "counter";
export type JoinSide = "entry" | "exit";
export interface GlyphAnchor { x: number; y: number; }
export interface GlyphContour {
  index: number;
  path: string;
  pointCount: number;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}
type OutlineSegment = NonNullable<ReturnType<typeof parseOutline>>[number];
const format = (n: number) => Number(n.toFixed(3)).toString();
const toD = (segments: OutlineSegment[]): string =>
  segments.map((s) => s.cmd + (s.values.length ? s.values.map(format).join(" ") : "")).join(" ");

/**
 * A glyph is decomposed ONLY at SVG subpath boundaries (M...Z).
 * Subpaths aren't automatically semantic Arabic head/body/tail parts.
 * Counters (holes) and dots may be independent contours.
 */
export function outlineContours(path: string): GlyphContour[] {
  const segments = parseOutline(path);
  if (!segments) return [];
  const groups: OutlineSegment[][] = [];
  let current: OutlineSegment[] = [];
  for (const segment of segments) {
    if (segment.cmd === "M" && current.length) {
      groups.push(current); current = [];
    }
    if (!current.length && segment.cmd !== "M") return [];
    current.push(segment);
  }
  if (current.length) groups.push(current);
  return groups.map((group, index) => {
    const values = group.flatMap((s) => s.values);
    const xs = values.filter((_, i) => i % 2 === 0);
    const ys = values.filter((_, i) => i % 2 === 1);
    return { index, path: toD(group), pointCount: values.length / 2,
      bounds: {
        minX: Math.min(...xs), minY: Math.min(...ys),
        maxX: Math.max(...xs), maxY: Math.max(...ys),
      },
    };
  });
}

/**
 * Translates ONE complete contour, including all quadratic/cubic Bézier handles.
 * Nothing is flattened/rasterized; SVG export uses this same updated path.
 * This can intentionally distort counter/dot placement. Caller must confirm.
 */
export function moveOutlineContour(path: string, index: number, dx: number, dy: number): string | null {
  if (!Number.isInteger(index) || index < 0 || !Number.isFinite(dx) || !Number.isFinite(dy)
    || Math.abs(dx) > 5000 || Math.abs(dy) > 5000) return null;
  const segments = parseOutline(path);
  if (!segments) return null;
  const groups: OutlineSegment[][] = [];
  let group: OutlineSegment[] = [];
  for (const segment of segments) {
    if (segment.cmd === "M" && group.length) { groups.push(group); group = []; }
    if (!group.length && segment.cmd !== "M") return null;
    group.push(segment);
  }
  if (group.length) groups.push(group);
  if (!groups[index]) return null;
  const changed = groups.flatMap((segmentsInGroup, i) => segmentsInGroup.map((s) => {
    if (i !== index || s.cmd === "Z") return s;
    return { ...s, values: s.values.map((v, n) => v + (n % 2 ? dy : dx)) } as OutlineSegment;
  }));
  const d = toD(changed);
  return d.length <= 500_000 ? d : null;
}

/** A geometric fallback, never a font-authored joining point.
 * Prefer user-labeled joining contours or the visually dominant body, and
 * place the marker on a sampled SVG boundary (not an empty bounding-box
 * midpoint or detached Arabic dot). Explicit manual anchors always win.
 */
export function suggestJoinAnchor(glyph: LetteringItem, side: JoinSide): GlyphAnchor | null {
  if (glyph.kind !== "outline" || !glyph.pathData) return null;
  const contours=outlineContours(glyph.pathData);
  const candidate=selectJoiningContour(contours,glyph.contourRoles,side);
  return candidate?.local ?? null;
}

export const getJoinAnchor = (glyph: LetteringItem, side: JoinSide) =>
  glyph.joinAnchors?.[side] ?? suggestJoinAnchor(glyph, side);

export function worldJoinAnchor(glyph: LetteringItem, side: JoinSide): GlyphAnchor | null {
  const point = getJoinAnchor(glyph, side);
  return point ? glyphPointToWorld(glyph, point.x, point.y) : null;
}

/** Return only a translation, never a fake Bézier path weld or a font reshape. */
export function alignGlyphJoin(
  moving: LetteringItem, movingSide: JoinSide,
  fixed: LetteringItem, fixedSide: JoinSide,
): { x: number; y: number } | null {
  if (moving.id === fixed.id || moving.kind !== "outline" || fixed.kind !== "outline") return null;
  const a = worldJoinAnchor(moving, movingSide);
  const b = worldJoinAnchor(fixed, fixedSide);
  if (!a || !b) return null;
  return { x: moving.x + b.x - a.x, y: moving.y + b.y - a.y };
}

/** Converts a dragged world-coordinate marker into a local font-unit anchor. */
export function positionJoinAnchor(glyph: LetteringItem, x: number, y: number): GlyphAnchor | null {
  if (glyph.kind !== "outline") return null;
  const point = worldToGlyphPoint(glyph, x, y);
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) ||
      Math.abs(point.x) > 100_000 || Math.abs(point.y) > 100_000) return null;
  return { x: Number(point.x.toFixed(3)), y: Number(point.y.toFixed(3)) };
}
