import { normalizeAngle, pointOnCircle, pt, rotatePoint } from "../core/geometry/math";
import type { Geometry, Point } from "../core/geometry/types";

export type GridKind = "square" | "concentric" | "radial";

export interface GridBase {
  id: string;
  name: string;
  kind: GridKind;
  visible: boolean;
  locked: boolean;
  opacity: number;
  color: string;
  strokeWidth: number;
  /** Rotation in degrees around the grid origin. */
  rotation: number;
  scale: number;
  /** Grid origin in world coordinates. */
  origin: Point;
  /** Rendering weight: primary grids read stronger than secondary ones. */
  weight: "primary" | "secondary";
}

export interface SquareGrid extends GridBase {
  kind: "square";
  spacing: number;
  subdivisions: number;
  extent: number;
}

export interface ConcentricGrid extends GridBase {
  kind: "concentric";
  radiusStep: number;
  count: number;
  startRadius: number;
}

export interface RadialGrid extends GridBase {
  kind: "radial";
  rays: number;
  angleOffset: number;
  length: number;
}

export type Grid = SquareGrid | ConcentricGrid | RadialGrid;

export interface GridGeometry {
  /** Full-strength lines/circles (major divisions). */
  major: Geometry[];
  /** Subdivision lines (rendered fainter). */
  minor: Geometry[];
  /** Snappable grid points. */
  points: Point[];
}

const applyGrid = (grid: Grid, p: Point): Point => {
  const scaled = pt(p.x * grid.scale, p.y * grid.scale);
  const rotated = rotatePoint(scaled, grid.rotation);
  return pt(rotated.x + grid.origin.x, rotated.y + grid.origin.y);
};

const line = (a: Point, b: Point): Geometry => ({ kind: "line", a, b });

const buildSquare = (grid: SquareGrid): GridGeometry => {
  const major: Geometry[] = [];
  const minor: Geometry[] = [];
  const points: Point[] = [];
  const half = grid.extent / 2;
  const sub = Math.max(1, Math.round(grid.subdivisions));
  const step = grid.spacing / sub;
  const steps = Math.floor(half / step);
  for (let i = -steps; i <= steps; i += 1) {
    const v = i * step;
    const isMajor = Math.abs((i / sub) % 1) < 1e-9;
    const target = isMajor ? major : minor;
    target.push(line(applyGrid(grid, pt(v, -half)), applyGrid(grid, pt(v, half))));
    target.push(line(applyGrid(grid, pt(-half, v)), applyGrid(grid, pt(half, v))));
  }
  for (let i = -steps; i <= steps; i += 1) {
    for (let j = -steps; j <= steps; j += 1) {
      points.push(applyGrid(grid, pt(i * step, j * step)));
    }
  }
  return { major, minor, points };
};

const buildConcentric = (grid: ConcentricGrid): GridGeometry => {
  const major: Geometry[] = [];
  const points: Point[] = [];
  const center = applyGrid(grid, pt(0, 0));
  for (let i = 0; i < Math.max(1, Math.round(grid.count)); i += 1) {
    const radius = (grid.startRadius + i * grid.radiusStep) * grid.scale;
    if (radius <= 0) continue;
    major.push({ kind: "circle", center, radius });
    for (let a = 0; a < 360; a += 45) points.push(pointOnCircle(center, radius, a));
  }
  points.push(center);
  return { major, minor: [], points };
};

const buildRadial = (grid: RadialGrid): GridGeometry => {
  const major: Geometry[] = [];
  const points: Point[] = [];
  const center = applyGrid(grid, pt(0, 0));
  const rays = Math.max(1, Math.round(grid.rays));
  const length = grid.length * grid.scale;
  for (let i = 0; i < rays; i += 1) {
    const angle = normalizeAngle(grid.angleOffset + grid.rotation + (360 / rays) * i);
    const end = pointOnCircle(center, length, angle);
    major.push(line(center, end));
    points.push(end);
    points.push(pointOnCircle(center, length / 2, angle));
  }
  points.push(center);
  return { major, minor: [], points };
};

export const buildGridGeometry = (grid: Grid): GridGeometry => {
  switch (grid.kind) {
    case "square":
      return buildSquare(grid);
    case "concentric":
      return buildConcentric(grid);
    case "radial":
      return buildRadial(grid);
  }
};

let gridCounter = 0;
const nextGridId = (kind: GridKind): string => {
  gridCounter += 1;
  return `grid-${kind}-${gridCounter}`;
};

const base = (kind: GridKind, name: string, center: Point, weight: GridBase["weight"]) => ({
  id: nextGridId(kind),
  name,
  visible: true,
  locked: false,
  opacity: weight === "primary" ? 0.5 : 0.32,
  color: "#5b7bb5",
  strokeWidth: 1,
  rotation: 0,
  scale: 1,
  origin: center,
  weight,
});

export const createSquareGrid = (center: Point, size: number): SquareGrid => ({
  ...base("square", "Square Grid", center, "primary"),
  kind: "square",
  spacing: size / 8,
  subdivisions: 2,
  extent: size,
});

export const createConcentricGrid = (center: Point, size: number): ConcentricGrid => ({
  ...base("concentric", "Concentric Circles", center, "secondary"),
  kind: "concentric",
  startRadius: size / 16,
  radiusStep: size / 16,
  count: 8,
  color: "#7f6bd6",
});

export const createRadialGrid = (center: Point, size: number): RadialGrid => ({
  ...base("radial", "Radial Grid", center, "secondary"),
  kind: "radial",
  rays: 12,
  angleOffset: 0,
  length: size / 2,
  color: "#3f8f86",
});
