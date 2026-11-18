import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { create } from "fontkit";
import { buildOpenTypeFeatureChoices, shapeArabicWithFont } from "../shaping";
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

describe("authentic OpenType word variant combinations", () => {
  it("lists the default and only font-advertised feature tags", () => {
    const choices = buildOpenTypeFeatureChoices([
      "salt", "swsh", "ss01", "ss02", "cv01", "cv02", "liga", "evil", "salt",
    ]);
    expect(choices[0]).toEqual({
      tag: "default", label: "التشكيل الأساسي",
      featureTags: [], kind: "default",
    });
    expect(choices.map((choice) => choice.tag)).toContain("swsh+ss01");
    expect(choices.some((choice) => choice.tag === "liga")).toBe(false);
    expect(choices.some((choice) => choice.tag === "ss01+ss02")).toBe(false);
    expect(choices.some((choice) => choice.tag === "cv01+cv02")).toBe(false);
    const found = choices.find((choice) => choice.tag === "salt+swsh")!;
    expect(found.featureTags).toEqual(["salt", "swsh"]);
    expect(found.kind).toBe("combination");
  });

  it("bounds the number of alternatives so browsing remains usable on phones", () => {
    const many = Array.from({ length: 70 }, (_, index) =>
      "ss" + String(index).padStart(2, "0"));
    const choices = buildOpenTypeFeatureChoices(many);
    expect(choices.length).toBeLessThanOrEqual(25);
    expect(choices.length).toBeGreaterThan(1);
    expect(buildOpenTypeFeatureChoices([])).toHaveLength(1);
    expect(buildOpenTypeFeatureChoices(["salt", "salt"])).toHaveLength(2);
  });

  it("shapes a word using a set of real supported features rather than splitting letters", () => {
    const permitted = (font.availableFeatures ?? []).filter((tag) =>
      /^(?:aalt|salt|swsh|cswh|ss\d\d|cv\d\d)$/.test(tag));
    if (!permitted.length) return;
    const single = shapeArabicWithFont(font, {
      ...opts, alternateFeatures: [permitted[0]!],
    });
    expect(single.every((g) => g.kind === "outline" && g.pathData)).toBe(true);
    expect(new Set(single.map((g) => g.groupId)).size).toBe(1);
    expect(single[0]?.alternateFeature).toBe(permitted[0]);
  });
});
