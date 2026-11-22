import type { LetteringItem } from "./model";
import { sampleRibbon } from "./ribbonJoin";

type Point={x:number;y:number};
const cross=(a:Point,b:Point,c:Point)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const finite=(p:Point)=>Number.isFinite(p.x)&&Number.isFinite(p.y);
/** Strict line-segment intersection: shared adjacent polyline endpoints are
 * handled at the caller, and near-tangent contacts are not false positives. */
export function strictSegmentIntersection(a:Point,b:Point,c:Point,d:Point): boolean {
  if (![a,b,c,d].every(finite))return false;
  const p=cross(a,b,c),q=cross(a,b,d),r=cross(c,d,a),s=cross(c,d,b);
  const scale=Math.max(1,Math.hypot(b.x-a.x,b.y-a.y),Math.hypot(d.x-c.x,d.y-c.y));
  const eps=1e-9*scale*scale;
  return (p>eps&&q < -eps || p < -eps&&q>eps) &&
    (r>eps&&s < -eps || r < -eps&&s>eps);
}

/** Count crossings of the sampled ribbon's two long edges.
 * This is a preflight warning, not a proof that its curved SVG Bézier edges
 * will be free of all self-intersections between samples. */
export function ribbonEdgeCrossings(
  left:Point[], right:Point[],
):number{
  if(left.length!==right.length || left.length<2 || left.length>65)return 0;
  let crosses=0;
  const test=(a:Point[],b:Point[],same:boolean)=>{
    for(let i=0;i<a.length-1;i++)for(let j=0;j<b.length-1;j++){
      if(same && Math.abs(i-j)<=1)continue;
      if(strictSegmentIntersection(a[i]!,a[i+1]!,b[j]!,b[j+1]!))
        crosses++;
    }
  };
  test(left,left,true);
  test(right,right,true);
  test(left,right,false);
  return crosses;
}
export interface RibbonSafety {
  distance:number;
  maxWidth:number;
  widthRatio:number;
  edgeCrossings:number;
  sharpTurns:number;
  /** Cautions only; not a measured quality score of Arabic lettering. */
  needsReview:boolean;
}
export function analyzeRibbonSafety(
  bridge:LetteringItem, all:LetteringItem[],
):RibbonSafety|null {
  const samples=sampleRibbon(bridge,all,48);
  if(!samples)return null;
  const first=samples[0]!.center,last=samples.at(-1)!.center;
  const distance=Math.hypot(last.x-first.x,last.y-first.y);
  const maxWidth=Math.max(...samples.map(s=>s.width));
  if(distance<1e-6 || !Number.isFinite(maxWidth))return null;
  const left=samples.map(s=>({
    x:s.center.x+s.normal.x*s.width/2,
    y:s.center.y+s.normal.y*s.width/2,
  }));
  const right=samples.map(s=>({
    x:s.center.x-s.normal.x*s.width/2,
    y:s.center.y-s.normal.y*s.width/2,
  }));
  let sharpTurns=0;
  for(let i=1;i<samples.length;i++){
    const a=samples[i-1]!.normal,b=samples[i]!.normal;
    const dot=Math.max(-1,Math.min(1,a.x*b.x+a.y*b.y));
    if(Math.acos(dot)>Math.PI/4)sharpTurns++;
  }
  const edgeCrossings=ribbonEdgeCrossings(left,right),widthRatio=maxWidth/distance;
  return {distance,maxWidth,widthRatio,edgeCrossings,sharpTurns,
    needsReview:edgeCrossings>0||sharpTurns>0||widthRatio>0.7};
}
