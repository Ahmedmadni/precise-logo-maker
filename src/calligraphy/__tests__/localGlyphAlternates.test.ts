import { describe, expect, it } from "vitest";
import { createLettering, type LetteringItem } from "../model";
import type { OpenTypeAlternate } from "../shaping";
import { findLocalGlyphAlternates } from "../localGlyphAlternates";

const makeGlyph = (slot: number, id: number, x: number): LetteringItem => ({
  ...createLettering(x, 120),
  id: "g" + slot,
  kind: "outline",
  groupId: "word-1",
  sourceText: "المدني",
  glyphIndex: slot,
  fontGlyphId: id,
  unitsPerEm: 1000,
  size: 180,
  pathData: `M0 0 L${id} 0 L10 10 Z`,
  color: "#aabbcc",
});
const original = [makeGlyph(0, 100, 20), makeGlyph(1, 101, 40), makeGlyph(2, 102, 70)];
const variant = (
  tag: string, glyphs: LetteringItem[],
  featureTags: string[] = [tag],
): OpenTypeAlternate => ({
  tag, label: tag, glyphs, featureTags, kind: "single",
});
const shifted = (items: LetteringItem[], x = 30, y = 15) =>
  items.map((g) => ({ ...g, x: g.x + x, y: g.y + y }));
const changeMiddle = (items: LetteringItem[], newId = 231) =>
  items.map((item) => item.glyphIndex === 1
    ? { ...item, fontGlyphId: newId,
      pathData: `M0 0 Q5 ${newId} 10 10 Z` }
    : item);

describe("local Arabic glyph alternatives from whole-word OpenType layouts", () => {
  it("accepts one genuinely changed slot when every neighboring glyph and relative position stays intact", () => {
    const candidate = variant("salt", shifted(changeMiddle(original)));
    const results = findLocalGlyphAlternates("g1", original, [candidate]);
    expect(results).toHaveLength(1);
    const [found] = results;
    expect(found!.fontGlyphId).toBe(231);
    expect(found!.tag).toBe("salt");
    expect(found!.pathData).toContain("Q5 231");
    expect(found!.previewGlyphs.map((g) => g.id)).toEqual(original.map((g) => g.id));
    expect(found!.previewGlyphs[0]!.pathData).toBe(original[0]!.pathData);
    expect(found!.previewGlyphs[2]!.pathData).toBe(original[2]!.pathData);
    expect(found!.previewGlyphs[1]!.x).toBe(original[1]!.x);
    expect(found!.previewGlyphs[1]!.y).toBe(original[1]!.y);
    expect(found!.previewGlyphs[1]!.groupId).toBe("word-1");
  });

  it("rejects variants changing a neighbor or requiring re-spacing of a connected word", () => {
    const changedNeighbor = changeMiddle(original).map((g) =>
      g.glyphIndex === 0 ? { ...g, fontGlyphId: 555 } : g);
    const adjustedLayout = changeMiddle(original).map((g) =>
      g.glyphIndex === 2 ? { ...g, x: g.x + 4 } : g);
    const changedChosenPosition = changeMiddle(original).map((g) =>
      g.glyphIndex === 1 ? { ...g, y: g.y + 5 } : g);
    expect(findLocalGlyphAlternates("g1", original, [
      variant("salt", changedNeighbor),
      variant("ss01", adjustedLayout),
      variant("swsh", changedChosenPosition),
    ])).toHaveLength(0);
  });

  it("rejects ligature substitutions with different slot counts or slots", () => {
    expect(findLocalGlyphAlternates("g1", original, [
      variant("liga", changeMiddle(original).slice(0, 2)),
      variant("salt", changeMiddle(original).map((g) =>
        g.glyphIndex === 0 ? { ...g, glyphIndex: 1 } : g)),
    ])).toHaveLength(0);
  });

  it("only applies to the selected glyph ID, not an entire Unicode codepoint", () => {
    const choices = [variant("salt", changeMiddle(original))];
    expect(findLocalGlyphAlternates("g2", original, choices)).toHaveLength(0);
    expect(findLocalGlyphAlternates("missing", original, choices)).toHaveLength(0);
  });

  it("keeps distinct font-drawn shapes but removes duplicates from multiple features", () => {
    const candidates = [
      variant("salt", changeMiddle(original)),
      variant("ss01", changeMiddle(original)),
      variant("cv01", changeMiddle(original, 900)),
    ];
    const result = findLocalGlyphAlternates("g1", original, candidates);
    expect(result).toHaveLength(2);
    expect(result.map((x) => x.tag)).toEqual(["salt", "cv01"]);
  });

  it("supports genuinely different one-glyph ligature variants in isolation", () => {
    const one = [makeGlyph(0, 125, 30)];
    const choice = variant("swsh", [{ ...one[0]!, fontGlyphId: 200,
      pathData: "M0 0 C4 3 5 9 12 14 Z" }]);
    const output = findLocalGlyphAlternates("g0", one, [choice]);
    expect(output).toHaveLength(1);
    expect(output[0]!.previewGlyphs[0]!.x).toBe(one[0]!.x);
  });

  it("does not offer a fake local substitute based only on a manual path modification", () => {
    const sameIdButDifferentOutline = original.map((g) =>
      g.glyphIndex === 1 ? { ...g, pathData: "M1 2 L3 4 Z" } : g);
    expect(findLocalGlyphAlternates("g1", original, [
      variant("default", sameIdButDifferentOutline, []),
    ])).toHaveLength(0);
  });
});
