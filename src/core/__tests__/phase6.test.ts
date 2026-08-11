import { describe, expect, it } from "vitest";
import {
  closestPointOnGeometry,
  geometryBounds,
  pathSegments,
  pt,
} from "../geometry/math";
import { intersectGeometry } from "../geometry/intersections";
import type { PathGeometry } from "../geometry/types";
import { geometryToPathData } from "../../objects/render";
import { applyHandle, handlesOf } from "../../editor/handles";
import { rotateGeometry, translateGeometry } from "../../objects/transform";

const square: PathGeometry = {
  kind: "path",
  points: [pt(0, 0), pt(10, 0), pt(10, 10), pt(0, 10)],
  closed: true,
};

describe("poly-path geometry", () => {
  it("closes the loop when closed", () => {
    expect(pathSegments(square.points, true)).toHaveLength(4);
    expect(pathSegments(square.points, false)).toHaveLength(3);
  });

  it("computes bounds from every point", () => {
    expect(geometryBounds(square)).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 10 });
  });

  it("finds the closest point on the outline", () => {
    expect(closestPointOnGeometry(square, pt(5, -3))).toEqual(pt(5, 0));
  });

  it("serialises to an SVG path with a Z when closed", () => {
    const d = geometryToPathData(square);
    expect(d.startsWith("M 0 0")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
  });

  it("exposes one draggable handle per point", () => {
    const handles = handlesOf(square);
    expect(handles).toHaveLength(4);
    const moved = applyHandle(square, "p2", pt(20, 20)) as PathGeometry;
    expect(moved.points[2]).toEqual(pt(20, 20));
  });

  it("translates and rotates every point", () => {
    const moved = translateGeometry(square, 5, 5) as PathGeometry;
    expect(moved.points[0]).toEqual(pt(5, 5));
    const spun = rotateGeometry(square, 90, pt(0, 0)) as PathGeometry;
    expect(spun.points[1]?.x).toBeCloseTo(0);
    expect(spun.points[1]?.y).toBeCloseTo(10);
  });

  it("intersects a line with the path outline", () => {
    const hits = intersectGeometry({ kind: "line", a: pt(-5, 5), b: pt(15, 5) }, square);
    expect(hits).toHaveLength(2);
  });
});
