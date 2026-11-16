import type { LetteringItem } from "./model";
import { worldJoinAnchor, type JoinSide } from "./contourComposer";

/**
 * A deliberately separate, editable filled ribbon connecting two existing SVG
 * glyph anchors. It remains live if either glyph moves. This is NOT font
 * shaping, C2 joining, or an automatic continuation of a calligrapher's nib.
 */
export interface RibbonLink {
  sourceGlyphId: string;
  targetGlyphId: string;
  sourceSide: JoinSide;
  targetSide: JoinSide;
  startWidth: number;
  endWidth: number;
  tension: number;
  curvature: number;
  /** Tangent angles in degrees relative to the source-to-target chord. */
  startAngle?: number;
  endAngle?: number;
  /** +1 shifts thickness change earlier; -1 delays it toward the end. */
  widthEase?: number;
}

export const DEFAULT_RIBBON = {
  startWidth: 12,
  endWidth: 12,
  tension: 0.34,
  curvature: 0,
  startAngle: 0,
  endAngle: 0,
  widthEase: 0,
} as const;

const fmt = (n: number) => Number(n.toFixed(3)).toString();
const coords = (p: { x: number; y: number }) => `${fmt(p.x)} ${fmt(p.y)}`;
const finite = (...n: number[]) => n.every(Number.isFinite);

export function isValidRibbon(link: RibbonLink): boolean {
  return !!link.sourceGlyphId && !!link.targetGlyphId &&
    link.sourceGlyphId !== link.targetGlyphId &&
    (link.sourceSide === "entry" || link.sourceSide === "exit") &&
    (link.targetSide === "entry" || link.targetSide === "exit") &&
    finite(link.startWidth, link.endWidth, link.tension, link.curvature,
      link.startAngle ?? 0, link.endAngle ?? 0, link.widthEase ?? 0) &&
    Math.abs(link.startAngle ?? 0) <= 70 &&
    Math.abs(link.endAngle ?? 0) <= 70 &&
    Math.abs(link.widthEase ?? 0) <= 1 &&
    link.startWidth >= 0.8 && link.startWidth <= 150 &&
    link.endWidth >= 0.8 && link.endWidth <= 150 &&
    link.tension >= 0.05 && link.tension <= 0.7 &&
    link.curvature >= -0.5 && link.curvature <= 0.5;
}

export function createRibbonLink(
  source: LetteringItem, target: LetteringItem,
  sourceSide: JoinSide = "exit", targetSide: JoinSide = "entry",
): LetteringItem | null {
  if (source.kind !== "outline" || target.kind !== "outline" || source.id === target.id) return null;
  const link: RibbonLink = {
    sourceGlyphId: source.id, targetGlyphId: target.id, sourceSide, targetSide,
    ...DEFAULT_RIBBON,
    startWidth: Math.max(3, Math.min(60, source.size * 0.11)),
    endWidth: Math.max(3, Math.min(60, target.size * 0.11)),
  };
  const item: LetteringItem = {
    id: `ribbon-${crypto.randomUUID()}`, kind: "bridge",
    x: 0, y: 0, size: 1000, color: source.color, rotation: 0, ribbon: link,
    sourceText: source.sourceText ?? "وصلة",
  };
  return buildRibbonPath(item, [source, target]) ? item : null;
}

/**
 * Construct a smooth variable-width ribbon from a centerline. The centerline
 * uses end tangents aligned to independently editable angles. The curvature
 * adds a symmetric bulge with *zero* derivative at both ends, preserving
 * the chosen entry/exit tangent directions.
 *
 * Its edges are sampled and interpolated with C1-continuous cubic Bézier
 * segments (Catmull-Rom handles), rather than applying a constant normal
 * to an entire Bézier half. Every exported point is a genuine SVG vector.
 * This is still a geometric ribbon: not automatic contour welding and not
 * a calligraphic pen-nib simulator.
 */
export interface RibbonSample {
  t: number;
  center: { x: number; y: number };
  normal: { x: number; y: number };
  width: number;
}
const add = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  ({ x: a.x + b.x, y: a.y + b.y });
const minus = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  ({ x: a.x - b.x, y: a.y - b.y });
const mul = (p: { x: number; y: number }, n: number) =>
  ({ x: p.x * n, y: p.y * n });
/** Continuous position and smoothly interpolated width at every sample. */
export function sampleRibbon(
  item: LetteringItem, all: LetteringItem[], steps = 16,
): RibbonSample[] | null {
  if (item.kind !== "bridge" || !item.ribbon || !isValidRibbon(item.ribbon) ||
      !Number.isInteger(steps) || steps < 4 || steps > 64) return null;
  const spec = item.ribbon;
  const start = all.find((s) => s.id === spec.sourceGlyphId && s.kind === "outline");
  const end = all.find((s) => s.id === spec.targetGlyphId && s.kind === "outline");
  if (!start || !end) return null;
  const p0 = worldJoinAnchor(start, spec.sourceSide);
  const p3 = worldJoinAnchor(end, spec.targetSide);
  if (!p0 || !p3 || !finite(p0.x, p0.y, p3.x, p3.y)) return null;
  const delta = minus(p3, p0);
  const dist = Math.hypot(delta.x, delta.y);
  if (dist < 2 || dist > 20_000) return null;
  const forward = mul(delta, 1 / dist);
  const perpendicular = { x: -forward.y, y: forward.x };
  const angleToVector = (degrees: number) => {
    const radians = degrees * Math.PI / 180;
    return add(mul(forward, Math.cos(radians)), mul(perpendicular, Math.sin(radians)));
  };
  const tangent0 = angleToVector(spec.startAngle ?? 0);
  const tangent1 = angleToVector(spec.endAngle ?? 0);
  const handle = dist * spec.tension;
  const c1 = add(p0, mul(tangent0, handle));
  const c2 = minus(p3, mul(tangent1, handle));
  const bumpAmount = dist * spec.curvature;
  const easingBias = spec.widthEase ?? 0;
  const result: RibbonSample[] = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const s = 1 - t;
    const point = add(add(
      mul(p0, s * s * s), mul(c1, 3 * s * s * t)),
      add(mul(c2, 3 * s * t * t), mul(p3, t * t * t)));
    const tangent = add(add(
      mul(minus(c1, p0), 3 * s * s),
      mul(minus(c2, c1), 6 * s * t)),
      mul(minus(p3, c2), 3 * t * t));
    // 16*t²*(1-t)²: peak 1 at t=.5, zero first derivative at t=0 and 1.
    const bell = 16 * t * t * s * s;
    const bellSlope = 32 * t * s * (1 - 2 * t);
    const center = add(point, mul(perpendicular, bumpAmount * bell));
    const derivative = add(tangent, mul(perpendicular, bumpAmount * bellSlope));
    const length = Math.hypot(derivative.x, derivative.y);
    if (length < 1e-8 || !finite(length, center.x, center.y)) return null;
    const normal = { x: -derivative.y / length, y: derivative.x / length };
    const smooth = t * t * (3 - 2 * t);
    const adjusted = smooth + easingBias * smooth * (1 - smooth);
    const width = spec.startWidth + (spec.endWidth - spec.startWidth) * adjusted;
    result.push({ t, center, normal, width });
  }
  return result;
}

/** Trace a smooth interpolating cubic through edge samples, with shared
 * derivatives at every interior point. The end width is independently set. */
const cubicEdge = (points: { x: number; y: number }[]) => {
  let d = "";
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;
    const handleOut = add(p1, mul(minus(p2, p0), 1 / 6));
    const handleIn = minus(p2, mul(minus(p3, p1), 1 / 6));
    d += ` C ${coords(handleOut)} ${coords(handleIn)} ${coords(p2)}`;
  }
  return d;
};

export function buildRibbonPath(item: LetteringItem, all: LetteringItem[]): string | null {
  const samples = sampleRibbon(item, all);
  if (!samples) return null;
  const edge = (side: 1 | -1) => samples.map(({ center, normal, width }) =>
    add(center, mul(normal, side * width / 2)));
  const left = edge(1), right = edge(-1).reverse();
  const d = `M ${coords(left[0]!)}${cubicEdge(left)} L ${coords(right[0]!)}${cubicEdge(right)} Z`;
  return d.length < 500_000 && !d.includes("NaN") && !d.includes("Infinity") ? d : null;
}

/** Remove orphan links, and automatically retarget a linked glyph if a
 * font substitution replaces all glyph IDs in a shaped word. */
export function remapRibbons(
  previous: LetteringItem[], current: LetteringItem[],
  replacedGroupId: string,
): LetteringItem[] {
  const priorGlyphs = previous.filter((g) => g.groupId === replacedGroupId && g.kind === "outline");
  const newGlyphs = current.filter((g) => g.groupId === replacedGroupId && g.kind === "outline");
  const ranks = new Map(priorGlyphs.map((g, i) => [g.id, i]));
  const existing = new Set(current.filter((i) => i.kind === "outline").map((i) => i.id));
  const nearest = (id: string) => {
    const rank = ranks.get(id);
    if (rank === undefined) return id;
    const mapped = newGlyphs.length > 0 ? newGlyphs[Math.round(rank * (newGlyphs.length - 1) / Math.max(1, priorGlyphs.length - 1))] : undefined;
    return mapped?.id ?? "";
  };
  return current.map((item) => {
    if (item.kind !== "bridge" || !item.ribbon) return item;
    const sourceGlyphId = nearest(item.ribbon.sourceGlyphId);
    const targetGlyphId = nearest(item.ribbon.targetGlyphId);
    if (!existing.has(sourceGlyphId) || !existing.has(targetGlyphId) || sourceGlyphId === targetGlyphId) return null;
    return { ...item, ribbon: { ...item.ribbon, sourceGlyphId, targetGlyphId } };
  }).filter((item): item is LetteringItem => item !== null);
}
