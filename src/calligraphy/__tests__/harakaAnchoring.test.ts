import { describe, expect, it } from "vitest";
import {
  defaultCalligraphyGuides, glyphWorldBounds, placeAttachedHaraka,
  relayoutHarakat, remapMarksAfterRecomposition,
} from "../harakaAnchoring";
import { createHaraka, letteringSvg, type LetteringItem } from "../model";
import { buildSvgDocument } from "../../objects/export";
import type { DocumentState } from "../../store/studioStore";

const glyph = (id = "g1", x = 200, y = 300): LetteringItem => ({
  id, kind: "outline", x, y, size: 100, rotation: 0, color: "#aabbcc",
  pathData: "M0 0 L300 0 L300 400 L0 400 Z",
  unitsPerEm: 1000, groupId: "w1", glyphIndex: 0, sourceText: "محمد",
});

describe("intelligent Arabic diacritic attachment", () => {
  it("places fatha above the glyph, kasra below and stacks extra marks", () => {
    const g = glyph();
    const b = glyphWorldBounds(g)!;
    const fatha = placeAttachedHaraka("fatha", g);
    const shadda = placeAttachedHaraka("shadda", g, [fatha]);
    const kasra = placeAttachedHaraka("kasra", g);
    expect(fatha.attachedToGlyphId).toBe(g.id);
    expect(fatha.anchorMode).toBe("auto");
    expect(fatha.x).toBeCloseTo((b.minX + b.maxX) / 2);
    expect(fatha.y).toBeLessThan(b.minY);
    expect(shadda.y).toBeLessThan(fatha.y);
    expect(kasra.y).toBeGreaterThan(b.maxY);
    expect(letteringSvg(fatha)).toContain("<path");
  });
  it("moves an attached manual mark by the glyph delta and preserves local offset", () => {
    const original = glyph();
    const mark = { ...createHaraka("fatha", 250, 175), id: "mark1",
      attachedToGlyphId: original.id, anchorMode: "manual" as const };
    const next = relayoutHarakat([original, mark], [{ ...original, x: 255, y: 340 }, mark]);
    const followed = next[1]!;
    expect(followed.x).toBe(305);
    expect(followed.y).toBe(215);
    expect(followed.anchorMode).toBe("manual");
  });
  it("repositions auto marks after outline reshaping and leaves free marks unchanged", () => {
    const original = glyph();
    const mark = placeAttachedHaraka("damma", original);
    const free = createHaraka("kasra", 12, 34);
    const moved = { ...original, x: 500, y: 400, size: 150 };
    const result = relayoutHarakat([original, mark, free], [moved, mark, free]);
    expect(result[1]!.x).toBeGreaterThan(mark.x);
    expect(result[1]!.y).not.toBe(mark.y);
    expect(result[2]).toEqual(free);
  });
  it("remaps attachments to new glyph IDs when a word is recomposed", () => {
    const before = glyph("old");
    const mark = placeAttachedHaraka("fatha", before);
    const after = glyph("new", 260, 330);
    const next = remapMarksAfterRecomposition([before, mark], [after], "w1");
    expect(next.find((item) => item.id === mark.id)?.attachedToGlyphId).toBe("new");
    expect(next.some((item) => item.id === "old")).toBe(false);
  });
  it("preserves unattached marks when an owning glyph is deleted", () => {
    const oldGlyph = glyph();
    const mark = placeAttachedHaraka("fatha", oldGlyph);
    const next = relayoutHarakat([oldGlyph, mark], [mark]);
    expect(next[0]!.attachedToGlyphId).toBeUndefined();
    expect(next[0]!.anchorMode).toBe("manual");
  });
});

describe("guides never leak into printable output", () => {
  it("uses document-local baseline settings but exports only artwork", () => {
    const g = glyph();
    const mark = placeAttachedHaraka("shadda", g);
    const doc: DocumentState = {
      artboard: { width: 800, height: 600, unit: "px", background: "#ffffff" },
      grids: [], objects: [], lettering: [g, mark],
      calligraphyGuides: { ...defaultCalligraphyGuides(600), visible: true },
    };
    const svg = buildSvgDocument(doc, { background: false });
    expect(svg).toContain("<g ");
    expect(svg).toContain('d="');
    expect(svg).not.toContain("سطر الأساس");
    expect(svg).not.toContain("ascender");
    expect(svg).not.toContain("<line");
  });
});
