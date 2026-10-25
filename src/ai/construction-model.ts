import type { ConstructionSpec } from "./construction.functions";
import { createGrid, type Grid } from "../grids";
import type { Geometry } from "../core/geometry/types";

const n = (v: number | null, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);

export function buildGrids(spec: ConstructionSpec, w: number, h: number): Grid[] {
  const center = { x: w / 2, y: h / 2 };
  const size = Math.max(w, h);
  return spec.grids.slice(0, 4).flatMap((g) => {
    const kinds = ["square", "concentric", "radial", "isometric", "triangular", "hexagonal", "golden"];
    if (!kinds.includes(g.kind)) return [];
    const base = createGrid(g.kind as Grid["kind"], center, size) as unknown as Record<string, unknown>;
    const patch: Record<string, unknown> = { rotation: n(g.rotation, base["rotation"] as number) };
    if (g.spacing && g.spacing > 2) {
      if ("spacing" in base) patch["spacing"] = g.spacing;
      if ("radiusStep" in base) patch["radiusStep"] = g.spacing;
      if ("size" in base) patch["size"] = g.spacing;
    }
    if (g.count && "count" in base) patch["count"] = Math.min(40, Math.round(g.count));
    if (g.count && "rings" in base) patch["rings"] = Math.min(12, Math.round(g.count));
    if (g.rays && "rays" in base) patch["rays"] = Math.min(72, Math.round(g.rays));
    return [{ ...base, ...patch } as unknown as Grid];
  });
}

export function buildShapes(spec: ConstructionSpec) {
  return spec.shapes.slice(0, 40).flatMap((s) => {
    let geometry: Geometry | null = null;
    if (s.type === "circle" && s.r)
      geometry = { kind: "circle", center: { x: n(s.cx, 0), y: n(s.cy, 0) }, radius: s.r };
    else if (s.type === "arc" && s.r)
      geometry = {
        kind: "arc",
        center: { x: n(s.cx, 0), y: n(s.cy, 0) },
        radius: s.r,
        startAngle: n(s.start, 0),
        endAngle: n(s.end, 180),
      };
    else if (s.type === "line")
      geometry = { kind: "line", a: { x: n(s.x1, 0), y: n(s.y1, 0) }, b: { x: n(s.x2, 0), y: n(s.y2, 0) } };
    else if (s.type === "path" && s.points && s.points.length >= 2)
      geometry = { kind: "path", points: s.points, closed: !!s.closed };
    if (!geometry) return [];
    const guide = s.role === "guide";
    const fill = s.fill && /^#[0-9a-f]{3,8}$/i.test(s.fill) ? s.fill : "none";
    return [{ geometry, guide, style: guide ? undefined : { fill, fillOpacity: 1 } }];
  });
}

