import { normalizeAngle, pointOnCircle, pt, rotatePoint } from "../core/geometry/math";
import type { Geometry, Point } from "../core/geometry/types";

export type GridKind =
  | "square"
  | "concentric"
  | "radial"
  | "isometric"
  | "triangular"
  | "hexagonal"
  | "golden";

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

export interface IsometricGrid extends GridBase {
  kind: "isometric";
  spacing: number;
  extent: number;
  /** Axis angle in degrees from horizontal (30° = classic isometric). */
  axisAngle: number;
}

export interface TriangularGrid extends GridBase {
  kind: "triangular";
  spacing: number;
  extent: number;
}

export interface HexagonalGrid extends GridBase {
  kind: "hexagonal";
  /** Circumradius of a single hexagon. */
  size: number;
  /** Number of rings around the centre hexagon. */
  rings: number;
  /** Flat-top or pointy-top orientation. */
  pointyTop: boolean;
}

export interface GoldenGrid extends GridBase {
  kind: "golden";
  width: number;
  height: number;
  /** Number of golden subdivisions. */
  steps: number;
  /** Draw the quarter-circle spiral arcs. */
  spiral: boolean;
}

export type Grid =
  | SquareGrid
  | ConcentricGrid
  | RadialGrid
  | IsometricGrid
  | TriangularGrid
  | HexagonalGrid
  | GoldenGrid;

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

const RAD = Math.PI / 180;

/** A line of given angle offset perpendicular by `offset`, clipped to `half` length. */
const angledLine = (grid: Grid, angleDeg: number, offset: number, half: number): Geometry => {
  const a = angleDeg * RAD;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const px = -uy * offset;
  const py = ux * offset;
  return line(
    applyGrid(grid, pt(px - ux * half, py - uy * half)),
    applyGrid(grid, pt(px + ux * half, py + uy * half)),
  );
};

const latticePoints = (
  grid: Grid,
  angleA: number,
  angleB: number,
  spacing: number,
  steps: number,
): Point[] => {
  const out: Point[] = [];
  const ax = Math.cos(angleA * RAD) * spacing;
  const ay = Math.sin(angleA * RAD) * spacing;
  const bx = Math.cos(angleB * RAD) * spacing;
  const by = Math.sin(angleB * RAD) * spacing;
  for (let i = -steps; i <= steps; i += 1) {
    for (let j = -steps; j <= steps; j += 1) {
      out.push(applyGrid(grid, pt(i * ax + j * bx, i * ay + j * by)));
    }
  }
  return out;
};

const buildIsometric = (grid: IsometricGrid): GridGeometry => {
  const major: Geometry[] = [];
  const half = grid.extent / 2;
  const spacing = Math.max(1, grid.spacing);
  const steps = Math.floor(half / spacing);
  const angles = [grid.axisAngle, -grid.axisAngle, 90];
  for (const angle of angles) {
    for (let i = -steps; i <= steps; i += 1) {
      major.push(angledLine(grid, angle, i * spacing, half * 2));
    }
  }
  return {
    major,
    minor: [],
    points: latticePoints(grid, grid.axisAngle, -grid.axisAngle, spacing, steps),
  };
};

const buildTriangular = (grid: TriangularGrid): GridGeometry => {
  const major: Geometry[] = [];
  const half = grid.extent / 2;
  const spacing = Math.max(1, grid.spacing);
  const steps = Math.floor(half / spacing);
  for (const angle of [0, 60, -60]) {
    for (let i = -steps; i <= steps; i += 1) {
      major.push(angledLine(grid, angle, i * spacing, half * 2));
    }
  }
  return { major, minor: [], points: latticePoints(grid, 0, 60, spacing, steps) };
};

const buildHexagonal = (grid: HexagonalGrid): GridGeometry => {
  const major: Geometry[] = [];
  const points: Point[] = [];
  const size = Math.max(1, grid.size);
  const rings = Math.max(0, Math.round(grid.rings));
  const cornerOffset = grid.pointyTop ? 30 : 0;
  const centerOf = (q: number, r: number): Point =>
    grid.pointyTop
      ? pt(size * Math.sqrt(3) * (q + r / 2), size * 1.5 * r)
      : pt(size * 1.5 * q, size * Math.sqrt(3) * (r + q / 2));

  for (let q = -rings; q <= rings; q += 1) {
    for (let r = -rings; r <= rings; r += 1) {
      if (Math.abs(q + r) > rings) continue;
      const c = centerOf(q, r);
      const corners: Point[] = [];
      for (let k = 0; k < 6; k += 1) {
        const a = (60 * k + cornerOffset) * RAD;
        corners.push(applyGrid(grid, pt(c.x + size * Math.cos(a), c.y + size * Math.sin(a))));
      }
      for (let k = 0; k < 6; k += 1) {
        const a = corners[k]!;
        const b = corners[(k + 1) % 6]!;
        major.push(line(a, b));
        points.push(a);
      }
      points.push(applyGrid(grid, c));
    }
  }
  return { major, minor: [], points };
};

const PHI = (1 + Math.sqrt(5)) / 2;

const buildGolden = (grid: GoldenGrid): GridGeometry => {
  const major: Geometry[] = [];
  const minor: Geometry[] = [];
  const points: Point[] = [];
  let x = -grid.width / 2;
  let y = -grid.height / 2;
  let w = grid.width;
  let h = grid.height;

  const rect = (rx: number, ry: number, rw: number, rh: number, target: Geometry[]) => {
    const c = [
      pt(rx, ry),
      pt(rx + rw, ry),
      pt(rx + rw, ry + rh),
      pt(rx, ry + rh),
    ].map((p) => applyGrid(grid, p));
    for (let k = 0; k < 4; k += 1) {
      target.push(line(c[k]!, c[(k + 1) % 4]!));
      points.push(c[k]!);
    }
  };

  rect(x, y, w, h, major);
  const steps = Math.max(1, Math.round(grid.steps));
  for (let i = 0; i < steps; i += 1) {
    const horizontal = i % 2 === 0;
    if (horizontal) {
      const cut = w / PHI;
      rect(x, y, cut, h, minor);
      if (grid.spiral) {
        const cx = i % 4 === 0 ? x + cut : x + cut;
        const cy = i % 4 === 0 ? y + h : y;
        const start = i % 4 === 0 ? 180 : 90;
        major.push({
          kind: "arc",
          center: applyGrid(grid, pt(cx, cy)),
          radius: cut * grid.scale,
          startAngle: normalizeAngle(start + grid.rotation),
          endAngle: normalizeAngle(start + 90 + grid.rotation),
        });
      }
      x += cut;
      w -= cut;
    } else {
      const cut = h / PHI;
      rect(x, y, w, cut, minor);
      if (grid.spiral) {
        const cx = x;
        const cy = y + cut;
        const start = i % 4 === 1 ? 270 : 0;
        major.push({
          kind: "arc",
          center: applyGrid(grid, pt(cx, cy)),
          radius: cut * grid.scale,
          startAngle: normalizeAngle(start + grid.rotation),
          endAngle: normalizeAngle(start + 90 + grid.rotation),
        });
      }
      y += cut;
      h -= cut;
    }
    if (w < 1 || h < 1) break;
  }
  points.push(applyGrid(grid, pt(0, 0)));
  return { major, minor, points };
};

export const buildGridGeometry = (grid: Grid): GridGeometry => {
  switch (grid.kind) {
    case "square":
      return buildSquare(grid);
    case "concentric":
      return buildConcentric(grid);
    case "radial":
      return buildRadial(grid);
    case "isometric":
      return buildIsometric(grid);
    case "triangular":
      return buildTriangular(grid);
    case "hexagonal":
      return buildHexagonal(grid);
    case "golden":
      return buildGolden(grid);
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

export const createIsometricGrid = (center: Point, size: number): IsometricGrid => ({
  ...base("isometric", "Isometric Grid", center, "secondary"),
  kind: "isometric",
  spacing: size / 16,
  extent: size,
  axisAngle: 30,
  color: "#4f8ccc",
});

export const createTriangularGrid = (center: Point, size: number): TriangularGrid => ({
  ...base("triangular", "Triangular Grid", center, "secondary"),
  kind: "triangular",
  spacing: size / 16,
  extent: size,
  color: "#cc8f4f",
});

export const createHexagonalGrid = (center: Point, size: number): HexagonalGrid => ({
  ...base("hexagonal", "Hexagonal Grid", center, "secondary"),
  kind: "hexagonal",
  size: size / 16,
  rings: 5,
  pointyTop: true,
  color: "#4fbfa0",
});

export const createGoldenGrid = (center: Point, size: number): GoldenGrid => ({
  ...base("golden", "Golden Ratio", center, "primary"),
  kind: "golden",
  width: size,
  height: size / ((1 + Math.sqrt(5)) / 2),
  steps: 8,
  spiral: true,
  color: "#d4a24c",
});

export const createGrid = (kind: GridKind, center: Point, size: number): Grid => {
  switch (kind) {
    case "square":
      return createSquareGrid(center, size);
    case "concentric":
      return createConcentricGrid(center, size);
    case "radial":
      return createRadialGrid(center, size);
    case "isometric":
      return createIsometricGrid(center, size);
    case "triangular":
      return createTriangularGrid(center, size);
    case "hexagonal":
      return createHexagonalGrid(center, size);
    case "golden":
      return createGoldenGrid(center, size);
  }
};
