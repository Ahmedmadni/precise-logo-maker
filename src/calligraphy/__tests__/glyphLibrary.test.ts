import { describe, expect, it } from "vitest";
import { createLettering, type LetteringItem } from "../model";
import {
  canReplaceWithLibraryEntry, combineGlyphLibrary, makeGlyphLibraryEntry,
  makeStandaloneLibraryGlyph, parseGlyphLibrary, serializeGlyphLibrary,
  validateGlyphLibraryEntry,
} from "../glyphLibrary";
import { parseProject, serializeProject } from "../../objects/project";
import { buildSvgDocument } from "../../objects/export";
import { useStudio, type DocumentState } from "../../store/studioStore";

const glyph = (id = "g1", word = "المدني", slot = 2): LetteringItem => ({
  ...createLettering(200, 160),
  id, kind: "outline", groupId: "word-abc", sourceText: word,
  glyphIndex: slot, fontGlyphId: 303, unitsPerEm: 1000, size: 200,
  pathData: "M0 0 L220 0 Q200 150 50 200 C10 125 0 40 0 0 Z",
  color: "#d1a95e",
});

const emptyDoc = (outlines: LetteringItem[]): DocumentState => ({
  artboard: { width: 800, height: 600, unit: "px", background: "#ffffff" },
  grids: [], objects: [], lettering: outlines, glyphLibrary: [],
});

describe("personal Arabic calligraphy glyph library", () => {
  it("saves authentic edited SVG path and semantic context without storing a font binary", () => {
    const letter = glyph();
    const created = makeGlyphLibraryEntry(letter, "ميم نهائية — معدلة")!;
    expect(created.name).toBe("ميم نهائية — معدلة");
    expect(created.pathData).toBe(letter.pathData);
    expect(created.unitsPerEm).toBe(letter.unitsPerEm);
    expect(created.sourceText).toBe("المدني");
    expect(created.glyphIndex).toBe(2);
    expect(created.sourceFont).toBe(letter.font);
    expect(validateGlyphLibraryEntry(created)).toBe(true);
  });

  it("serializes a portable library and reads it without changing the original artwork", () => {
    const saved = makeGlyphLibraryEntry(glyph(), "شكل مزخرف")!;
    const packed = serializeGlyphLibrary([saved])!;
    expect(packed).toContain("logo-studio-calligraphy-library");
    const restored = parseGlyphLibrary(packed)!;
    expect(restored).toEqual([saved]);
    const doc = emptyDoc([glyph()]);
    doc.glyphLibrary = restored;
    const roundtrip = parseProject(serializeProject(doc))!;
    expect(roundtrip.glyphLibrary?.[0]?.pathData).toBe(saved.pathData);
    expect(roundtrip.lettering?.[0]?.pathData).toBe(glyph().pathData);
    const exported = buildSvgDocument(roundtrip, { background: false });
    expect(exported).toContain("M0 0 L220 0");
    expect(exported).not.toContain("saved-glyph-");
    expect(exported).not.toContain(saved.name);
  });

  it("rejects foreign files, script tags, SVG arc commands and invalid outlines", () => {
    const good = makeGlyphLibraryEntry(glyph(), "سليم")!;
    expect(parseGlyphLibrary('{"format":"fake","version":1,"entries":[]}')).toBeNull();
    expect(parseGlyphLibrary("<svg onload=alert(1)>")).toBeNull();
    expect(parseGlyphLibrary(JSON.stringify({
      format: "logo-studio-calligraphy-library", version: 1,
      entries: [{ ...good, pathData: "<path onload=alert(1) />" }],
    }))).toBeNull();
    expect(validateGlyphLibraryEntry({ ...good, pathData: "M0 0 A50 50 0 0 1 100 20 Z" }))
      .toBe(false);
    expect(validateGlyphLibraryEntry({ ...good, pathData: "M0 0 L0 0" })).toBe(false);
    expect(parseGlyphLibrary("x".repeat(2_000_001))).toBeNull();
  });

  it("safely deduplicates imported entries, and handles an ID collision across projects", () => {
    const first = makeGlyphLibraryEntry(glyph(), "الأول")!;
    const second = makeGlyphLibraryEntry(glyph(), "النسخة")!;
    expect(combineGlyphLibrary([first], [second])).toHaveLength(1);
    const differentPath = { ...second, id: first.id,
      pathData: "M0 0 L100 0 L100 80 L0 80 Z" };
    const result = combineGlyphLibrary([first], [differentPath])!;
    expect(result).toHaveLength(2);
    expect(result[1]!.id).not.toBe(first.id);
    expect(result[1]!.pathData).toBe(differentPath.pathData);
  });

  it("protects Arabic joining by only replacing a matching word and shaped glyph slot", () => {
    const target = glyph("selected");
    const source = makeGlyphLibraryEntry(glyph("source"), "بديل")!;
    expect(canReplaceWithLibraryEntry(target, source)).toBe(true);
    expect(canReplaceWithLibraryEntry(glyph("different", "محمد"), source)).toBe(false);
    expect(canReplaceWithLibraryEntry(glyph("different", "المدني", 1), source)).toBe(false);
    expect(canReplaceWithLibraryEntry({ ...target, groupId: undefined }, source)).toBe(false);
    expect(canReplaceWithLibraryEntry({ ...target, hidden: true }, source)).toBe(false);
  });

  it("creates a fresh standalone editable vector item without pulling a word group into it", () => {
    const source = makeGlyphLibraryEntry(glyph(), "زخرفة شخصية")!;
    const independent = makeStandaloneLibraryGlyph(source, 450, 190, 120, "#123456")!;
    expect(independent.kind).toBe("outline");
    expect(independent.pathData).toBe(source.pathData);
    expect(independent.groupId).toBeUndefined();
    expect(independent.glyphIndex).toBeUndefined();
    expect(independent.fontGlyphId).toBeUndefined();
    expect(independent.size).toBe(120);
    expect(independent.color).toBe("#123456");
    expect(independent.id).not.toBe(source.id);
  });

  it("preserves undo/redo, exact word-slot identity and source mark links", () => {
    const snapshot = useStudio.getState();
    const letter = glyph();
    const mark: LetteringItem = {
      ...createLettering(240, 110), id: "mark-1", kind: "haraka",
      mark: "shadda", size: 32, attachedToGlyphId: letter.id, anchorMode: "manual",
    };
    try {
      useStudio.setState({ doc: emptyDoc([letter, mark]), past: [], future: [],
        selectedLetteringId: letter.id, letteringPreview: null });
      expect(useStudio.getState().saveGlyphVariant(letter.id, "الأصل").ok).toBe(true);
      const saved = useStudio.getState().doc.glyphLibrary?.[0]!;
      expect(saved.pathData).toBe(letter.pathData);
      const variant = { ...saved, id: "variant-2",
        pathData: "M0 0 C70 70 90 120 200 200 L0 200 Z" };
      expect(useStudio.getState().importGlyphVariants([variant]).ok).toBe(true);
      expect(useStudio.getState().applyGlyphVariant(variant.id, letter.id).ok).toBe(true);
      const changed = useStudio.getState().doc.lettering!;
      expect(changed.find((item) => item.id === letter.id)?.pathData).toBe(variant.pathData);
      expect(changed.find((item) => item.id === letter.id)?.fontGlyphId).toBeUndefined();
      expect(changed.find((item) => item.id === mark.id)?.attachedToGlyphId).toBe(letter.id);
      useStudio.getState().undo();
      expect(useStudio.getState().doc.lettering?.find((item) => item.id === letter.id)?.pathData)
        .toBe(letter.pathData);
      useStudio.getState().redo();
      expect(useStudio.getState().doc.lettering?.find((item) => item.id === letter.id)?.pathData)
        .toBe(variant.pathData);
      const beforeCount = useStudio.getState().doc.lettering!.length;
      expect(useStudio.getState().insertGlyphVariant(variant.id).ok).toBe(true);
      expect(useStudio.getState().doc.lettering).toHaveLength(beforeCount + 1);
    } finally {
      useStudio.setState({ doc: snapshot.doc, past: snapshot.past, future: snapshot.future,
        selectedLetteringId: snapshot.selectedLetteringId, letteringPreview: snapshot.letteringPreview });
    }
  });
});
