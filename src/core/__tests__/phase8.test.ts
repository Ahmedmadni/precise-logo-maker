import { describe, expect, it } from "vitest";
import { pt } from "../geometry/math";
import { cellAt, compoundCellAt } from "../../grids/cells";
import { createConcentricGrid, createSquareGrid } from "../../grids";
import { smoothPolyline } from "../tracing/simplify";

const polygonArea = (points: { x: number; y: number }[]): number => {
  let a = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    a += points[j]!.x * points[i]!.y - points[i]!.x * points[j]!.y;
  }
  return Math.abs(a / 2);
};

describe("compound grid cells", () => {
  const center = pt(512, 512);
  const square = createSquareGrid(center, 1024);
  const concentric = createConcentricGrid(center, 1024);

  it("returns the single cell when only one grid participates", () => {
    const probe = pt(600, 540);
    const one = compoundCellAt([square], probe);
    const direct = cellAt(square, probe);
    expect(one?.key).toBe(direct?.key);
  });

  it("intersects overlapping grids into a smaller piece", () => {
    const probe = pt(600, 540);
    const sq = cellAt(square, probe, { sectors: 12 })!;
    const piece = compoundCellAt([square, concentric], probe, { sectors: 12 });
    expect(piece).not.toBeNull();
    expect(polygonArea(piece!.points)).toBeLessThanOrEqual(polygonArea(sq.points) + 1e-6);
    expect(piece!.key).toContain("+");
  });

  it("gives a stable key for the same piece", () => {
    const a = compoundCellAt([square, concentric], pt(600, 540), { sectors: 12 });
    const b = compoundCellAt([square, concentric], pt(601, 541), { sectors: 12 });
    expect(a?.key).toBe(b?.key);
  });
});

describe("corner preserving smoothing", () => {
  it("keeps a sharp corner in place while averaging noise", () => {
    const points = [pt(0, 0), pt(10, 0), pt(20, 0), pt(20, 10), pt(20, 20)];
    const smoothed = smoothPolyline(points, 3, 40);
    expect(smoothed.some((p) => p.x === 20 && p.y === 0)).toBe(true);
  });

  it("rounds the corner off when corner keeping is disabled", () => {
    const points = [pt(0, 0), pt(10, 0), pt(20, 0), pt(20, 10), pt(20, 20)];
    const smoothed = smoothPolyline(points, 3, 0);
    expect(smoothed.some((p) => p.x === 20 && p.y === 0)).toBe(false);
  });
});
