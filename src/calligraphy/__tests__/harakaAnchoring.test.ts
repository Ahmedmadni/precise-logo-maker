import { describe, expect, it } from "vitest";
import {
  defaultCalligraphyGuides, glyphWorldBounds, placeAttachedHaraka,
  relayoutHarakat, remapMarksAfterRecomposition, snapGlyphToBaseline,
} from "../harakaAnchoring";
import { createHaraka, letteringSvg, type LetteringItem } from "../model";
import { buildSvgDocument } from "../../objects/export";
import type { DocumentState } from "../../store/studioStore";
import { parseProject, serializeProject } from "../../objects/project";

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
  it("stacks shadda nearest the glyph with fatha above it regardless of insertion order", () => {
    const g = glyph();
    const f = placeAttachedHaraka("fatha", g);
    const s = placeAttachedHaraka("shadda", g, [f]);
    const a = relayoutHarakat([g], [g, f, s]);
    const b = relayoutHarakat([g], [g, s, f]);
    const fa = a.find((item) => item.id === f.id)!;
    const sa = a.find((item) => item.id === s.id)!;
    const fb = b.find((item) => item.id === f.id)!;
    const sb = b.find((item) => item.id === s.id)!;
    expect(sa.stackOrder).toBe(0);
    expect(fa.stackOrder).toBe(1);
    expect(sa.y).toBeGreaterThan(fa.y);
    expect(sa.y).toBeCloseTo(sb.y);
    expect(fa.y).toBeCloseTo(fb.y);
    expect(sb.stackOrder).toBe(0);
  });

  it("keeps kasra below the baseline while shadda and damma stack above", () => {
    const g = glyph();
    const s = placeAttachedHaraka("shadda", g);
    const d = placeAttachedHaraka("damma", g, [s]);
    const k = placeAttachedHaraka("kasra", g);
    const arranged = relayoutHarakat([g], [g, k, d, s]);
    const shadda = arranged.find((item) => item.id === s.id)!;
    const damma = arranged.find((item) => item.id === d.id)!;
    const kasra = arranged.find((item) => item.id === k.id)!;
    expect(shadda.stackOrder).toBe(0);
    expect(damma.stackOrder).toBe(1);
    expect(kasra.stackOrder).toBe(0);
    expect(shadda.y).toBeGreaterThan(damma.y);
    expect(kasra.y).toBeGreaterThan(g.y);
  });

  it("never rearranges manually positioned diacritic marks", () => {
    const g = glyph();
    const mark = { ...placeAttachedHaraka("shadda", g),
      x: 140, y: 20, anchorMode: "manual" as const };
    const fatha = placeAttachedHaraka("fatha", g);
    const positioned = relayoutHarakat([g, mark, fatha], [g, mark, fatha]);
    const retained = positioned.find((x) => x.id === mark.id)!;
    expect(retained.x).toBe(140);
    expect(retained.y).toBe(20);
    expect(positioned.find((x) => x.id === fatha.id)?.stackOrder).toBe(0);
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

describe("baseline snapping and editable local projects", () => {
  it("snaps a close glyph to a visible guideline only when enabled", () => {
    const guide = { ...defaultCalligraphyGuides(600), snapEnabled: true };
    const close = glyph("g1", 200, 307);
    const snapped = snapGlyphToBaseline(close, guide);
    expect(snapped.y).toBe(300);
    expect(snapped.baselineOffset).toBe(-7);
    expect(snapGlyphToBaseline(glyph("g1", 200, 350), guide).y).toBe(350);
    expect(snapGlyphToBaseline(close, { ...guide, snapEnabled: false })).toEqual(close);
  });
  it("round-trips links and calligraphy baseline settings through .logo documents", () => {
    const g = glyph();
    const m = placeAttachedHaraka("fatha", g);
    const doc: DocumentState = {
      artboard: { width: 800, height: 600, unit: "px", background: "#ffffff" },
      grids: [], objects: [], lettering: [g, m],
      calligraphyGuides: { ...defaultCalligraphyGuides(600), visible: true, snapEnabled: true },
    };
    const restored = parseProject(serializeProject(doc));
    expect(restored?.lettering?.[1]?.attachedToGlyphId).toBe(g.id);
    expect(restored?.calligraphyGuides?.snapEnabled).toBe(true);
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
