import { describe, expect, it } from "vitest";
import { editOutlineNode, glyphPointToWorld, outlineNodes, parseOutline, worldToGlyphPoint } from "../pathEditor";
import { letteringSvg, createLettering, createOrnament } from "../model";

describe("outline node editor", () => {
  it("parses both quadratic and cubic Bézier commands", () => {
    const d = "M0 0 Q5 10 15 20 C20 30 25 40 35 45 Z";
    const nodes = outlineNodes(d);
    expect(nodes).toHaveLength(6);
    expect(nodes.filter((n) => n.role === "control")).toHaveLength(3);
    const edited = editOutlineNode(d, 2, 18, 22);
    expect(edited).toContain("18 22");
    expect(outlineNodes(edited!)[2]).toMatchObject({ x: 18, y: 22 });
  });
  it("expands relative moves and shorthand lines without changing geometry", () => {
    const segs = parseOutline("m10 10 h20 v10 l-5 5 z");
    expect(segs).not.toBeNull();
    expect(segs?.map((s) => s.cmd)).toEqual(["M", "L", "L", "L", "Z"]);
    expect(outlineNodes("m10 10 h20 v10 l-5 5 z").map((n) => [n.x, n.y]))
      .toEqual([[10, 10], [30, 10], [30, 20], [25, 25]]);
  });
  it("blocks unsupported arcs and invalid path input", () => {
    expect(parseOutline("M0 0 A10 10 0 0 0 50 50")).toBeNull();
    expect(editOutlineNode("M0 0", 5, 1, 1)).toBeNull();
  });
  it("maps control points exactly through rotations and independent scaling", () => {
    const item = { ...createLettering(100, 200), kind: "outline" as const, unitsPerEm: 1000, size: 100, scaleX: 1.5, scaleY: 0.75, rotation: 35 };
    const world = glyphPointToWorld(item, 350, 400);
    const local = worldToGlyphPoint(item, world.x, world.y)!;
    expect(local.x).toBeCloseTo(350, 6);
    expect(local.y).toBeCloseTo(400, 6);
  });
  it("exports ornaments as SVG paths without HTML text", () => {
    const ornament = createOrnament("star8", 100, 100);
    const svg = letteringSvg(ornament);
    expect(svg).toContain("<path");
    expect(svg).not.toContain("<text");
  });
});
