import { describe, expect, it } from "vitest";
import { editOutlineNode, moveOutlineNodeWithHandles, glyphPointToWorld, outlineNodes, parseOutline, smoothOutlineAnchor, worldToGlyphPoint } from "../pathEditor";
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
  it("smooths a cubic joint by matching outgoing and incoming tangents", () => {
    const d = "M0 0 C2 10 8 10 10 0 C14 -3 18 -10 20 0";
    const result = smoothOutlineAnchor(d, 3);
    expect(result).not.toBeNull();
    const nodes = outlineNodes(result!);
    const anchor = nodes[3]!, incoming = nodes[2]!, outgoing = nodes[4]!;
    const ux = anchor.x - incoming.x, uy = anchor.y - incoming.y;
    const vx = outgoing.x - anchor.x, vy = outgoing.y - anchor.y;
    expect(ux * vy - uy * vx).toBeCloseTo(0, 2);
    expect(smoothOutlineAnchor("M0 0 L10 10", 1)).toBeNull();
  });
  it("keeps Bézier handle coordinates accurate with independent X/Y shear", () => {
    const glyph = {
      ...createLettering(130, 280), kind: "outline" as const,
      size: 165, unitsPerEm: 1000,
      scaleX: 1.3, scaleY: 0.75, rotation: 25, skewX: 19, skewY: -12,
    };
    const point = glyphPointToWorld(glyph, 350, -90);
    const inverse = worldToGlyphPoint(glyph, point.x, point.y)!;
    expect(inverse.x).toBeCloseTo(350, 5);
    expect(inverse.y).toBeCloseTo(-90, 5);
  });
  it("moves an anchor and its adjacent cubic handles without bending neighboring curves", () => {
    const source = "M0 0 C2 10 8 10 10 0 C14 -3 18 -10 20 0";
    const result = moveOutlineNodeWithHandles(source, 3, 15, 5)!;
    const before = outlineNodes(source), after = outlineNodes(result);
    expect(after[3]).toMatchObject({ x: 15, y: 5 });
    expect(after[2]).toMatchObject({ x: before[2]!.x + 5, y: before[2]!.y + 5 });
    expect(after[4]).toMatchObject({ x: before[4]!.x + 5, y: before[4]!.y + 5 });
    expect(after[1]).toEqual(before[1]);
    expect(after[5]).toEqual(before[5]);
    expect(after).toHaveLength(before.length);
    const free = outlineNodes(moveOutlineNodeWithHandles(source, 3, 15, 5, false)!);
    expect(free[2]).toEqual(before[2]);
    expect(free[4]).toEqual(before[4]);
  });

  it("preserves Q tangents and allows editing individual handles without dragging anchors", () => {
    const source = "M0 0 Q5 6 10 0 Q14 2 20 0";
    const result = outlineNodes(moveOutlineNodeWithHandles(source, 2, 15, 2)!);
    expect(result[1]).toMatchObject({ x: 10, y: 8 });
    expect(result[2]).toMatchObject({ x: 15, y: 2 });
    expect(result[3]).toMatchObject({ x: 19, y: 4 });
    const handle = outlineNodes(moveOutlineNodeWithHandles(source, 1, 7, 8)!);
    expect(handle[0]).toMatchObject({ x: 0, y: 0 });
    expect(handle[1]).toMatchObject({ x: 7, y: 8 });
    expect(handle[2]).toMatchObject({ x: 10, y: 0 });
  });

  it("never moves control handles across a disconnected glyph contour", () => {
    const source = "M0 0 C2 5 8 5 10 0 Z M20 0 C25 5 30 5 35 0";
    const before = outlineNodes(source);
    const result = outlineNodes(moveOutlineNodeWithHandles(source, 3, 12, 3)!);
    expect(result[2]).toMatchObject({ x: 10, y: 8 });
    expect(result[3]).toMatchObject({ x: 12, y: 3 });
    expect(result.slice(4)).toEqual(before.slice(4));
    expect(moveOutlineNodeWithHandles(source, 200, 1, 2)).toBeNull();
    expect(moveOutlineNodeWithHandles(source, 3, Infinity, 2)).toBeNull();
  });

  it("can move a contour start and its outgoing Bézier handle without shifting other contours", () => {
    const source = "M0 0 C5 6 10 6 15 0 Z M40 40 L50 50";
    const result = outlineNodes(moveOutlineNodeWithHandles(source, 0, 3, 4)!);
    expect(result[0]).toMatchObject({ x: 3, y: 4 });
    expect(result[1]).toMatchObject({ x: 8, y: 10 });
    expect(result[2]).toMatchObject({ x: 10, y: 6 });
    expect(result.slice(4)).toEqual(outlineNodes(source).slice(4));
  });
  it("keeps a closed cubic contour seam intact when moving its start anchor", () => {
    const d = "M0 0 C5 10 10 10 0 0 Z M50 50 C55 60 60 60 70 50 Z";
    const result = outlineNodes(moveOutlineNodeWithHandles(d, 0, 4, 6)!);
    expect(result[0]).toMatchObject({ x: 4, y: 6 });
    expect(result[1]).toMatchObject({ x: 9, y: 16 });
    expect(result[2]).toMatchObject({ x: 14, y: 16 });
    expect(result[3]).toMatchObject({ x: 4, y: 6 });
    expect(result.slice(4)).toEqual(outlineNodes(d).slice(4));
  });

  it("moves the duplicate last anchor and its first outgoing handle as one closed seam", () => {
    const d = "M0 0 C5 10 10 10 0 0 Z M50 50 L70 50 Z";
    const result = outlineNodes(moveOutlineNodeWithHandles(d, 3, 4, 6)!);
    expect(result[0]).toMatchObject({ x: 4, y: 6 });
    expect(result[1]).toMatchObject({ x: 9, y: 16 });
    expect(result[2]).toMatchObject({ x: 14, y: 16 });
    expect(result[3]).toMatchObject({ x: 4, y: 6 });
    expect(result.slice(4)).toEqual(outlineNodes(d).slice(4));
  });

  it("smooths a true closed cubic seam from either endpoint without touching other contours", () => {
    const d = "M0 0 C5 10 10 10 0 0 Z M40 0 C45 10 50 10 60 0 Z";
    for (const anchorId of [0, 3]) {
      const updated = smoothOutlineAnchor(d, anchorId);
      expect(updated).not.toBeNull();
      const nodes = outlineNodes(updated!);
      const incoming = nodes[2]!, outgoing = nodes[1]!, anchor = nodes[0]!;
      const inDx = anchor.x - incoming.x, inDy = anchor.y - incoming.y;
      const outDx = outgoing.x - anchor.x, outDy = outgoing.y - anchor.y;
      expect(inDx * outDy - inDy * outDx).toBeCloseTo(0, 7);
      expect(nodes[3]).toMatchObject({ x: 0, y: 0 });
      expect(nodes.slice(4)).toEqual(outlineNodes(d).slice(4));
    }
  });

  it("does not smooth across a straight Z closing edge or into another disconnected mark", () => {
    const d = "M0 0 C5 10 10 10 20 0 Z M40 0 C45 10 50 10 60 0 Z";
    expect(smoothOutlineAnchor(d, 0)).toBeNull();
    expect(smoothOutlineAnchor(d, 3)).toBeNull();
    expect(smoothOutlineAnchor(d, 4)).toBeNull();
    const moved = outlineNodes(moveOutlineNodeWithHandles(d, 0, 2, 3)!);
    expect(moved[3]).toMatchObject({ x: 20, y: 0 });
    expect(moved.slice(4)).toEqual(outlineNodes(d).slice(4));
  });

  it("exports ornaments as SVG paths without HTML text", () => {
    const ornament = createOrnament("star8", 100, 100);
    const svg = letteringSvg(ornament);
    expect(svg).toContain("<path");
    expect(svg).not.toContain("<text");
  });
});
