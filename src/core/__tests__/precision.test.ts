import { describe, expect, it } from "vitest";
import { DEFAULT_PRECISION, constrainPoint, quantize } from "../precision/constraints";
import { measure } from "../precision/measure";
import { pt } from "../geometry/math";

describe("precision constraints", () => {
  it("quantizes values", () => {
    expect(quantize(14, 15)).toBe(15);
    expect(quantize(7, 0)).toBe(7);
  });

  it("locks direction to the angle step when forced", () => {
    const p = constrainPoint(pt(0, 0), pt(100, 10), DEFAULT_PRECISION, true);
    expect(p.y).toBeCloseTo(0, 6);
    expect(p.x).toBeCloseTo(Math.hypot(100, 10), 6);
  });

  it("leaves the cursor untouched with no active constraint", () => {
    const p = constrainPoint(pt(0, 0), pt(3, 4), DEFAULT_PRECISION, false);
    expect(p).toEqual(pt(3, 4));
  });

  it("quantizes length when a length step is set", () => {
    const p = constrainPoint(pt(0, 0), pt(23, 0), { ...DEFAULT_PRECISION, lengthStep: 10 });
    expect(p.x).toBeCloseTo(20, 6);
  });
});

describe("measure", () => {
  it("reports length, angle and deltas", () => {
    const m = measure(pt(0, 0), pt(0, 10));
    expect(m.length).toBeCloseTo(10);
    expect(m.angle).toBeCloseTo(90);
    expect(m.dy).toBe(10);
  });
});
