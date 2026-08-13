import { intersection } from "polygon-clipping";
import { normalizeAngle, pointOnCircle, pt, rotatePoint } from "../core/geometry/math";
import type { Point } from "../core/geometry/types";
import type {
  ConcentricGrid,
  Grid,
  GridKind,
  HexagonalGrid,
  IsometricGrid,
  SquareGrid,
  TriangularGrid,
} from "./index";

/**
 * A single paintable region of a grid — the area enclosed by neighbouring grid
 * lines. Painting works by resolving the cell under the cursor and turning it
 * into a filled path object, so the drawn logo stays real vector geometry and
 * survives after the grid itself is hidden.
 */
export interface GridCell {
  /** Stable identity (`gridId|kind|indices`): the same cell always resolves to the same key. */
  key: string;
  /** Closed outline in world coordinates. */
  points: Point[];
  /** Centroid in world coordinates, used for hit feedback. */
  center: Point;
}

/** Grid kinds whose cells can be painted. Radial rays and golden rectangles have no uniform cell. */
const CELL_KINDS: GridKind[] = ["square", "concentric", "isometric", "triangular", "hexagonal"];

export const gridSupportsCells = (kind: GridKind): boolean => CELL_KINDS.includes(kind);

export interface CellOptions {
  /** Angular divisions used to cut concentric rings into paintable sectors. */
  sectors?: number;
  /** Rotation of the first sector boundary, in degrees. */
  sectorOffset?: number;
}

const RAD = Math.PI / 180;

/** World → grid-local: the exact inverse of the transform `buildGridGeometry` applies. */
const toLocal = (grid: Grid, p: Point): Point => {
  const s = grid.scale || 1;
  const moved = pt(p.x - grid.origin.x, p.y - grid.origin.y);
  const unrotated = rotatePoint(moved, -grid.rotation);
  return pt(unrotated.x / s, unrotated.y / s);
};

/** Grid-local → world. Mirrors `applyGrid` in the grid builder. */
const toWorld = (grid: Grid, p: Point): Point => {
  const scaled = pt(p.x * grid.scale, p.y * grid.scale);
  const rotated = rotatePoint(scaled, grid.rotation);
  return pt(rotated.x + grid.origin.x, rotated.y + grid.origin.y);
};

const centroid = (points: Point[]): Point => {
  if (points.length === 0) return pt(0, 0);
  let x = 0;
  let y = 0;
  for (const p of points) {
    x += p.x;
    y += p.y;
  }
  return pt(x / points.length, y / points.length);
};

const cell = (grid: Grid, key: string, local: Point[]): GridCell => {
  const points = local.map((p) => toWorld(grid, p));
  return { key: `${grid.id}|${key}`, points, center: centroid(points) };
};

const squareCell = (grid: SquareGrid, local: Point): GridCell | null => {
  const sub = Math.max(1, Math.round(grid.subdivisions));
  const step = grid.spacing / sub;
  if (!(step > 0)) return null;
  const half = grid.extent / 2;
  const steps = Math.floor(half / step);
  const i = Math.floor(local.x / step);
  const j = Math.floor(local.y / step);
  // The builder draws lines for indices -steps..steps, so cells live in -steps..steps-1.
  if (i < -steps || i >= steps || j < -steps || j >= steps) return null;
  return cell(grid, `sq|${i}|${j}`, [
    pt(i * step, j * step),
    pt((i + 1) * step, j * step),
    pt((i + 1) * step, (j + 1) * step),
    pt(i * step, (j + 1) * step),
  ]);
};

/** Solve `local = fi·u + fj·v` for the lattice coordinates of a point. */
const latticeCoords = (local: Point, u: Point, v: Point): Point | null => {
  const det = u.x * v.y - u.y * v.x;
  if (Math.abs(det) < 1e-9) return null;
  return pt((local.x * v.y - local.y * v.x) / det, (u.x * local.y - u.y * local.x) / det);
};

const basis = (angleDeg: number, length: number): Point =>
  pt(Math.cos(angleDeg * RAD) * length, Math.sin(angleDeg * RAD) * length);

/**
 * Rhombus cell of the two slanted axes. The axis length is derived from the
 * perpendicular line spacing so the cell lands exactly between drawn lines.
 */
const isometricCell = (grid: IsometricGrid, local: Point): GridCell | null => {
  const spacing = Math.max(1, grid.spacing);
  const sin2a = Math.sin(2 * grid.axisAngle * RAD);
  if (Math.abs(sin2a) < 1e-6) return null;
  const edge = spacing / Math.abs(sin2a);
  const u = basis(grid.axisAngle, edge);
  const v = basis(-grid.axisAngle, edge);
  const f = latticeCoords(local, u, v);
  if (!f) return null;
  const i = Math.floor(f.x);
  const j = Math.floor(f.y);
  const at = (a: number, b: number) => pt(a * u.x + b * v.x, a * u.y + b * v.y);
  const corners = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)];
  const half = grid.extent / 2;
  if (corners.some((p) => Math.abs(p.x) > half || Math.abs(p.y) > half)) return null;
  return cell(grid, `iso|${i}|${j}`, corners);
};

/** Up- or down-pointing triangle of the 0°/60°/-60° lattice. */
const triangularCell = (grid: TriangularGrid, local: Point): GridCell | null => {
  const spacing = Math.max(1, grid.spacing);
  const edge = (spacing * 2) / Math.sqrt(3);
  const u = basis(0, edge);
  const v = basis(60, edge);
  const f = latticeCoords(local, u, v);
  if (!f) return null;
  const i = Math.floor(f.x);
  const j = Math.floor(f.y);
  const at = (a: number, b: number) => pt(a * u.x + b * v.x, a * u.y + b * v.y);
  const up = f.x - i + (f.y - j) < 1;
  const corners = up
    ? [at(i, j), at(i + 1, j), at(i, j + 1)]
    : [at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)];
  const half = grid.extent / 2;
  if (corners.some((p) => Math.abs(p.x) > half || Math.abs(p.y) > half)) return null;
  return cell(grid, `tri|${i}|${j}|${up ? "u" : "d"}`, corners);
};

/** Cube rounding for axial hex coordinates. */
const roundAxial = (q: number, r: number): { q: number; r: number } => {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return { q: rq, r: rr };
};

const hexagonalCell = (grid: HexagonalGrid, local: Point): GridCell | null => {
  const size = Math.max(1, grid.size);
  const rings = Math.max(0, Math.round(grid.rings));
  const sqrt3 = Math.sqrt(3);
  // Inverse of `centerOf` in the hexagonal builder.
  const raw = grid.pointyTop
    ? (() => {
        const r = local.y / (1.5 * size);
        return { q: local.x / (sqrt3 * size) - r / 2, r };
      })()
    : (() => {
        const q = local.x / (1.5 * size);
        return { q, r: local.y / (sqrt3 * size) - q / 2 };
      })();
  const { q, r } = roundAxial(raw.q, raw.r);
  if (Math.abs(q) > rings || Math.abs(r) > rings || Math.abs(q + r) > rings) return null;
  const c = grid.pointyTop
    ? pt(size * sqrt3 * (q + r / 2), size * 1.5 * r)
    : pt(size * 1.5 * q, size * sqrt3 * (r + q / 2));
  const cornerOffset = grid.pointyTop ? 30 : 0;
  const corners: Point[] = [];
  for (let k = 0; k < 6; k += 1) {
    const a = (60 * k + cornerOffset) * RAD;
    corners.push(pt(c.x + size * Math.cos(a), c.y + size * Math.sin(a)));
  }
  return cell(grid, `hex|${q}|${r}`, corners);
};

/** Densely sampled ring-sector so a polar cell exports as a real closed path. */
const arcPoints = (
  center: Point,
  radius: number,
  startAngle: number,
  endAngle: number,
): Point[] => {
  const sweep = endAngle - startAngle;
  const steps = Math.max(2, Math.ceil(Math.abs(sweep) / 4));
  const out: Point[] = [];
  for (let i = 0; i <= steps; i += 1) {
    out.push(pointOnCircle(center, radius, startAngle + (sweep * i) / steps));
  }
  return out;
};

/**
 * Ring sector of a concentric grid. Radial divisions come from `options.sectors`
 * so the same cell grid can be shared with a radial grid drawn on top of it.
 */
const concentricCell = (
  grid: ConcentricGrid,
  world: Point,
  options: CellOptions,
): GridCell | null => {
  const local = toLocal(grid, world);
  const radius = Math.hypot(local.x, local.y);
  const step = Math.max(1, grid.radiusStep);
  const count = Math.max(1, Math.round(grid.count));
  const outer = grid.startRadius + (count - 1) * step;
  if (radius > outer) return null;

  // Ring -1 is the disc inside the first circle.
  const ring = radius < grid.startRadius ? -1 : Math.floor((radius - grid.startRadius) / step);
  const inner = ring < 0 ? 0 : grid.startRadius + ring * step;
  const outerR = ring < 0 ? grid.startRadius : inner + step;
  if (outerR <= 0) return null;

  const sectors = Math.max(1, Math.round(options.sectors ?? 12));
  const offset = options.sectorOffset ?? 0;
  const span = 360 / sectors;
  const angle = normalizeAngle(normalizeAngle(Math.atan2(local.y, local.x) / RAD) - offset);
  const index = Math.min(sectors - 1, Math.floor(angle / span));
  const startAngle = offset + index * span;
  const endAngle = startAngle + span;

  const origin = pt(0, 0);
  const points = [
    ...arcPoints(origin, outerR, startAngle, endAngle),
    ...(inner > 0 ? arcPoints(origin, inner, endAngle, startAngle) : [origin]),
  ];
  return cell(grid, `pol|${ring}|${index}|${sectors}`, points);
};

/** Resolve the grid cell containing `world`, or null when the point is outside the grid. */
export const cellAt = (grid: Grid, world: Point, options: CellOptions = {}): GridCell | null => {
  if (grid.scale <= 0) return null;
  switch (grid.kind) {
    case "square":
      return squareCell(grid, toLocal(grid, world));
    case "isometric":
      return isometricCell(grid, toLocal(grid, world));
    case "triangular":
      return triangularCell(grid, toLocal(grid, world));
    case "hexagonal":
      return hexagonalCell(grid, toLocal(grid, world));
    case "concentric":
      return concentricCell(grid, world, options);
    default:
      return null;
  }
};

/** The grid cells painting should target: visible, unlocked and cell-capable. */
export const paintableGrids = (grids: Grid[]): Grid[] =>
  grids.filter((g) => gridSupportsCells(g.kind) && !g.locked);

/**
 * Cells produced by *several* overlapping grids at once: the piece under the
 * cursor is the boolean intersection of every grid cell containing it. This is
 * what lets a square grid crossed by a concentric or isometric grid be painted
 * piece by piece instead of cell by cell.
 */
export const compoundCellAt = (
  grids: Grid[],
  world: Point,
  options: CellOptions = {},
): GridCell | null => {
  const hits = grids
    .map((g) => cellAt(g, world, options))
    .filter((c): c is GridCell => c !== null);
  if (hits.length === 0) return null;
  if (hits.length === 1) return hits[0]!;

  const ring = (c: GridCell): Ring => c.points.map((p) => [p.x, p.y] as Pair);
  let acc: Pair[][][] = [[ring(hits[0]!)]];
  for (let i = 1; i < hits.length; i += 1) {
    let next: Pair[][][] | null = null;
    try {
      next = intersection(acc as never, [[ring(hits[i]!)]] as never) as unknown as Pair[][][];
    } catch {
      // Degenerate/near-tangent rings can break the boolean solver; keep the
      // best piece resolved so far instead of crashing the canvas.
      next = null;
    }
    if (!next || next.length === 0) break;
    acc = next;
  }

  // Keep the piece the cursor actually sits in.
  const pieces = acc.map((poly) => poly[0]!).filter((r) => r && r.length >= 3);
  const chosen = pieces.find((r) => ringContains(r, world)) ?? pieces[0];
  if (!chosen) return null;
  const points = dedupe(chosen.map(([x, y]) => pt(x, y)));
  if (points.length < 3) return null;
  const key = hits
    .map((c) => c.key)
    .sort()
    .join("+");
  return { key, points, center: centroid(points) };
};

type Pair = [number, number];
type Ring = Pair[];

const ringContains = (ring: Ring, p: Point): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

/** Drops the repeated closing vertex and any duplicate samples. */
const dedupe = (points: Point[]): Point[] => {
  const out: Point[] = [];
  for (const p of points) {
    const prev = out[out.length - 1];
    if (prev && Math.abs(prev.x - p.x) < 1e-7 && Math.abs(prev.y - p.y) < 1e-7) continue;
    out.push(p);
  }
  const first = out[0];
  const last = out[out.length - 1];
  if (first && last && out.length > 1 && Math.abs(first.x - last.x) < 1e-7 && Math.abs(first.y - last.y) < 1e-7)
    out.pop();
  return out;
};
