import { describe, expect, it } from "vitest";
import {
  buildGridGeometry,
  createConcentricGrid,
  createHexagonalGrid,
  createIsometricGrid,
  createRadialGrid,
  createSquareGrid,
  createTriangularGrid,
} from "../../grids";
import { cellAt, gridSupportsCells, paintableGrids } from "../../grids/cells";
import { closestPointOnGeometry, dist, pt } from "../geometry/math";

const center = pt(512, 512);

/** Distance from a point to the nearest line of a built grid. */
const distanceToGrid = (
  point: ReturnType<typeof pt>,
  geometry: ReturnType<typeof buildGridGeometry>,
) => Math.min(...geometry.major.map((g) => dist(closestPointOnGeometry(g, point), point)));

describe("grid cells", () => {
  it("resolves the square cell under a point", () => {
    const grid = { ...createSquareGrid(center, 1024), spacing: 128, subdivisions: 1 };
    const cell = cellAt(grid, pt(512 + 10, 512 + 10));
    expect(cell).not.toBeNull();
    expect(cell?.points).toHaveLength(4);
    // The cell just right of / below the origin spans one spacing step.
    expect(cell?.points[0]).toEqual(pt(512, 512));
    expect(cell?.points[2]).toEqual(pt(640, 640));
  });

  it("gives every point inside one cell the same key", () => {
    const grid = { ...createSquareGrid(center, 1024), spacing: 128, subdivisions: 1 };
    const a = cellAt(grid, pt(520, 520));
    const b = cellAt(grid, pt(630, 600));
    expect(a?.key).toBe(b?.key);
    expect(cellAt(grid, pt(660, 520))?.key).not.toBe(a?.key);
  });

  it("returns null outside the grid extent", () => {
    const grid = createSquareGrid(center, 1024);
    expect(cellAt(grid, pt(-5000, -5000))).toBeNull();
  });

  it("follows the grid origin and rotation", () => {
    const grid = {
      ...createSquareGrid(center, 1024),
      spacing: 128,
      subdivisions: 1,
      rotation: 37,
    };
    const cell = cellAt(grid, pt(560, 470));
    expect(cell).not.toBeNull();
    // The centre of a resolved cell must resolve back to the same cell.
    expect(cellAt(grid, cell!.center)?.key).toBe(cell!.key);
  });

  it("resolves hexagonal, triangular and isometric cells that round-trip", () => {
    const grids = [
      createHexagonalGrid(center, 1024),
      createTriangularGrid(center, 1024),
      createIsometricGrid(center, 1024),
    ];
    for (const grid of grids) {
      const cell = cellAt(grid, pt(540, 545));
      expect(cell, grid.kind).not.toBeNull();
      expect(cellAt(grid, cell!.center)?.key, grid.kind).toBe(cell!.key);
    }
    expect(cellAt(createHexagonalGrid(center, 1024), center)?.points).toHaveLength(6);
  });

  it("cuts concentric rings into the requested number of sectors", () => {
    const grid = createConcentricGrid(center, 1024);
    const right = cellAt(grid, pt(center.x + 200, center.y), { sectors: 4 });
    const left = cellAt(grid, pt(center.x - 200, center.y), { sectors: 4 });
    expect(right).not.toBeNull();
    expect(right?.key).not.toBe(left?.key);
    // Same ring, different sector: the ring index is shared.
    expect(right?.key.split("|")[2]).toBe(left?.key.split("|")[2]);
    expect(cellAt(grid, pt(center.x + 5000, center.y), { sectors: 4 })).toBeNull();
  });

  it("only offers cells on grids that have them", () => {
    expect(gridSupportsCells("square")).toBe(true);
    expect(gridSupportsCells("radial")).toBe(false);
    expect(gridSupportsCells("golden")).toBe(false);
    const grids = [createSquareGrid(center, 512), createRadialGrid(center, 512)];
    expect(paintableGrids(grids).map((g) => g.kind)).toEqual(["square"]);
  });

  it("keeps lattice snap points on the drawn grid lines", () => {
    for (const grid of [createTriangularGrid(center, 1024), createIsometricGrid(center, 1024)]) {
      const built = buildGridGeometry(grid);
      const sample = built.points.slice(0, 40);
      for (const p of sample) {
        expect(distanceToGrid(p, built)).toBeLessThan(1e-6);
      }
    }
  });
});
