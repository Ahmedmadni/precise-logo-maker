import type { LetteringItem } from "./model";
import { isValidRibbon, sampleRibbon, type RibbonLink } from "./ribbonJoin";

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


export interface RibbonSafetySuggestion {
  /** Proposed parameters only. The user must explicitly apply the change. */
  ribbon: RibbonLink;
  before: RibbonSafety;
  after: RibbonSafety;
  changes: string[];
}

/** Smaller is better. Crossed edges take priority over turns and proportions. */
const diagnosticSeverity = (s:RibbonSafety):number =>
  s.edgeCrossings*10000 + s.sharpTurns*1000 + Math.max(0,s.widthRatio-0.7)*100;

/**
 * Conservatively suggest narrower widths / gentler joins using the *same*
 * geometry analyzer that is shown in the inspector.
 *
 * Neither alters the original letter outlines nor claims an authentic
 * calligraphic weld. This is a sampled geometric recommendation; some
 * high-curvature paths cannot be repaired within allowed ribbon settings.
 */
export function suggestRibbonSafetyAdjustment(
  bridge:LetteringItem, all:LetteringItem[],
):RibbonSafetySuggestion|null {
  if (bridge.kind!=="bridge" || !bridge.ribbon) return null;
  const before=analyzeRibbonSafety(bridge,all);
  if(!before?.needsReview)return null;

  let spec:RibbonLink={...bridge.ribbon};
  let safety=before;
  const changes:string[]=[];
  const propose=(patch:Partial<RibbonLink>,label:string):boolean=>{
    const next={...spec,...patch};
    if (!isValidRibbon(next) ||
      next.startWidth===spec.startWidth && next.endWidth===spec.endWidth &&
      next.curvature===spec.curvature && next.startAngle===spec.startAngle &&
      next.endAngle===spec.endAngle) return false;
    const assessment=analyzeRibbonSafety({...bridge,ribbon:next},all);
    if(!assessment)return false;
    const oldScore=diagnosticSeverity(safety), newScore=diagnosticSeverity(assessment);
    if (newScore>=oldScore-0.000001 ||
      assessment.edgeCrossings>safety.edgeCrossings ||
      assessment.sharpTurns>safety.sharpTurns) return false;
    spec=next;
    safety=assessment;
    changes.push(label);
    return true;
  };

  // Width scales linearly, including the existing nib modulation.
  // Leave a little more clearance than the 70% advisory threshold.
  if(safety.widthRatio>0.65){
    const ratio=Math.min(1,0.6/safety.widthRatio);
    propose({
      startWidth:Math.max(0.8,Number((spec.startWidth*ratio).toFixed(3))),
      endWidth:Math.max(0.8,Number((spec.endWidth*ratio).toFixed(3))),
    },"تقليل سُمك الوصلة مقارنة بمسافتها");
  }
  if(safety.needsReview){
    for(const factor of [0.85,0.7,0.55,0.4]){
      if(!safety.edgeCrossings)break;
      propose({startWidth:Math.max(0.8,Number((spec.startWidth*factor).toFixed(3))),
        endWidth:Math.max(0.8,Number((spec.endWidth*factor).toFixed(3)))},
      "تقليل تداخل الحواف");
    }
    for(const factor of [0.75,0.5,0.25,0]){
      if(!safety.edgeCrossings&&!safety.sharpTurns)break;
      propose({curvature:Number((spec.curvature*factor).toFixed(4))},
        "تخفيف انحناء الوصلة");
    }
    for(const factor of [0.75,0.5,0.25,0]){
      if(!safety.edgeCrossings&&!safety.sharpTurns)break;
      propose({
        startAngle:Number(((spec.startAngle??0)*factor).toFixed(2)),
        endAngle:Number(((spec.endAngle??0)*factor).toFixed(2)),
      },"تهدئة زاويتي الدخول والخروج");
    }
  }
  return changes.length && diagnosticSeverity(safety)<diagnosticSeverity(before)
    ? {ribbon:spec,before,after:safety,changes}
    : null;
}
