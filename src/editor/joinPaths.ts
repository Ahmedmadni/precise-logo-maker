import type {Geometry,PathGeometry,Point,CubicSegment,VectorObject} from "../core/geometry/types";

export type PathEnd="start"|"end";
export type JoinMode="line"|"smooth";
export const asOpenPath=(g:Geometry):PathGeometry|null=>{
  if(g.kind==="line")return {kind:"path",closed:false,points:[g.a,g.b]};
  return g.kind==="path"&&!g.closed&&!g.holes?.length&&g.points.length>=2?g:null;
};
export const eligibleJoinObject=(o:VectorObject)=>!o.locked&&o.visible&&!o.guide&&o.cellKey===undefined&&o.style.fill==="none"&&!!asOpenPath(o.geometry);
const controlsOf=(p:PathGeometry)=>Array.from({length:p.points.length-1},(_,i)=>p.cubicSegments?.[i]??null);
const finite=(p:Point)=>Number.isFinite(p.x)&&Number.isFinite(p.y);
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
const EPS=1e-7;

export function reverseOpenPath(p:PathGeometry):PathGeometry{
  const controls=controlsOf(p).reverse().map(c=>c?{control1:c.control2,control2:c.control1}:null);
  return {kind:"path",closed:false,points:[...p.points].reverse(),...(controls.some(Boolean)?{cubicSegments:[...controls,null]}:{})};
}

function unit(a:Point,b:Point):Point|null{
  const d=distance(a,b);
  return d>EPS&&Number.isFinite(d)?{x:(b.x-a.x)/d,y:(b.y-a.y)/d}:null;
}
export function nearestPathEnds(a:PathGeometry,b:PathGeometry):{a:PathEnd;b:PathEnd}{
  let best=Infinity,result:{a:PathEnd;b:PathEnd}={a:"end",b:"start"};
  for(const ae of ["end","start"] as const)for(const be of ["start","end"] as const){
    const d=distance(a.points[ae==="start"?0:a.points.length-1]!,b.points[be==="start"?0:b.points.length-1]!);
    if(d<best){best=d;result={a:ae,b:be};}
  }
  return result;
}

/** Join selected ends; source anchors and cubics are preserved exactly
 * (except coincident endpoints, which are represented by one anchor).
 * Smooth mode adds a cubic connector tangent to the neighboring segments. */
export function joinOpenPaths(a:Geometry,b:Geometry,aEnd:PathEnd,bEnd:PathEnd,mode:JoinMode="line"):PathGeometry|null{
  const first=asOpenPath(a),second=asOpenPath(b);
  if(!first||!second||!(["start","end"] as const).includes(aEnd)||!(["start","end"] as const).includes(bEnd)||!(["line","smooth"] as const).includes(mode))return null;
  const valid=(p:PathGeometry)=>p.points.every(finite)&&controlsOf(p).every(c=>!c||(finite(c.control1)&&finite(c.control2)));
  if(!valid(first)||!valid(second))return null;
  const left=aEnd==="end"?first:reverseOpenPath(first);
  const right=bEnd==="start"?second:reverseOpenPath(second);
  const lc=controlsOf(left),rc=controlsOf(right);
  const end=left.points.at(-1)!,start=right.points[0]!,gap=distance(end,start);
  if(!Number.isFinite(gap))return null;
  const coincident=end.x===start.x&&end.y===start.y;
  let bridge:CubicSegment|null=null;
  if(!coincident&&mode==="smooth"){
    const incoming=lc.at(-1);
    const outgoing=rc[0];
    const u=(incoming?unit(incoming.control2,end):null)??unit(left.points[left.points.length-2]!,end);
    const v=(outgoing?unit(start,outgoing.control1):null)??unit(start,right.points[1]!);
    if(!u||!v)return null;
    const length=gap/3;
    bridge={control1:{x:end.x+u.x*length,y:end.y+u.y*length},control2:{x:start.x-v.x*length,y:start.y-v.y*length}};
  }
  const points=[...left.points,...right.points.slice(coincident?1:0)];
  const segments=[...lc,...(coincident?[]:[bridge]),...rc];
  return {kind:"path",closed:false,points,...(segments.some(Boolean)?{cubicSegments:[...segments,null]}:{})};
}
