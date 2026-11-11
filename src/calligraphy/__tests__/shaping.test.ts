import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { create } from "fontkit";
import { shapeArabicWithFont } from "../shaping";
import { letteringSvg } from "../model";

const amiriPath = resolve(process.cwd(), "node_modules/@fontsource/amiri/files/amiri-arabic-400-normal.woff");
const font = create(readFileSync(amiriPath));
const opts = {
  phrase: "سَلَام", font: "Amiri" as const, size: 200, x: 450, y: 500, color: "#d1a95e",
};

describe("real OpenType Arabic outlines", () => {
  it("shapes a full contextual word and stores standalone vector glyph paths", () => {
    const glyphs = shapeArabicWithFont(font, opts);
    expect(glyphs.length).toBeGreaterThan(2);
    expect(glyphs.every((g) => g.kind === "outline" && g.pathData && g.unitsPerEm)).toBe(true);
    expect(new Set(glyphs.map((g) => g.groupId)).size).toBe(1);
    for (const glyph of glyphs) {
      const svg = letteringSvg(glyph);
      expect(svg).toContain("<path");
      expect(svg).not.toContain("<text");
      expect(svg).not.toContain("<script");
    }
  });

  it("preserves source phrase and same runs are deterministic in geometry", () => {
    const first = shapeArabicWithFont(font, opts);
    const second = shapeArabicWithFont(font, opts);
    expect(first.map((x) => x.pathData)).toEqual(second.map((x) => x.pathData));
    expect(first.every((x) => x.sourceText === opts.phrase)).toBe(true);
    expect(first.every((x) => Number.isFinite(x.x) && Number.isFinite(x.y))).toBe(true);
  });

  it("keeps Arabic words as independent editable groups in RTL order", () => {
    const glyphs = shapeArabicWithFont(font, { ...opts, phrase: "بسم الله" });
    const groups = [...new Set(glyphs.map((g) => g.groupId))];
    expect(groups).toHaveLength(2);
    const rightWord = glyphs.filter((g) => g.groupId === groups[0]);
    const leftWord = glyphs.filter((g) => g.groupId === groups[1]);
    expect(rightWord[0]!.sourceText).toBe("بسم");
    expect(leftWord[0]!.sourceText).toBe("الله");
    expect(Math.max(...rightWord.map((g) => g.x))).toBeGreaterThan(Math.max(...leftWord.map((g) => g.x)));
  });

  it("positions combining vowel marks by OpenType layout rather than isolating Unicode letters", () => {
    const withMarks = shapeArabicWithFont(font, opts);
    const withoutMarks = shapeArabicWithFont(font, { ...opts, phrase: "سلام" });
    expect(withMarks.length).toBeGreaterThan(withoutMarks.length);
    expect(withMarks.some((g) => g.pathData && g.pathData.length > 5)).toBe(true);
  });
});
