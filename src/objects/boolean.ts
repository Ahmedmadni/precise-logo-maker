import polygonClipping, { type Geom } from "polygon-clipping";
const { union, difference, intersection, xor } = polygonClipping;
import { arcSweep, pointOnCircle, sampledPathSegments } from "../core/geometry/math";
import type { Geometry, PathGeometry, Point } from "../core/geometry/types";

/** Illustrator-style pathfinder operations. */
export type BooleanOp = "union" | "subtract" | "intersect" | "exclude";

const CIRCLE_STEPS = 96;

/** Flatten any primitive into a closed ring of points (open shapes get closed). */
export const geometryToRing = (g: Geometry): Point[] => {
  switch (g.kind) {
    case "circle":
      return Array.from({ length: CIRCLE_STEPS }, (_, i) =>
        pointOnCircle(g.center, g.radius, (360 * i) / CIRCLE_STEPS),
      );
    case "arc": {
      const sweep = arcSweep(g);
      const steps = Math.max(8, Math.round((CIRCLE_STEPS * sweep) / 360));
      const pts = Array.from({ length: steps + 1 }, (_, i) =>
        pointOnCircle(g.center, g.radius, g.startAngle + (sweep * i) / steps),
      );
      // A wedge: closing through the centre keeps the arc's enclosed area.
      return [...pts, g.center];
    }
    case "line":
      return [g.a, g.b];
    case "path": {
      if (!g.cubicSegments?.some(Boolean)) return g.points;
      const segments = sampledPathSegments(g);
      if (!segments.length) return g.points;
      return [segments[0]![0], ...segments.map(([, end]) => end)];
    }
  }
};

const toPolygon = (g: Geometry): Geom | null => {
  // An open path or a line has no unambiguous filled area.
  if(g.kind==="line"||(g.kind==="path"&&!g.closed))return null;
  const ring = geometryToRing(g);
  if (ring.length < 3 || ring.length>50000 || ring.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y))) return null;
  const coords = ring.map((p) => [p.x, p.y] as [number, number]);
  const first = coords[0]!;
  const last = coords[coords.length - 1]!;
  if (first[0] !== last[0] || first[1] !== last[1]) coords.push(first);
  return [[coords]];
};

const RUNNERS = { union, subtract: difference, intersect: intersection, exclude: xor } as const;

export type BooleanResult =
  | {ok:true;parts:PathGeometry[]}
  | {ok:false;reason:"selection"|"invalid"|"holes"|"empty"|"complexity"};

/** Never return a partially computed result. Compound holes cannot yet be
 * represented by independent PathGeometry objects without filling the holes. */
export function booleanGeometryChecked(shapes:Geometry[],op:BooleanOp):BooleanResult{
  if(shapes.length<2)return {ok:false,reason:"selection"};
  if(shapes.length>100)return {ok:false,reason:"complexity"};
  const polys=shapes.map(toPolygon);
  if(polys.some(p=>p===null))return {ok:false,reason:"invalid"};
  const [head,...rest]=polys as Geom[];
  if(!head)return {ok:false,reason:"selection"};
  try{
    const result=RUNNERS[op](head,...rest);
    if(!result.length)return {ok:false,reason:"empty"};
    if(result.some(poly=>poly.length>1))return {ok:false,reason:"holes"};
    const out:PathGeometry[]=[];
    for(const poly of result){
      const points=poly[0]?.slice(0,-1).map(([x,y])=>({x,y}))??[];
      if(points.length<3||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return {ok:false,reason:"invalid"};
      out.push({kind:"path",points,closed:true});
    }
    return {ok:true,parts:out};
  }catch{return {ok:false,reason:"complexity"};}
}

/** Compatibility wrapper for existing geometry consumers. */
export const booleanGeometry=(shapes:Geometry[],op:BooleanOp):PathGeometry[]=>{
  const result=booleanGeometryChecked(shapes,op);
  return result.ok?result.parts:[];
};
