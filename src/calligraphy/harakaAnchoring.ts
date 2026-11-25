/**
 * Anchored Arabic diacritics. This does not infer grammatical tashkeel:
 * it places only the marks explicitly selected by the designer.
 * Auto marks follow the current glyph outline; manually moved marks keep
 * their relative displacement when their owning glyph is translated.
 */
import type { HarakaId, LetteringItem } from "./model";
import { createHaraka, HARAKAT } from "./model";
import { glyphPointToWorld, outlineNodes } from "./pathEditor";

export type MarkPlacement = "above" | "below";
const BELOW = new Set<HarakaId>(["kasra", "tanween-kasr", "hamza-below", "subscript-alif", "small-yeh"]);
const STACK_SHADDA = new Set<HarakaId>(["fatha", "tanween-fath"]);
export const isBelowMark = (mark: HarakaId): boolean => BELOW.has(mark);

export interface CalligraphyGuideSettings {
  visible: boolean;
  snapEnabled: boolean;
  baselineY: number;
  upperOffset: number;
  ascenderOffset: number;
  lowerOffset: number;
  descenderOffset: number;
}
export const defaultCalligraphyGuides = (height: number): CalligraphyGuideSettings => ({
  visible: false, snapEnabled: false, baselineY: height / 2,
  upperOffset: -210, ascenderOffset: -125, lowerOffset: 75, descenderOffset: 165,
});

export function glyphWorldBounds(glyph: LetteringItem):
{ minX: number; minY: number; maxX: number; maxY: number } | null {
  if (glyph.kind !== "outline" || !glyph.pathData) return null;
  const nodes = outlineNodes(glyph.pathData);
  if (!nodes.length) return null;
  const points = nodes.map((p) => glyphPointToWorld(glyph, p.x, p.y));
  return {
    minX: Math.min(...points.map((p) => p.x)),
    maxX: Math.max(...points.map((p) => p.x)),
    minY: Math.min(...points.map((p) => p.y)),
    maxY: Math.max(...points.map((p) => p.y)),
  };
}
const realSize = (item: LetteringItem) => Math.max(1, Math.min(250, item.size));
// SVG mark paths use a 100-unit square, centered at the item origin.
// Control-point bounds are conservative; rotated marks use a radial envelope.
function markVerticalExtent(item: LetteringItem): number {
  const path = item.markPathData || HARAKAT.find((mark) => mark.id === item.mark)?.path;
  const nodes = path ? outlineNodes(path) : [];
  const size = Math.max(1, Math.min(1000, item.size));
  if (!nodes.length) return size / 2;
  const sx = Math.abs(item.scaleX ?? 1), sy = Math.abs(item.scaleY ?? 1);
  const transformed = !!(item.rotation || item.skewX || item.skewY);
  if (transformed) return Math.max(...nodes.map((p) => Math.hypot((p.x - 50) * sx, (p.y - 50) * sy))) * size / 100;
  return Math.max(...nodes.map((p) => Math.abs(p.y - 50))) * sy * size / 100;
}
function smartMarkPosition(glyph: LetteringItem, mark: LetteringItem, tier: number, stackDistance?: number) {
  const bounds = glyphWorldBounds(glyph);
  if (!bounds) {
    const sign = mark.mark && isBelowMark(mark.mark) ? 1 : -1;
    return { x: glyph.x, y: glyph.y + sign * (glyph.size * 0.8 + (stackDistance ?? tier * realSize(mark) * 0.65)) };
  }
  const below = mark.mark && isBelowMark(mark.mark);
  const size = realSize(mark);
  const margin = Math.max(9, Math.min(30, glyph.size * 0.12));
  const gap = stackDistance ?? tier * size * 0.67;
  const clearance = markVerticalExtent(mark);
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: below ? bounds.maxY + margin + clearance + gap : bounds.minY - margin - clearance - gap,
  };
}

/**
 * Retain manually positioned marks and reanchor automatic marks after an
 * outline or position change. Auto placement is intentionally heuristic:
 * calligraphers can switch to manual mode for complex Thuluth compositions.
 */
export function relayoutHarakat(previous: LetteringItem[], current: LetteringItem[], preserveMarkPositions?: ReadonlySet<string>): LetteringItem[] {
  const before = new Map(previous.map((item) => [item.id, item]));
  const glyphs = new Map(current.filter((item) => item.kind === "outline").map((item) => [item.id, item]));
  // Arabic mark ordering must be independent of which toolbar button was
  // pressed first. Put the shadda closest to the outline, then its vowel
  // above it; below-base marks (kasra, tanween kasr) have a separate stack.
  // Manually positioned marks are deliberately not repositioned.
  const stacks = new Map<string, LetteringItem[]>();
  const originalOrder = new Map(current.map((item, i) => [item.id, i]));
  for (const item of current) {
    if (item.kind !== "haraka" || !item.attachedToGlyphId ||
      item.anchorMode === "manual" || !glyphs.has(item.attachedToGlyphId)) continue;
    const side = item.mark && isBelowMark(item.mark) ? "below" : "above";
    const key = item.attachedToGlyphId + ":" + side;
    const stack = stacks.get(key) ?? [];
    stack.push(item);
    stacks.set(key, stack);
  }
  const tiers = new Map<string, number>();
  const distances = new Map<string, number>();
  for (const stack of stacks.values()) {
    stack.sort((a, b) =>
      Number(b.mark === "shadda") - Number(a.mark === "shadda") ||
      (a.stackOrder ?? 0) - (b.stackOrder ?? 0) ||
      (originalOrder.get(a.id) ?? 0) - (originalOrder.get(b.id) ?? 0));
    let distance = 0;
    stack.forEach((mark, tier) => {
      if (tier > 0) distance += 2 * markVerticalExtent(stack[tier - 1]!) + 4;
      tiers.set(mark.id, tier);
      distances.set(mark.id, distance);
    });
  }
  const marks = [...current].map((item) => {
    if (item.kind !== "haraka" || !item.attachedToGlyphId || preserveMarkPositions?.has(item.id)) return item;
    const glyph = glyphs.get(item.attachedToGlyphId);
    if (!glyph) return { ...item, attachedToGlyphId: undefined, anchorMode: "manual" as const };
    const earlier = before.get(glyph.id);
    if (item.anchorMode === "manual") {
      if (!earlier) return item;
      const dx = glyph.x - earlier.x, dy = glyph.y - earlier.y;
      return dx || dy ? { ...item, x: item.x + dx, y: item.y + dy } : item;
    }
    const tier = tiers.get(item.id) ?? 0;
    const at = smartMarkPosition(glyph, item, tier, distances.get(item.id));
    return { ...item, ...at, stackOrder: tier };
  });
  return marks;
}

export function placeAttachedHaraka(
  mark: HarakaId, glyph: LetteringItem, existing: LetteringItem[] = [],
): LetteringItem {
  if (glyph.kind !== "outline") throw new Error("Attach marks only to outlined glyphs");
  const item = createHaraka(mark, glyph.x, glyph.y);
  item.color = glyph.color;
  item.attachedToGlyphId = glyph.id;
  item.anchorMode = "auto";
  item.stackOrder = existing.filter((s) => s.kind === "haraka" && s.attachedToGlyphId === glyph.id
    && !!s.mark && isBelowMark(s.mark) === isBelowMark(mark)).length;
  const at = smartMarkPosition(glyph, item, item.stackOrder);
  return { ...item, ...at };
}

export function mayStackShadda(mark: HarakaId, siblingMarks: LetteringItem[]): boolean {
  return STACK_SHADDA.has(mark) && siblingMarks.some((item) => item.mark === "shadda");
}

/** Keep artwork and diacritics linked when font substitution changes glyph IDs. */
export function remapMarksAfterRecomposition(
  oldItems: LetteringItem[], newGlyphs: LetteringItem[], oldGroupId: string,
): LetteringItem[] {
  const oldGlyphs = oldItems.filter((item) => item.kind === "outline" && item.groupId === oldGroupId);
  const newWord = newGlyphs.filter((item) => item.kind === "outline");
  const oldRank = new Map(oldGlyphs.map((glyph, i) => [glyph.id, i]));
  const updated = oldItems.filter((item) => item.groupId !== oldGroupId).map((item) => {
    if (item.kind !== "haraka" || !item.attachedToGlyphId) return item;
    const rank = oldRank.get(item.attachedToGlyphId);
    if (rank === undefined || !newWord.length) return item;
    const target = newWord[Math.min(newWord.length - 1, Math.round(rank * (newWord.length - 1) / Math.max(1, oldGlyphs.length - 1)))];
    return { ...item, attachedToGlyphId: target!.id };
  });
  const merged = [...updated, ...newGlyphs];
  return relayoutHarakat(oldItems, merged);
}

/** Magnetically align an outlined glyph origin to the baseline if enabled. */
export function snapGlyphToBaseline(
  item: LetteringItem, guides: CalligraphyGuideSettings | undefined, threshold = 12,
): LetteringItem {
  if (item.kind !== "outline" || !guides?.snapEnabled || !Number.isFinite(guides.baselineY)) return item;
  const delta = guides.baselineY - item.y;
  if (Math.abs(delta) > threshold) return item;
  return { ...item, y: guides.baselineY,
    baselineOffset: (item.baselineOffset ?? 0) + delta };
}
