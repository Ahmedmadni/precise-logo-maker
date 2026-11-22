import { parseOutline } from "./pathEditor";
import { outlineBounds } from "./catalogGeometry";
import type { ContourRole, GlyphContour, JoinSide } from "./contourComposer";

export interface ContactCandidate {
  contourIndex: number;
  local: { x: number; y: number };
  role: ContourRole;
  /** Geometric boundary heuristic; not authored font-join metadata. */
  origin: "annotated" | "dominant";
}
type Point = { x: number; y: number };
const lerp = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t,
});
const quadratic = (a: Point, b: Point, c: Point, t: number): Point =>
  lerp(lerp(a,b,t),lerp(b,c,t),t);
const cubic = (a: Point, b: Point, c: Point, d: Point, t: number): Point =>
  quadratic(lerp(a,b,t),lerp(b,c,t),lerp(c,d,t),t);

/** Sample actual outline boundary rather than returning a point in the empty
 * middle of the axis-aligned bounding box. This never mutates the path. */
export function contourSidePoint(path: string, side: JoinSide): Point | null {
  const segments = parseOutline(path);
  if (!segments || segments.length === 0 || segments.length > 3000) return null;
  const samples: Point[]=[];
  let prev: Point={x:0,y:0}, start:Point={x:0,y:0};
  for (const seg of segments) {
    const v=seg.values;
    if (seg.cmd==="M") {
      prev={x:v[0]!,y:v[1]!};start=prev;samples.push(prev);
    } else if (seg.cmd==="L" || seg.cmd==="Z") {
      const end=seg.cmd==="Z"?start:{x:v[0]!,y:v[1]!};
      // Include intermediate points on long segments to find a plausible
      // connection height near the glyph's vertical center.
      for(let j=1;j<=16;j++)samples.push(lerp(prev,end,j/16));
      prev=end;
    } else if (seg.cmd==="Q") {
      const control={x:v[0]!,y:v[1]!},end={x:v[2]!,y:v[3]!};
      for(let j=1;j<=32;j++)samples.push(quadratic(prev,control,end,j/32));
      prev=end;
    } else if (seg.cmd==="C") {
      const p1={x:v[0]!,y:v[1]!},p2={x:v[2]!,y:v[3]!},
        end={x:v[4]!,y:v[5]!};
      for(let j=1;j<=32;j++)samples.push(cubic(prev,p1,p2,end,j/32));
      prev=end;
    }
  }
  if (!samples.length || samples.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return null;
  const xs=samples.map(p=>p.x),ys=samples.map(p=>p.y);
  const xMin=Math.min(...xs),xMax=Math.max(...xs),yMin=Math.min(...ys),yMax=Math.max(...ys);
  const extreme=side==="entry"?xMax:xMin, centerY=(yMin+yMax)/2;
  const threshold=Math.max(0.005, (xMax-xMin)*0.025);
  const edgeSamples=samples.filter(p=>Math.abs(p.x-extreme)<=threshold);
  if (!edgeSamples.length)return null;
  const found=edgeSamples.reduce((best,p)=>
    Math.abs(p.y-centerY)<Math.abs(best.y-centerY)?p:best);
  return {x:Number(found.x.toFixed(3)),y:Number(found.y.toFixed(3))};
}

/**
 * Prefer user-labeled joining anatomy, then a major body contour.
 * Dot/counter roles are excluded unless they are literally the only parts.
 * With no annotations, the dominant contour is selected by bounds area.
 * It never claims to infer authentic Arabic shaping from geometric guesses.
 */
export function selectJoiningContour(
  contours: GlyphContour[], roles: Record<string,ContourRole> | undefined,
  side: JoinSide,
): ContactCandidate | null {
  if (!contours.length)return null;
  const available=contours.map(c=>{
    const role=roles?.[String(c.index)]??"unassigned";
    const bounds=outlineBounds(c.path)??c.bounds;
    const area=Math.max(0,bounds.maxX-bounds.minX)*Math.max(0,bounds.maxY-bounds.minY);
    const length=Math.hypot(bounds.maxX-bounds.minX,bounds.maxY-bounds.minY);
    return {contour:c,role,area,length};
  });
  const eligible=available.some(item=>item.role!=="dot"&&item.role!=="counter")
    ? available.filter(item=>item.role!=="dot"&&item.role!=="counter")
    : available;
  const score=(role:ContourRole) =>
    role==="join"?0:
    (side==="entry"&&role==="head")||(side==="exit"&&role==="tail")?1:
    role==="body"?2:
    role==="unassigned"?3:
    role==="head"||role==="tail"?4:5;
  eligible.sort((a,b)=>score(a.role)-score(b.role) ||
    b.area-a.area || b.length-a.length || a.contour.index-b.contour.index);
  for(const item of eligible){
    const local=contourSidePoint(item.contour.path,side);
    if(local)return {contourIndex:item.contour.index,local,role:item.role,
      origin:item.role==="unassigned"?"dominant":"annotated"};
  }
  return null;
}
