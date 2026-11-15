import { describe, expect, it } from "vitest";
import { createLettering, letteringSvg } from "../model";
import {
  alignGlyphJoin, getJoinAnchor, moveOutlineContour,
  outlineContours, positionJoinAnchor, worldJoinAnchor,
} from "../contourComposer";
import { glyphPointToWorld, outlineNodes } from "../pathEditor";
import { parseProject, serializeProject } from "../../objects/project";
import { buildSvgDocument } from "../../objects/export";
import type { DocumentState } from "../../store/studioStore";

const d = "M0 0 C10 15 20 15 30 0 L30 30 Z M40 50 Q50 65 60 50 L60 80 Z";
const example = {
  ...createLettering(300, 180), kind: "outline" as const,
  pathData: d, unitsPerEm: 1000, size: 200, rotation: 0,
  groupId: "word-1", sourceText: "سلام", glyphIndex: 0,
};

describe("editable Arabic glyph contours", () => {
  it("detects closed subpaths without inventing semantic head/body/tail components", () => {
    const contours = outlineContours(d);
    expect(contours).toHaveLength(2);
    expect(contours[0]!.index).toBe(0);
    expect(contours[0]!.pointCount).toBeGreaterThan(3);
    expect(contours[1]!.path).toContain("Q");
  });

  it("moves exactly one contour, including cubic and quadratic handles", () => {
    const shifted = moveOutlineContour(d, 1, 20, -10)!;
    const before = outlineContours(d);
    const after = outlineContours(shifted);
    expect(after).toHaveLength(2);
    expect(after[0]!.path).toEqual(before[0]!.path);
    expect(after[1]!.bounds.minX).toBe(before[1]!.bounds.minX + 20);
    expect(after[1]!.bounds.maxY).toBe(before[1]!.bounds.maxY - 10);
    expect(outlineNodes(shifted)).toHaveLength(outlineNodes(d).length);
    const svg = letteringSvg({ ...example, pathData: shifted });
    expect(svg).toContain('<path d="');
    expect(svg).not.toContain("<text");
  });

  it("rejects invalid contours or extreme adjustments without replacing original geometry", () => {
    expect(moveOutlineContour(d, 5, 10, 0)).toBeNull();
    expect(moveOutlineContour(d, 0, 10000, 0)).toBeNull();
    expect(moveOutlineContour("broken path", 0, 1, 2)).toBeNull();
  });
});

describe("contextual joining guides", () => {
  it("defaults to the visible left/right glyph edges and can be manually overridden", () => {
    const start = getJoinAnchor(example, "entry")!;
    const end = getJoinAnchor(example, "exit")!;
    expect(start.x).toBeGreaterThan(end.x);
    const manual = { ...example, joinAnchors: { entry: { x: 15, y: 24 } } };
    expect(getJoinAnchor(manual, "entry")).toEqual({ x: 15, y: 24 });
  });

  it("aligns a movable entry with a fixed exit without damaging Bézier outlines", () => {
    const fixed = { ...example, id: "fixed" };
    const moving = { ...example, id: "moving", x: 670, y: 380, rotation: 23,
      skewX: 17, scaleX: 1.3, scaleY: 0.85,
      joinAnchors: { entry: { x: 30, y: 10 }, exit: { x: 0, y: 0 } } };
    const pos = alignGlyphJoin(moving, "entry", fixed, "exit")!;
    const adjusted = { ...moving, ...pos };
    const aligned = worldJoinAnchor(adjusted, "entry")!;
    const target = worldJoinAnchor(fixed, "exit")!;
    expect(aligned.x).toBeCloseTo(target.x, 5);
    expect(aligned.y).toBeCloseTo(target.y, 5);
    expect(adjusted.pathData).toEqual(moving.pathData);
    expect(alignGlyphJoin(moving, "entry", moving, "exit")).toBeNull();
  });

  it("can drag a join anchor through rotated/skewed glyph transforms exactly", () => {
    const g = { ...example, skewX: 21, skewY: -13, rotation: 40, scaleX: 1.2, scaleY: 0.7 };
    const world = glyphPointToWorld(g, 52, 91);
    const mapped = positionJoinAnchor(g, world.x, world.y)!;
    expect(mapped.x).toBeCloseTo(52, 2);
    expect(mapped.y).toBeCloseTo(91, 2);
  });

  it("persists semantic contour annotations and join anchors in .logo, never in exported artwork", () => {
    const glyph = { ...example, contourRoles: { "0": "body" as const, "1": "dot" as const },
      joinAnchors: { entry: { x: 10, y: 15 }, exit: { x: 70, y: 20 } } };
    const doc: DocumentState = {
      artboard: { width: 800, height: 600, unit: "px", background: "#ffffff" },
      grids: [], objects: [], lettering: [glyph],
    };
    const saved = parseProject(serializeProject(doc));
    expect(saved?.lettering?.[0]?.contourRoles?.["1"]).toBe("dot");
    expect(saved?.lettering?.[0]?.joinAnchors?.entry?.x).toBe(10);
    const svg = buildSvgDocument(saved!, { background: false });
    expect(svg).toContain("<path");
    expect(svg).not.toContain("joinAnchors");
    expect(svg).not.toContain("contourRoles");
    expect(svg).not.toContain("<circle");
  });
});
