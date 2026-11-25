import polygonClipping, { type Geom } from "polygon-clipping";
const { union, difference, intersection, xor } = polygonClipping;
import { arcSweep, pointOnCircle, closestPointOnSegment, dist } from "../core/geometry/math";
import type { Geometry, PathGeometry, Point } from "../core/geometry/types";

/** Illustrator-style pathfinder operations. */
export type BooleanOp = "union" | "subtract" | "intersect" | "exclude";

export const BOOLEAN_TOLERANCE=0.25;
const MAX_RING_POINTS=50000;
const finite=(p:Point)=>Number.isFinite(p.x)&&Number.isFinite(p.y);
const midpoint=(a:Point,b:Point):Point=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});

/** Flatten a cubic by recursive subdivision until the control hull lies
 * within tolerance of the finite chord. Reject rather than silently exceed
 * the point/depth budget. */
function flattenCubic(a:Point,b:Point,c:Point,d:Point,out:Point[],depth=0):boolean{
  if(![a,b,c,d].every(finite)||out.length>=MAX_RING_POINTS)return false;
  const error=Math.max(dist(b,closestPointOnSegment(a,d,b)),dist(c,closestPointOnSegment(a,d,c)));
  if(error<=BOOLEAN_TOLERANCE){out.push(d);return true;}
  if(depth>=20)return false;
  const ab=midpoint(a,b),bc=midpoint(b,c),cd=midpoint(c,d);
  const abc=midpoint(ab,bc),bcd=midpoint(bc,cd),m=midpoint(abc,bcd);
  return flattenCubic(a,ab,abc,m,out,depth+1)&&flattenCubic(m,bcd,cd,d,out,depth+1);
}

function circularSteps(radius:number,sweep:number):number{
  if(!Number.isFinite(radius)||radius<=0||!Number.isFinite(sweep)||sweep<=0)return 0;
  // Sagitta bound: r * (1 - cos(theta/2)) <= tolerance.
  const angle=2*Math.acos(Math.max(-1,Math.min(1,1-BOOLEAN_TOLERANCE/radius)));
  const steps=Math.max(8,Math.ceil(sweep*Math.PI/180/angle));
  return Number.isFinite(steps)&&steps<MAX_RING_POINTS?steps:0;
}

/** Polygonal approximation in artboard units, matching the filled SVG
 * contour. Partial arcs close along their chord, not through the center. */
export const geometryToRing=(g:Geometry):Point[]=>{
  switch(g.kind){
    case "circle":{
      const steps=circularSteps(g.radius,360);
      return Array.from({length:steps},(_,i)=>pointOnCircle(g.center,g.radius,360*i/steps));
    }
    case "arc":{
      const sweep=arcSweep(g),steps=circularSteps(g.radius,sweep);
      if(!steps)return [];
      const full=sweep>=359.999;
      return Array.from({length:steps+(full?0:1)},(_,i)=>pointOnCircle(g.center,g.radius,g.startAngle+sweep*i/steps));
    }
    case "line":return [g.a,g.b];
    case "path":{
      if(!g.cubicSegments?.some(Boolean))return g.points;
      if(!g.points.length||g.points.length>MAX_RING_POINTS)return [];
      const out=[g.points[0]!],count=g.closed?g.points.length:g.points.length-1;
      for(let i=0;i<count;i++){
        const a=g.points[i]!,d=g.points[(i+1)%g.points.length]!,c=g.cubicSegments[i];
        if(c){if(!flattenCubic(a,c.control1,c.control2,d,out))return [];}
        else {if(out.length>=MAX_RING_POINTS)return [];out.push(d);}
      }
      if(g.closed)out.pop();
      return out;
    }
  }
};

const toPolygon = (g: Geometry): Geom | null => {
  // An open path or a line has no unambiguous filled area.
  if(g.kind==="line"||(g.kind==="path"&&!g.closed))return null;
  const rings=[geometryToRing(g),...(g.kind==="path"?g.holes??[]:[])];
  if(rings.length>1000||rings.reduce((sum,r)=>sum+r.length,0)>50000)return null;
  if(rings.some(r=>r.length<3||r.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y))))return null;
  const coords=rings.map(ring=>{
    const points=ring.map(p=>[p.x,p.y] as [number,number]);
    const first=points[0]!,last=points[points.length-1]!;
    if(first[0]!==last[0]||first[1]!==last[1])points.push(first);
    return points;
  });
  return [coords];
};

const RUNNERS = { union, subtract: difference, intersect: intersection, exclude: xor } as const;

export type BooleanResult =
  | {ok:true;parts:PathGeometry[]}
  | {ok:false;reason:"selection"|"invalid"|"holes"|"empty"|"complexity"};

/** Each resulting polygon keeps its inner rings in one compound path. */
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
    const out:PathGeometry[]=[];
    for(const poly of result){
      const rings=poly.map(r=>r.slice(0,-1).map(([x,y])=>({x,y})));
      const [points,...holes]=rings;
      if(!points||rings.some(r=>r.length<3||r.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y))))return {ok:false,reason:"invalid"};
      out.push({kind:"path",points,closed:true,...(holes.length?{holes}:{})});
    }
    return {ok:true,parts:out};
  }catch{return {ok:false,reason:"complexity"};}
}

/** Compatibility wrapper for existing geometry consumers. */
export const booleanGeometry=(shapes:Geometry[],op:BooleanOp):PathGeometry[]=>{
  const result=booleanGeometryChecked(shapes,op);
  return result.ok?result.parts:[];
};
