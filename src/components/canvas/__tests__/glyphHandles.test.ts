import { describe, expect, it } from "vitest";
import { glyphTransformHandles } from "../GlyphTransformHandles";
import { createLettering } from "../../../calligraphy/model";

describe("touch glyph transform handles", () => {
  const glyph = {
    ...createLettering(100, 200), kind: "outline" as const, size: 100, unitsPerEm: 1000,
    pathData: "M0 0 L100 0 L100 200 L0 200 Z",
  };
  it("places stretch grips on the actual rotated glyph axes", () => {
    const handles = glyphTransformHandles(glyph);
    const right = handles.find((h) => h.edge === "right")!;
    const left = handles.find((h) => h.edge === "left")!;
    const top = handles.find((h) => h.edge === "top")!;
    const bottom = handles.find((h) => h.edge === "bottom")!;
    const rotate = handles.find((h) => h.edge === "rotate")!;
    expect(handles).toHaveLength(5);
    expect(right.x).toBeGreaterThan(left.x);
    expect(top.y).toBeLessThan(bottom.y);
    expect(rotate.y).toBeLessThan(top.y);
  });
  it("does not show invalid transforms for text drafts or missing outlines", () => {
    expect(glyphTransformHandles(createLettering(0, 0))).toEqual([]);
    expect(glyphTransformHandles({ ...glyph, pathData: "" })).toEqual([]);
  });
});
