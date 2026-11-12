import { describe, expect, it } from "vitest";
import { createLettering, letteringSvg } from "../model";
import { morphOutline, morphGlyphPixels, centerLetteringAt, letteringGroupBounds } from "../morph";
import { outlineNodes } from "../pathEditor";

const glyph = {
  ...createLettering(100, 200),
  kind: "outline" as const, pathData: "M0 0 Q20 55 100 0 C120 -15 150 10 180 50 Z",
  unitsPerEm: 1000, size: 200, groupId: "group1",
};

describe("real vector glyph deformation", () => {
  it("extends a glyph's rightmost curve without moving its left joining point", () => {
    const morphed = morphGlyphPixels(glyph, "right", 40)!;
    const points = outlineNodes(morphed);
    const original = outlineNodes(glyph.pathData);
    expect(points[0]?.x).toBe(original[0]?.x);
    expect(Math.max(...points.map((p) => p.x))).toBeGreaterThan(Math.max(...original.map((p) => p.x)));
    const exported = letteringSvg({ ...glyph, pathData: morphed });
    expect(exported).toContain("<path");
    expect(exported).not.toContain("<text");
  });
  it("keeps contours closed and supports upward, left and downward extensions", () => {
    for (const direction of ["left", "up", "down"] as const) {
      const changed = morphOutline(glyph.pathData, direction, 40);
      expect(changed).toContain("Z");
      expect(outlineNodes(changed!).length).toBe(outlineNodes(glyph.pathData).length);
    }
  });
  it("rejects invalid values and leaves original path unchanged on zero extension", () => {
    expect(morphOutline(glyph.pathData, "right", Number.NaN)).toBeNull();
    expect(morphOutline("M0 0 L0 0 Z", "right", 100)).toBeNull();
    expect(morphOutline(glyph.pathData, "right", 0)).toBe(glyph.pathData);
  });
  it("restores a new glyph run to the previous visual center", () => {
    const previous = letteringGroupBounds([glyph])!;
    const moved = centerLetteringAt([{ ...glyph, x: 360, y: 440 }], {
      x: previous.x + previous.width / 2, y: previous.y + previous.height / 2,
    });
    const bounds = letteringGroupBounds(moved)!;
    expect(bounds.x + bounds.width / 2).toBeCloseTo(previous.x + previous.width / 2, 5);
    expect(bounds.y + bounds.height / 2).toBeCloseTo(previous.y + previous.height / 2, 5);
  });
});
