import { describe, expect, it } from "vitest";
import {
  circleCircleIntersection,
  intersectGeometry,
  lineCircleIntersection,
  lineLineIntersection,
  tangentPointsFromPoint,
} from "../geometry/intersections";
import {
  angleOf,
  arcContainsAngle,
  arcMidPoint,
  arcSweep,
  closestPointOnGeometry,
  dist,
  geometryBounds,
  pointOnCircle,
  pt,
} from "../geometry/math";
import type { ArcGeometry } from "../geometry/types";

describe("intersections", () => {
  it("finds line/line crossings and rejects parallel or out-of-span pairs", () => {
    const hit = lineLineIntersection(
      { kind: "line", a: pt(-10, 0), b: pt(10, 0) },
      { kind: "line", a: pt(0, -10), b: pt(0, 10) },
    );
    expect(hit).toHaveLength(1);
    expect(hit[0]?.x).toBeCloseTo(0);
    expect(hit[0]?.y).toBeCloseTo(0);

    expect(
      lineLineIntersection(
        { kind: "line", a: pt(0, 0), b: pt(10, 0) },
        { kind: "line", a: pt(0, 5), b: pt(10, 5) },
      ),
    ).toHaveLength(0);

    expect(
      lineLineIntersection(
        { kind: "line", a: pt(0, 0), b: pt(1, 0) },
        { kind: "line", a: pt(5, -5), b: pt(5, 5) },
      ),
    ).toHaveLength(0);
  });

  it("finds line/circle intersections", () => {
    const points = lineCircleIntersection(
      { kind: "line", a: pt(-20, 0), b: pt(20, 0) },
      { kind: "circle", center: pt(0, 0), radius: 10 },
    );
    expect(points).toHaveLength(2);
    expect(points.map((p) => p.x).sort((a, b) => a - b)).toEqual([-10, 10]);
  });

  it("finds circle/circle intersections and rejects disjoint circles", () => {
    const points = circleCircleIntersection(
      { kind: "circle", center: pt(0, 0), radius: 5 },
      { kind: "circle", center: pt(8, 0), radius: 5 },
    );
    expect(points).toHaveLength(2);
    for (const p of points) {
      expect(dist(p, pt(0, 0))).toBeCloseTo(5, 9);
      expect(dist(p, pt(8, 0))).toBeCloseTo(5, 9);
    }
    expect(
      circleCircleIntersection(
        { kind: "circle", center: pt(0, 0), radius: 1 },
        { kind: "circle", center: pt(50, 0), radius: 1 },
      ),
    ).toHaveLength(0);
  });

  it("restricts intersections to the swept part of an arc", () => {
    const arc: ArcGeometry = {
      kind: "arc",
      center: pt(0, 0),
      radius: 10,
      startAngle: 0,
      endAngle: 90,
    };
    const points = intersectGeometry(arc, {
      kind: "line",
      a: pt(-20, 0),
      b: pt(20, 0),
    });
    expect(points).toHaveLength(1);
    expect(points[0]?.x).toBeCloseTo(10);
  });

  it("computes tangent points from an external point", () => {
    const tangents = tangentPointsFromPoint(
      { kind: "circle", center: pt(0, 0), radius: 3 },
      pt(10, 0),
    );
    expect(tangents).toHaveLength(2);
    for (const t of tangents) expect(dist(t, pt(0, 0))).toBeCloseTo(3, 9);
  });
});

describe("arcs", () => {
  const arc: ArcGeometry = {
    kind: "arc",
    center: pt(100, 100),
    radius: 50,
    startAngle: 15,
    endAngle: 285,
  };

  it("measures sweep in the increasing-angle direction", () => {
    expect(arcSweep(arc)).toBeCloseTo(270);
    expect(arcSweep({ ...arc, startAngle: 300, endAngle: 30 })).toBeCloseTo(90);
  });

  it("knows which angles it contains", () => {
    expect(arcContainsAngle(arc, 90)).toBe(true);
    expect(arcContainsAngle(arc, 300)).toBe(false);
  });

  it("places the midpoint on the arc", () => {
    const m = arcMidPoint(arc);
    expect(dist(m, arc.center)).toBeCloseTo(50, 9);
    expect(angleOf(arc.center, m)).toBeCloseTo(150, 6);
  });

  it("clamps closest point to the arc endpoints outside the sweep", () => {
    const outside = pointOnCircle(arc.center, 200, 320);
    const closest = closestPointOnGeometry(arc, outside);
    const a = angleOf(arc.center, closest);
    expect([15, 285]).toContainEqual(Math.round(a));
  });

  it("includes axis extremes in bounds", () => {
    const b = geometryBounds({
      kind: "arc",
      center: pt(0, 0),
      radius: 10,
      startAngle: 0,
      endAngle: 180,
    });
    expect(b.maxY).toBeCloseTo(10);
    expect(b.minY).toBeCloseTo(0);
  });
});
