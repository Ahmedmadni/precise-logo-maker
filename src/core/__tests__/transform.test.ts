import { describe, expect, it } from "vitest";
import { pt } from "../geometry/math";
import { mirrorGeometry, rotateGeometry, translateGeometry } from "../../objects/transform";
import { buildSvgDocument } from "../../objects/export";
import { DEFAULT_STYLE, IDENTITY_TRANSFORM } from "../geometry/types";

describe("object transforms", () => {
  it("translates a line", () => {
    const g = translateGeometry({ kind: "line", a: pt(0, 0), b: pt(10, 0) }, 5, 2);
    expect(g).toMatchObject({ a: pt(5, 2), b: pt(15, 2) });
  });

  it("rotates a circle centre around the origin", () => {
    const g = rotateGeometry({ kind: "circle", center: pt(10, 0), radius: 4 }, 90, pt(0, 0));
    if (g.kind !== "circle") throw new Error("expected circle");
    expect(g.center.x).toBeCloseTo(0, 6);
    expect(g.center.y).toBeCloseTo(10, 6);
    expect(g.radius).toBe(4);
  });

  it("mirrors horizontally about an origin", () => {
    const g = mirrorGeometry({ kind: "line", a: pt(2, 1), b: pt(6, 1) }, "x", pt(0, 0));
    expect(g).toMatchObject({ a: pt(-2, 1), b: pt(-6, 1) });
  });
});

describe("svg export", () => {
  it("emits a document containing visible objects", () => {
    const svg = buildSvgDocument({
      artboard: { width: 100, height: 100, unit: "px", background: "#000" },
      grids: [],
      objects: [
        {
          id: "a",
          name: "Circle 1",
          type: "circle",
          geometry: { kind: "circle", center: pt(50, 50), radius: 20 },
          transform: IDENTITY_TRANSFORM,
          style: { ...DEFAULT_STYLE },
          layerId: "shapes",
          visible: true,
          locked: false,
        },
      ],
    });
    expect(svg).toContain('viewBox="0 0 100 100"');
    expect(svg).toContain("data-name=\"Circle 1\"");
  });
});
