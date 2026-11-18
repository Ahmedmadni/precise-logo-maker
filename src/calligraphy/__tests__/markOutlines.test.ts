import { describe, expect, it } from "vitest";
import { normalizeMarkPath } from "../markOutlines";
import { createHaraka, letteringSvg } from "../model";
import { outlineNodes } from "../pathEditor";
import { parseProject, serializeProject } from "../../objects/project";
import { buildSvgDocument } from "../../objects/export";
import type { DocumentState } from "../../store/studioStore";

describe("licensed typeface-derived diacritic outlines", () => {
  it("normalizes original letterform Bézier handles while centering the shape", () => {
    const original = "M 10 100 C 35 120 80 115 100 100 Q 45 70 10 100 Z";
    const result = normalizeMarkPath(original)!;
    expect(result).toMatch(/^M/);
    expect(result).toContain("C");
    expect(result).toContain("Q");
    expect(result).toMatch(/Z$/);
    const nodes = outlineNodes(result);
    const allX = nodes.map((n) => n.x), allY = nodes.map((n) => n.y);
    expect(Math.min(...allX)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...allX)).toBeLessThanOrEqual(100);
    expect(Math.min(...allY)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...allY)).toBeLessThanOrEqual(100);
  });

  it("rejects a missing or unusable glyph, not inventing unsupported marks", () => {
    expect(normalizeMarkPath("")).toBeNull();
    expect(normalizeMarkPath("M0 0 L0 0 Z")).toBeNull();
    expect(normalizeMarkPath("M0 0 A50 50 0 0 1 100 100 Z")).toBeNull();
  });

  it("persists each mark's actual vector path through save/load and SVG exports", () => {
    const custom = normalizeMarkPath("M0 0 L20 10 L40 0 L40 20 L0 20 Z")!;
    const mark = { ...createHaraka("shadda", 90, 130), markPathData: custom };
    const doc: DocumentState = { artboard: { width: 400, height: 250, unit: "px",
      background: "#ffffff" }, grids: [], objects: [], lettering: [mark] };
    const loaded = parseProject(serializeProject(doc))!;
    expect(loaded.lettering?.[0]?.markPathData).toBe(custom);
    const svg = buildSvgDocument(loaded, { background: false });
    expect(svg).toContain(custom);
    expect(letteringSvg(mark)).toContain(custom);
    const simple = createHaraka("shadda", 90, 130);
    expect(letteringSvg(simple)).not.toContain(custom);
  });
});
