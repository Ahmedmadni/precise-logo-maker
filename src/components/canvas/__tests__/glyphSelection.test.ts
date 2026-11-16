import { describe, expect, it } from "vitest";
import { createLettering, type LetteringItem } from "../../../calligraphy/model";
import { outlineNodes } from "../../../calligraphy/pathEditor";
import { chooseOverlappingGlyph, uniqueGlyphStack, visibleBezierNodes } from "../glyphSelection";

const glyph: LetteringItem = {
  ...createLettering(100, 180), kind: "outline",
  size: 100, unitsPerEm: 1000, pathData: "M0 0 C2 4 5 4 7 0 L9 0 Z",
};
describe("precise selection of overlapping Arabic glyphs", () => {
  it("cycles only on repeat taps over the same ordered stack and near the same point", () => {
    const ids = ["top", "middle", "bottom"];
    const p = { x: 85, y: 60 };
    const first = chooseOverlappingGlyph(ids, p, 1000, null)!;
    const next = chooseOverlappingGlyph(ids, { x: 89, y: 61 }, 1500, first)!;
    const last = chooseOverlappingGlyph(ids, p, 1750, next)!;
    expect([first.index, next.index, last.index]).toEqual([0, 1, 2]);
    expect(chooseOverlappingGlyph(ids, p, 2100, last)?.index).toBe(0);
    expect(chooseOverlappingGlyph(ids, { x: 140, y: 60 }, 1900, next)?.index).toBe(0);
    expect(chooseOverlappingGlyph(ids, p, 4000, next)?.index).toBe(0);
    expect(chooseOverlappingGlyph(["different"], p, 1700, next)?.index).toBe(0);
    expect(chooseOverlappingGlyph([], p, 1700, next)).toBeNull();
  });
  it("deduplicates nested SVG paths and rejects obsolete IDs", () => {
    expect(uniqueGlyphStack(["top", "top", "", "hidden", "bottom", "bottom"],
      new Set(["top", "bottom"]))).toEqual(["top", "bottom"]);
  });
});

describe("readable Bézier anchor overlays", () => {
  it("hides remote control points until a node is selected", () => {
    const nodes = outlineNodes(glyph.pathData!);
    const compact = visibleBezierNodes(nodes, null, glyph, 1);
    expect(compact.some((p) => p.role === "control")).toBe(false);
    expect(compact.length).toBeLessThan(nodes.length);
    const expanded = visibleBezierNodes(nodes, 3, glyph, 1);
    expect(expanded.some((p) => p.id === 3)).toBe(true);
    expect(expanded.some((p) => p.id === 2)).toBe(true);
    expect(visibleBezierNodes(nodes, null, glyph, 1, true)).toHaveLength(nodes.length);
  });
  it("always reveals selected node and makes it the topmost hit target", () => {
    const nodes = outlineNodes(glyph.pathData!);
    const visible = visibleBezierNodes(nodes, 1, glyph, 0.2);
    expect(visible.at(-1)?.id).toBe(1);
    expect(visible.some((p) => p.id === 1)).toBe(true);
  });
});
