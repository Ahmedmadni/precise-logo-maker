import { describe, expect, it } from "vitest";
import { applyHandle, handlesOf, pickHandle } from "../../editor/handles";
import { alignOffsets, distributeOffsets } from "../../objects/align";
import { pt } from "../geometry/math";
import type { Bounds, Geometry } from "../geometry/types";

const circle: Geometry = { kind: "circle", center: pt(100, 100), radius: 50 };
const line: Geometry = { kind: "line", a: pt(0, 0), b: pt(10, 0) };
const arc: Geometry = {
  kind: "arc",
  center: pt(0, 0),
  radius: 10,
  startAngle: 0,
  endAngle: 90,
};

const bounds = (minX: number, minY: number, maxX: number, maxY: number): Bounds => ({
  minX,
  minY,
  maxX,
  maxY,
});

describe("handles", () => {
  it("exposes center and radius handles for a circle", () => {
    const hs = handlesOf(circle);
    expect(hs.map((h) => h.id)).toEqual(["center", "radius"]);
    expect(hs[1]?.point).toEqual(pt(150, 100));
  });

  it("moves a line endpoint", () => {
    const next = applyHandle(line, "b", pt(0, 20));
    expect(next).toEqual({ kind: "line", a: pt(0, 0), b: pt(0, 20) });
  });

  it("resizes a circle by its radius handle", () => {
    const next = applyHandle(circle, "radius", pt(100, 180));
    expect(next.kind).toBe("circle");
    if (next.kind === "circle") expect(next.radius).toBeCloseTo(80);
  });

  it("translates geometry from the center handle", () => {
    const next = applyHandle(circle, "center", pt(200, 100));
    if (next.kind === "circle") expect(next.center).toEqual(pt(200, 100));
  });

  it("re-aims an arc end angle", () => {
    const next = applyHandle(arc, "end", pt(-10, 0));
    if (next.kind === "arc") {
      expect(next.endAngle).toBeCloseTo(180);
      expect(next.startAngle).toBeCloseTo(0);
    }
  });

  it("picks the nearest handle within tolerance and nothing outside it", () => {
    expect(pickHandle(circle, pt(148, 101), 5)?.id).toBe("radius");
    expect(pickHandle(circle, pt(0, 0), 5)).toBeNull();
  });
});

describe("align & distribute", () => {
  const list = [bounds(0, 0, 10, 10), bounds(40, 20, 60, 30)];

  it("aligns to the left edge of the target", () => {
    const offsets = alignOffsets(list, "left", bounds(0, 0, 100, 100));
    expect(offsets[0]).toEqual(pt(0, 0));
    expect(offsets[1]).toEqual(pt(-40, 0));
  });

  it("centers horizontally on the target", () => {
    const offsets = alignOffsets(list, "centerX", bounds(0, 0, 100, 100));
    expect(offsets[0]?.x).toBeCloseTo(45);
    expect(offsets[1]?.x).toBeCloseTo(0);
  });

  it("evenly spaces three items and leaves the extremes fixed", () => {
    const three = [bounds(0, 0, 10, 10), bounds(20, 0, 30, 10), bounds(100, 0, 110, 10)];
    const offsets = distributeOffsets(three, "x");
    expect(offsets[0]).toEqual(pt(0, 0));
    expect(offsets[2]).toEqual(pt(0, 0));
    expect(offsets[1]?.x).toBeCloseTo(25);
  });

  it("is a no-op with fewer than three items", () => {
    expect(distributeOffsets(list, "y")).toEqual([pt(0, 0), pt(0, 0)]);
  });
});
