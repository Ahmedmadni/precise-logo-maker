import { describe, expect, it } from "vitest";
import { booleanGeometry } from "../../objects/boolean";
import type { Geometry } from "../geometry/types";

const square = (x: number, y: number, s: number): Geometry => ({
  kind: "path",
  closed: true,
  points: [
    { x, y },
    { x: x + s, y },
    { x: x + s, y: y + s },
    { x, y: y + s },
  ],
});

const area = (pts: { x: number; y: number }[]): number => {
  let a = 0;
  for (let i = 0; i < pts.length; i += 1) {
    const p = pts[i]!;
    const q = pts[(i + 1) % pts.length]!;
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
};

describe("pathfinder", () => {
  const a = square(0, 0, 10);
  const b = square(5, 0, 10);

  it("merges two overlapping squares into one outline", () => {
    const out = booleanGeometry([a, b], "union");
    expect(out).toHaveLength(1);
    expect(area(out[0]!.points)).toBeCloseTo(150, 6);
  });

  it("subtracts the second shape from the first", () => {
    const out = booleanGeometry([a, b], "subtract");
    expect(area(out[0]!.points)).toBeCloseTo(50, 6);
  });

  it("keeps only the overlap when intersecting", () => {
    const out = booleanGeometry([a, b], "intersect");
    expect(area(out[0]!.points)).toBeCloseTo(50, 6);
  });

  it("drops the overlap when excluding", () => {
    const out = booleanGeometry([a, b], "exclude");
    const total = out.reduce((sum, p) => sum + area(p.points), 0);
    expect(total).toBeCloseTo(100, 6);
  });

  it("needs at least two shapes", () => {
    expect(booleanGeometry([a], "union")).toEqual([]);
  });
});
