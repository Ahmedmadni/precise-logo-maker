import type { LetteringItem } from "./model";
import type { OpenTypeAlternate } from "./shaping";

/** One original, font-supplied glyph substitution for precisely one outlined
 * slot in a shaped Arabic word. The surrounding glyph IDs and relative
 * positions must stay stable; otherwise the safe operation is to recompose
 * the whole word, not transplant one isolated outline. */
export interface LocalGlyphAlternate {
  tag: string;
  label: string;
  featureTags: string[];
  pathData: string;
  fontGlyphId: number;
  previewGlyphs: LetteringItem[];
}

/** Compare the shaped run's RELATIVE glyph origins rather than absolute
 * coordinates. Whole-word variant previews are centered independently, so
 * an ordinary translation of the whole run is harmless. */
function compatibleLayout(
  originals: LetteringItem[],
  candidate: LetteringItem[],
  changedId: string,
): { original: LetteringItem; replacement: LetteringItem } | null {
  if (!originals.length || originals.length !== candidate.length ||
      originals.some((item) => item.kind !== "outline" ||
        item.glyphIndex === undefined) ||
      candidate.some((item) => item.kind !== "outline" ||
        item.glyphIndex === undefined)) return null;
  const bySlot = new Map<number, LetteringItem>();
  const candidates = new Map<number, LetteringItem>();
  for (const item of originals) {
    if (bySlot.has(item.glyphIndex!)) return null;
    bySlot.set(item.glyphIndex!, item);
  }
  for (const item of candidate) {
    if (candidates.has(item.glyphIndex!)) return null;
    candidates.set(item.glyphIndex!, item);
  }
  const selected = originals.find((item) => item.id === changedId);
  if (!selected || selected.glyphIndex === undefined) return null;
  const replacement = candidates.get(selected.glyphIndex);
  if (!replacement?.pathData || !Number.isFinite(replacement.fontGlyphId) ||
      replacement.fontGlyphId === selected.fontGlyphId ||
      replacement.unitsPerEm !== selected.unitsPerEm) return null;

  const order = [...bySlot.keys()].sort((a, b) => a - b);
  // Use a stable unaffected neighbor as the reference for layout positions.
  const anchorSlot = order.find((slot) => slot !== selected.glyphIndex);
  const currentAnchor = anchorSlot === undefined ? selected : bySlot.get(anchorSlot)!;
  const alternateAnchor = anchorSlot === undefined ? replacement : candidates.get(anchorSlot);
  if (!alternateAnchor) return null;
  const tolerance = Math.max(0.25, selected.size * 0.002);
  for (const slot of order) {
    const original = bySlot.get(slot)!;
    const proposed = candidates.get(slot);
    if (!proposed || !proposed.pathData ||
      proposed.size !== original.size ||
      proposed.unitsPerEm !== original.unitsPerEm) return null;
    if (slot !== selected.glyphIndex) {
      // The alternate must not change any neighboring font glyph.
      if (!Number.isFinite(original.fontGlyphId) ||
        proposed.fontGlyphId !== original.fontGlyphId) return null;
    }
    // If the OpenType feature shifts any glyph relative to the rest of the
    // run, it is NOT safe to apply to one part: use word-level re-shaping.
    const deltaX = (original.x - currentAnchor.x) -
      (proposed.x - alternateAnchor.x);
    const deltaY = (original.y - currentAnchor.y) -
      (proposed.y - alternateAnchor.y);
    if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY) ||
      Math.abs(deltaX) > tolerance || Math.abs(deltaY) > tolerance)
      return null;
  }
  return { original: selected, replacement };
}

/**
 * Extracts only authentic local substitutions found in whole-word OpenType
 * shaping. Does not infer an Arabic character from glyphIndex: glyph slots
 * can be ligatures or diacritics rather than one Unicode codepoint.
 */
export function findLocalGlyphAlternates(
  selectedId: string,
  originalWord: LetteringItem[],
  variants: OpenTypeAlternate[],
): LocalGlyphAlternate[] {
  const current = originalWord.filter((item) => item.kind === "outline");
  const found: LocalGlyphAlternate[] = [];
  const seen = new Set<string>();
  for (const variant of variants) {
    const match = compatibleLayout(current, variant.glyphs, selectedId);
    if (!match) continue;
    const { original, replacement } = match;
    const shapeKey = `${replacement.fontGlyphId}:${replacement.pathData}`;
    if (seen.has(shapeKey) || !replacement.pathData) continue;
    seen.add(shapeKey);
    const previewGlyphs = originalWord.map((item) =>
      item.id === selectedId
        ? { ...item, pathData: replacement.pathData!,
          fontGlyphId: replacement.fontGlyphId!,
          alternateFeature: variant.featureTags.join("+") || undefined }
        : item);
    found.push({
      tag: variant.tag,
      label: variant.label,
      featureTags: variant.featureTags,
      pathData: replacement.pathData,
      fontGlyphId: replacement.fontGlyphId!,
      previewGlyphs,
    });
  }
  return found;
}
