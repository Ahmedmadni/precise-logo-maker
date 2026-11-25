import { arcSweep, pointOnCircle } from "../core/geometry/math";
import type { Geometry } from "../core/geometry/types";

const f = (n: number): string => (Math.abs(n) < 1e-9 ? "0" : n.toFixed(4));

/** Serialize any primitive to an SVG path `d` string in world coordinates. */
export const geometryToPathData = (g: Geometry): string => {
  switch (g.kind) {
    case "line":
      return `M ${f(g.a.x)} ${f(g.a.y)} L ${f(g.b.x)} ${f(g.b.y)}`;
    case "path": {
      const [first, ...rest] = g.points;
      if (!first) return "";
      const edge = (p: typeof first, i: number) => {
        const c = g.cubicSegments?.[i];
        if (!c || ![c.control1.x, c.control1.y, c.control2.x, c.control2.y].every(Number.isFinite)) return `L ${f(p.x)} ${f(p.y)}`;
        return `C ${f(c.control1.x)} ${f(c.control1.y)} ${f(c.control2.x)} ${f(c.control2.y)} ${f(p.x)} ${f(p.y)}`;
      };
      const parts = rest.map(edge);
      if (g.closed && g.cubicSegments?.[g.points.length - 1]) parts.push(edge(first, g.points.length - 1));
      const body = parts.join(" ");
      const outer=`M ${f(first.x)} ${f(first.y)}${body ? ` ${body}` : ""}${g.closed ? " Z" : ""}`;
      const holes=g.closed?(g.holes??[]).filter(r=>r.length>=3).map(r=>`M ${f(r[0]!.x)} ${f(r[0]!.y)} ${r.slice(1).map(p=>`L ${f(p.x)} ${f(p.y)}`).join(" ")} Z`):[];
      return [outer,...holes].join(" ");
    }
    case "circle": {
      const { center: c, radius: r } = g;
      return [
        `M ${f(c.x - r)} ${f(c.y)}`,
        `A ${f(r)} ${f(r)} 0 1 0 ${f(c.x + r)} ${f(c.y)}`,
        `A ${f(r)} ${f(r)} 0 1 0 ${f(c.x - r)} ${f(c.y)}`,
        "Z",
      ].join(" ");
    }
    case "arc": {
      const sweep = arcSweep(g);
      if (sweep >= 359.999) {
        return geometryToPathData({ kind: "circle", center: g.center, radius: g.radius });
      }
      const start = pointOnCircle(g.center, g.radius, g.startAngle);
      const end = pointOnCircle(g.center, g.radius, g.endAngle);
      const largeArc = sweep > 180 ? 1 : 0;
      return `M ${f(start.x)} ${f(start.y)} A ${f(g.radius)} ${f(g.radius)} 0 ${largeArc} 1 ${f(end.x)} ${f(end.y)}`;
    }
  }
};
