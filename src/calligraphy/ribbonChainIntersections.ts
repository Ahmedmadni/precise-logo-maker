import type { LetteringItem } from "./model";
import { sampleRibbon } from "./ribbonJoin";

type Point={x:number;y:number};
export interface RibbonChainIntersection {
  point:Point;
  firstRibbonId:string;
  secondRibbonId:string;
}
const subtract=(a:Point,b:Point)=>({x:a.x-b.x,y:a.y-b.y});
const cross=(a:Point,b:Point)=>a.x*b.y-a.y*b.x;
const finite=(p:Point)=>Number.isFinite(p.x)&&Number.isFinite(p.y);
/** Strict segment intersection, excluding touches at endpoints and collinear
 * contacts. An intersection is a visible *centerline crossing candidate*,
 * not a proven flaw in the filled Bézier contour or Arabic calligraphy. */
export function ribbonCenterlineIntersection(a:Point,b:Point,c:Point,d:Point):Point|null{
  if(![a,b,c,d].every(finite))return null;
  const ab=subtract(b,a),cd=subtract(d,c),ac=subtract(c,a);
  const denominator=cross(ab,cd);
  const scale=Math.max(1,Math.hypot(ab.x,ab.y),Math.hypot(cd.x,cd.y));
  if(Math.abs(denominator)<1e-9*scale*scale)return null;
  const t=cross(ac,cd)/denominator,u=cross(ac,ab)/denominator;
  if(t<=1e-5||t>=1-1e-5||u<=1e-5||u>=1-1e-5)return null;
  const point={x:a.x+ab.x*t,y:a.y+ab.y*t};
  return finite(point)?point:null;
}

/**
 * Inspect only the visible, connected ribbon component of the selected
 * ribbon, with a hard size bound to keep tablet and pen feedback responsive.
 * Neighboring ribbons share a glyph and often overlap within it by design:
 * don't mark their intentional endcap contact as a crossing.
 */
export function inspectRibbonChainIntersections(
  items:LetteringItem[],selectedRibbonId:string,
):RibbonChainIntersection[]{
  const chosen=items.find(item=>item.id===selectedRibbonId&&item.kind==="bridge"&&!item.hidden);
  if(!chosen?.ribbon)return [];
  const bridges=items.filter(item=>item.kind==="bridge"&&!!item.ribbon&&!item.hidden);
  if(bridges.length>80)return []; // guard malformed/project-scale inputs
  const byGlyph=new Map<string,LetteringItem[]>();
  for(const bridge of bridges){
    const spec=bridge.ribbon!;
    for(const id of [spec.sourceGlyphId,spec.targetGlyphId]){
      const next=byGlyph.get(id)??[];
      next.push(bridge);byGlyph.set(id,next);
    }
  }
  const seen=new Set<string>(),queue=[chosen];
  while(queue.length){
    const bridge=queue.pop()!;
    if(seen.has(bridge.id))continue;
    seen.add(bridge.id);
    if(seen.size>24)return [];
    const spec=bridge.ribbon!;
    for(const id of [spec.sourceGlyphId,spec.targetGlyphId]){
      for(const link of byGlyph.get(id)??[])if(!seen.has(link.id))queue.push(link);
    }
  }
  const members=bridges.filter(item=>seen.has(item.id));
  const points:RibbonChainIntersection[]=[];
  const samples=new Map<string,Point[]>();
  for(const ribbon of members){
    const curve=sampleRibbon(ribbon,items,32);
    if(curve)samples.set(ribbon.id,curve.map(sample=>sample.center));
  }
  for(let i=0;i<members.length;i++){
    const first=members[i]!,a=first.ribbon!,aa=samples.get(first.id);
    if(!aa)continue;
    for(let j=i+1;j<members.length;j++){
      const second=members[j]!,b=second.ribbon!,bb=samples.get(second.id);
      if(!bb)continue;
      // Endcaps near a common glyph are expected to overlap or touch.
      if(a.sourceGlyphId===b.sourceGlyphId||
        a.sourceGlyphId===b.targetGlyphId||
        a.targetGlyphId===b.sourceGlyphId||
        a.targetGlyphId===b.targetGlyphId)continue;
      for(let x=0;x<aa.length-1;x++){
        const p=aa[x]!,q=aa[x+1]!;
        for(let y=0;y<bb.length-1;y++){
          const r=bb[y]!,s=bb[y+1]!;
          if(Math.max(p.x,q.x)+1e-6<Math.min(r.x,s.x)||
             Math.max(r.x,s.x)+1e-6<Math.min(p.x,q.x)||
             Math.max(p.y,q.y)+1e-6<Math.min(r.y,s.y)||
             Math.max(r.y,s.y)+1e-6<Math.min(p.y,q.y))continue;
          const at=ribbonCenterlineIntersection(p,q,r,s);
          if(at && !points.some(existing=>
            existing.firstRibbonId===first.id&&existing.secondRibbonId===second.id &&
            Math.hypot(existing.point.x-at.x,existing.point.y-at.y)<1))
            points.push({point:at,firstRibbonId:first.id,secondRibbonId:second.id});
          if(points.length>=32)return points;
        }
      }
    }
  }
  return points;
}
