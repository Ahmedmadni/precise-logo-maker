import { describe, expect, it } from "vitest";
import { pt } from "../geometry/math";
import { DEFAULT_SNAP_SETTINGS, resolveSnap, type SnapInput } from "../snapping/snap";
import { buildGridGeometry, createConcentricGrid, createRadialGrid, createSquareGrid } from "../../grids";

const baseInput = (over: Partial<SnapInput>): SnapInput => ({
  cursor: pt(0, 0),
  tolerance: 10,
  gridPoints: [],
  gridGeometry: [],
  objectGeometry: [],
  settings: DEFAULT_SNAP_SETTINGS,
  ...over,
});

describe("snap engine", () => {
  it("returns null when nothing is in range", () => {
    expect(resolveSnap(baseInput({ gridPoints: [pt(500, 500)] }))).toBeNull();
  });

  it("snaps to a grid point when it is the only candidate", () => {
    const r = resolveSnap(baseInput({ cursor: pt(3, 3), gridPoints: [pt(0, 0)] }));
    expect(r?.type).toBe("grid");
  });

  it("prefers an intersection over a nearer grid point", () => {
    const r = resolveSnap(
      baseInput({
        cursor: pt(1, 1),
        gridPoints: [pt(0.5, 0.5)],
        objectGeometry: [
          { kind: "line", a: pt(-10, 0), b: pt(10, 0) },
          { kind: "line", a: pt(0, -10), b: pt(0, 10) },
        ],
      }),
    );
    expect(r?.type).toBe("intersection");
    expect(r?.point.x).toBeCloseTo(0);
  });

  it("honours disabled snap types", () => {
    const settings = {
      ...DEFAULT_SNAP_SETTINGS,
      types: { ...DEFAULT_SNAP_SETTINGS.types, grid: false },
    };
    expect(resolveSnap(baseInput({ cursor: pt(1, 1), gridPoints: [pt(0, 0)], settings }))).toBeNull();
  });

  it("returns null when snapping is off", () => {
    const settings = { ...DEFAULT_SNAP_SETTINGS, enabled: false };
    expect(resolveSnap(baseInput({ gridPoints: [pt(0, 0)], settings }))).toBeNull();
  });
});

describe("grid engine", () => {
  it("builds square grid geometry with subdivisions", () => {
    const grid = createSquareGrid(pt(0, 0), 100);
    const built = buildGridGeometry({ ...grid, spacing: 50, subdivisions: 2, extent: 100 });
    expect(built.major.length).toBeGreaterThan(0);
    expect(built.minor.length).toBeGreaterThan(0);
    expect(built.points.length).toBeGreaterThan(0);
  });

  it("builds one circle per concentric ring", () => {
    const grid = { ...createConcentricGrid(pt(10, 10), 100), count: 4, startRadius: 10, radiusStep: 10 };
    const built = buildGridGeometry(grid);
    expect(built.major).toHaveLength(4);
    expect(built.major.every((g) => g.kind === "circle")).toBe(true);
  });

  it("builds one ray per radial division", () => {
    const grid = { ...createRadialGrid(pt(0, 0), 100), rays: 12 };
    const built = buildGridGeometry(grid);
    expect(built.major).toHaveLength(12);
  });
});
