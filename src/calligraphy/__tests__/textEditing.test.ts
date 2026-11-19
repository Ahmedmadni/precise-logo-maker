import { describe, expect, it } from "vitest";
import { insertAtSelection, removeArabicMarks } from "../textEditing";
import { HARAKAT, letteringSvg, createHaraka } from "../model";
import { isBelowMark } from "../harakaAnchoring";

describe("explicit Arabic writing controls", () => {
  it("inserts a vowel after the letter at the caret", () => {
    expect(insertAtSelection("نور", 1, 1, "ُ")).toEqual({ text: "نُور", caret: 2 });
  });
  it("replaces only the current selection", () => {
    expect(insertAtSelection("نور", 1, 2, "ـ")).toEqual({ text: "نـر", caret: 2 });
  });
  it("removes marks without removing letters, hamza letters or elongation", () => {
    expect(removeArabicMarks("نُوْرٌ أَ إِ آـٰۦ")).toBe("نور أ إ آـ");
  });
  for (const [id, glyph] of [["dagger-alif", "ٰ"], ["maddah", "ٓ"], ["hamza-above", "ٔ"], ["hamza-below", "ٕ"], ["subscript-alif", "ٖ"], ["inverted-damma", "ٗ"], ["small-waw", "ۥ"], ["small-yeh", "ۦ"], ["small-high-seen", "ۜ"], ["small-high-meem", "ۢ"]]) {
    it(`offers and exports ${id} as editable geometry`, () => {
      const mark = HARAKAT.find((item) => item.id === id);
      expect(mark?.glyph).toBe(glyph);
      if (!mark) throw new Error("Missing mark");
      expect(letteringSvg(createHaraka(mark.id, 0, 0))).toContain(`d="${mark.path}"`);
    });
  }
  it("anchors the added below-letter marks underneath", () => {
    expect(isBelowMark("hamza-below")).toBe(true);
    expect(isBelowMark("subscript-alif")).toBe(true);
    expect(isBelowMark("small-yeh")).toBe(true);
    expect(isBelowMark("dagger-alif")).toBe(false);
  });
});