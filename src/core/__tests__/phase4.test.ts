import { describe, expect, it } from "vitest";
import {
  buildGridGeometry,
  createGoldenGrid,
  createGrid,
  createHexagonalGrid,
  createIsometricGrid,
  createTriangularGrid,
} from "../../grids";
import { parseProject, serializeProject } from "../../objects/project";
import { pt } from "../geometry/math";

const center = pt(512, 512);

describe("phase 4 grids", () => {
  it("isometric grid produces three line families and a lattice", () => {
    const g = buildGridGeometry(createIsometricGrid(center, 1024));
    expect(g.major.length).toBeGreaterThan(0);
    expect(g.major.every((x) => x.kind === "line")).toBe(true);
    expect(g.points.length).toBeGreaterThan(0);
  });

  it("triangular grid points are finite", () => {
    const g = buildGridGeometry(createTriangularGrid(center, 1024));
    expect(g.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
  });

  it("hexagonal grid emits 6 edges per hex", () => {
    const grid = createHexagonalGrid(center, 1024);
    grid.rings = 1;
    const g = buildGridGeometry(grid);
    expect(g.major.length).toBe(7 * 6);
  });

  it("golden grid includes spiral arcs when enabled", () => {
    const g = buildGridGeometry(createGoldenGrid(center, 1024));
    expect(g.major.some((x) => x.kind === "arc")).toBe(true);
    expect(g.minor.length).toBeGreaterThan(0);
  });

  it("createGrid returns the requested kind", () => {
    expect(createGrid("hexagonal", center, 512).kind).toBe("hexagonal");
    expect(createGrid("golden", center, 512).kind).toBe("golden");
  });
});

describe("project file", () => {
  const doc = {
    artboard: { width: 512, height: 512, unit: "px" as const, background: "#000" },
    grids: [createIsometricGrid(center, 512)],
    objects: [],
  };

  it("round-trips a document", () => {
    const parsed = parseProject(serializeProject(doc));
    expect(parsed?.artboard.width).toBe(512);
    expect(parsed?.grids[0]?.kind).toBe("isometric");
  });

  it("rejects foreign payloads", () => {
    expect(parseProject("{}")).toBeNull();
    expect(parseProject("not json")).toBeNull();
  });
});
