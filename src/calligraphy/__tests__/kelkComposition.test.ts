import { describe, expect, it } from "vitest";
import type { LetteringItem } from "../model";
import {
  KELK_SLANT_PRESETS,
  adjustGroupOverlap,
  applyGroupSlant,
  buildKashidaOutline,
  composeWordLayout,
  createKashidaItem,
} from "../kelkComposition";

const makeGlyph = (id: string, x: number, y = 200, size = 100): LetteringItem => ({
  id,
  kind: "outline",
  x,
  y,
  size,
  rotation: 0,
  color: "#111111",
  pathData: "M 0 0 L 100 0 L 100 100 Z",
  unitsPerEm: 1000,
  groupId: "word-1",
});

describe("kelkComposition", () => {
  it("applies slant presets to all outline glyphs in the target list", () => {
    const glyphs = [makeGlyph("g1", 300), makeGlyph("g2", 200)];
    const ruqaa = KELK_SLANT_PRESETS.find((p) => p.id === "ruqaa")!;
    const patches = applyGroupSlant(glyphs, ruqaa);
    expect(patches).toHaveLength(2);
    expect(patches[0]!.patch).toEqual({ skewX: -12, rotation: -4 });
    expect(patches[1]!.patch).toEqual({ skewX: -12, rotation: -4 });
  });

  it("composes cascade in Arabic RTL order (rightmost glyph stays at baseline)", () => {
    const glyphs = [makeGlyph("left", 100), makeGlyph("mid", 200), makeGlyph("right", 300)];
    const patches = composeWordLayout(glyphs, "cascade", 1);
    expect(patches.map((p) => p.id)).toEqual(["right", "mid", "left"]);
    expect(patches[0]!.patch.y).toBe(200);
    expect(patches[1]!.patch.y).toBeGreaterThan(200);
    expect(patches[2]!.patch.y).toBeGreaterThan(patches[1]!.patch.y!);
  });

  it("composes arch symmetrically with opposite tangent rotations on outer glyphs", () => {
    const glyphs = [makeGlyph("left", 100), makeGlyph("mid", 200), makeGlyph("right", 300)];
    const patches = composeWordLayout(glyphs, "arch", 1);
    const byId = Object.fromEntries(patches.map((p) => [p.id, p.patch]));
    expect(byId["mid"]!.y!).toBeLessThan(byId["left"]!.y!);
    expect(byId["mid"]!.rotation).toBe(0);
    expect(byId["right"]!.rotation!).toBeGreaterThan(0);
    expect(byId["left"]!.rotation!).toBeLessThan(0);
  });

  it("pulls outer glyphs inward when adjusting overlap with negative delta", () => {
    const glyphs = [makeGlyph("left", 100), makeGlyph("right", 300)];
    const patches = adjustGroupOverlap(glyphs, -10);
    const byId = Object.fromEntries(patches.map((p) => [p.id, p.patch]));
    expect(byId["right"]!.x).toBe(295);
    expect(byId["left"]!.x).toBe(105);
  });

  it("builds valid closed SVG paths for flat, arch, and wave kashida styles", () => {
    for (const style of ["flat", "arch", "wave"] as const) {
      const d = buildKashidaOutline({ length: 600, arch: 100, thickness: 70, style });
      expect(d).toBeTruthy();
      expect(d!.startsWith("M ")).toBe(true);
      expect(d!.endsWith("Z")).toBe(true);
    }
    const item = createKashidaItem(makeGlyph("g1", 300), { length: 600, arch: 90, thickness: 70, style: "arch" });
    expect(item?.kind).toBe("outline");
    expect(item?.groupId).toBe("word-1");
    expect(item?.pathData).toContain("Q 0 ");
  });
});