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
}

export const DEFAULT_RIBBON = {
  startWidth: 12,
  endWidth: 12,
  tension: 0.34,
  curvature: 0,
} as const;

const fmt = (n: number) => Number(n.toFixed(3)).toString();
const coords = (p: { x: number; y: number }) => `${fmt(p.x)} ${fmt(p.y)}`;
const finite = (...n: number[]) => n.every(Number.isFinite);

export function isValidRibbon(link: RibbonLink): boolean {
  return !!link.sourceGlyphId && !!link.targetGlyphId &&
    link.sourceGlyphId !== link.targetGlyphId &&
    (link.sourceSide === "entry" || link.sourceSide === "exit") &&
    (link.targetSide === "entry" || link.targetSide === "exit") &&
    finite(link.startWidth, link.endWidth, link.tension, link.curvature) &&
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
 * Build a closed SVG outline in ARTBOARD pixel coordinates, with no reliance
 * on strokes or runtime SVG filters. Start/end widths may differ. Tangent
 * directions are approximate geometry rather than measured Arabic nib angles.
 */
export function buildRibbonPath(item: LetteringItem, all: LetteringItem[]): string | null {
  if (item.kind !== "bridge" || !item.ribbon || !isValidRibbon(item.ribbon)) return null;
  const spec = item.ribbon;
  const start = all.find((s) => s.id === spec.sourceGlyphId && s.kind === "outline");
  const end = all.find((s) => s.id === spec.targetGlyphId && s.kind === "outline");
  if (!start || !end) return null;
  const p0 = worldJoinAnchor(start, spec.sourceSide);
  const p3 = worldJoinAnchor(end, spec.targetSide);
  if (!p0 || !p3 || !finite(p0.x, p0.y, p3.x, p3.y)) return null;
  const dx = p3.x - p0.x, dy = p3.y - p0.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 2 || dist > 20_000) return null;
  const ux = dx / dist, uy = dy / dist;
  const nx = -uy, ny = ux;
  const bend = dist * spec.curvature;
  const handle = dist * spec.tension;
  const c1 = { x: p0.x + ux * handle + nx * bend, y: p0.y + uy * handle + ny * bend };
  const c2 = { x: p3.x - ux * handle + nx * bend, y: p3.y - uy * handle + ny * bend };
  const norm = (x: number, y: number) => {
    const d = Math.hypot(x, y) || 1;
    return { x: -y / d, y: x / d };
  };
  const startNormal = norm(c1.x - p0.x, c1.y - p0.y);
  const endNormal = norm(p3.x - c2.x, p3.y - c2.y);
  const add = (p: { x: number; y: number }, n: { x: number; y: number }, w: number, side: number) =>
    ({ x: p.x + n.x * w * side / 2, y: p.y + n.y * w * side / 2 });
  const a0 = add(p0, startNormal, spec.startWidth, 1);
  const a1 = add(c1, startNormal, spec.startWidth, 1);
  const a2 = add(c2, endNormal, spec.endWidth, 1);
  const a3 = add(p3, endNormal, spec.endWidth, 1);
  const b3 = add(p3, endNormal, spec.endWidth, -1);
  const b2 = add(c2, endNormal, spec.endWidth, -1);
  const b1 = add(c1, startNormal, spec.startWidth, -1);
  const b0 = add(p0, startNormal, spec.startWidth, -1);
  const d = `M ${coords(a0)} C ${coords(a1)} ${coords(a2)} ${coords(a3)} L ${coords(b3)} C ${coords(b2)} ${coords(b1)} ${coords(b0)} Z`;
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
