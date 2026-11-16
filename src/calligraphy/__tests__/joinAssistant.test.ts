import { describe, expect, it } from "vitest";
import { createLettering, type LetteringItem } from "../model";
import { alignJoinWithClearance, analyzeJoin } from "../joinAssistant";
import { worldJoinAnchor } from "../contourComposer";
import { buildSvgDocument } from "../../objects/export";
import type { DocumentState } from "../../store/studioStore";

const glyph = (id: string, x: number, y: number): LetteringItem => ({
  ...createLettering(x, y), id, kind: "outline", size: 175,
  unitsPerEm: 1000, pathData: "M0 0 L250 0 L250 450 L0 450 Z",
  joinAnchors: { entry: { x: 250, y: 140 }, exit: { x: 0, y: 140 } },
  skewX: 12, rotation: 21,
});

describe("visual join assistant", () => {
  const moving = glyph("moving", 500, 250);
  const fixed = glyph("fixed", 190, 310);

  it("measures both signed axis gaps and actual anchor distance in artboard units", () => {
    const gap = analyzeJoin(moving, "entry", fixed, "exit")!;
    expect(gap.deltaX).toBeCloseTo(gap.to.x - gap.from.x, 8);
    expect(gap.deltaY).toBeCloseTo(gap.to.y - gap.from.y, 8);
    expect(gap.distance).toBeCloseTo(Math.hypot(gap.deltaX, gap.deltaY), 8);
    expect(gap.distance).toBeGreaterThan(0);
  });

  it("aligns anchors and offers deliberate X/Y clearance without altering glyph outlines", () => {
    const patch = alignJoinWithClearance(moving, "entry", fixed, "exit", 6, -4)!;
    const moved = { ...moving, ...patch };
    const actual = worldJoinAnchor(moved, "entry")!;
    const target = worldJoinAnchor(fixed, "exit")!;
    expect(actual.x - target.x).toBeCloseTo(6, 6);
    expect(actual.y - target.y).toBeCloseTo(-4, 6);
    expect(moved.pathData).toBe(moving.pathData);
    const second = alignJoinWithClearance(moved, "entry", fixed, "exit", 6, -4)!;
    expect(second).toEqual({ x: moved.x, y: moved.y });
  });

  it("rejects self joins, unsupported text and extreme clearances", () => {
    expect(analyzeJoin(moving, "entry", moving, "exit")).toBeNull();
    expect(analyzeJoin(createLettering(0, 0), "entry", fixed, "exit")).toBeNull();
    expect(alignJoinWithClearance(moving, "entry", fixed, "exit", Infinity, 0)).toBeNull();
    expect(alignJoinWithClearance(moving, "entry", fixed, "exit", 201, 0)).toBeNull();
  });

  it("leaves exported SVG clean of geometric join measurements", () => {
    const doc: DocumentState = {
      artboard: { width: 800, height: 600, unit: "px", background: "#ffffff" },
      grids: [], objects: [], lettering: [moving, fixed],
    };
    const svg = buildSvgDocument(doc, { background: false });
    expect(svg).toContain("<path");
    expect(svg).not.toContain("gap");
    expect(svg).not.toContain("معاينة المسافة");
    expect(svg).not.toContain("joinGuide");
  });
});
