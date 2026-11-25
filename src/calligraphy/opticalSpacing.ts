import type { LetteringItem } from "./model";
import { glyphPointToWorld, parseOutline } from "./pathEditor";
import { preciseGlyphBounds } from "./morph";

type Point = {x:number;y:number};
type Edge = [Point,Point];

/** Bounded polyline approximation of closed font contours in artboard space. */
function edgesOf(g:LetteringItem): Edge[] | null {
  if(g.kind!=="outline" || !g.pathData || g.hidden) return null;
  const segments=parseOutline(g.pathData);
  if(!segments || segments.length>1000) return null;
  const edges:Edge[]=[];
  let cursor:Point|null=null, origin:Point|null=null, closed=true;
  const world=(x:number,y:number)=>glyphPointToWorld(g,x,y);
  for(const seg of segments){
    if(seg.cmd==="Z"){
      if(!cursor||!origin)return null;
      edges.push([cursor,origin]);cursor=origin;closed=true;continue;
    }
    const pts:Point[]=[];
    for(let i=0;i<seg.values.length;i+=2)pts.push(world(seg.values[i]!,seg.values[i+1]!));
    if(pts.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return null;
    const end=pts.at(-1);
    if(!end)return null;
    if(seg.cmd==="M"){
      if(!closed)return null;
      cursor=end;origin=end;closed=false;continue;
    }
    if(!cursor||closed)return null;
    if(seg.cmd==="L")edges.push([cursor,end]);
    else{
      const controls=[cursor,...pts];
      let previous=cursor;
      for(let j=1;j<=16;j++){
        const t=j/16;
        let level=controls;
        while(level.length>1)level=level.slice(0,-1).map((p,i)=>({
          x:p.x+(level[i+1]!.x-p.x)*t,y:p.y+(level[i+1]!.y-p.y)*t,
        }));
        const next=level[0]!;
        edges.push([previous,next]);previous=next;
      }
    }
    cursor=end;
    if(edges.length>16000)return null;
  }
  return closed && edges.length ? edges : null;
}

function extentAt(edges:Edge[],y:number):{left:number;right:number}|null{
  let left=Infinity,right=-Infinity;
  for(const [a,b] of edges){
    if((a.y<=y&&y<b.y)||(b.y<=y&&y<a.y)){
      const x=a.x+(b.x-a.x)*(y-a.y)/(b.y-a.y);
      left=Math.min(left,x);right=Math.max(right,x);
    }
  }
  return Number.isFinite(left)&&right>left?{left,right}:null;
}

export interface OpticalGap {
  rightId:string;
  leftId:string;
  median:number;
  minimum:number;
  samples:number;
  overlapRows:number;
}

/** Signed clearance of facing horizontal envelopes. A negative value signals
 * envelope interleaving, not a proven filled-shape collision. Holes, stroke
 * weight and aesthetic intent are intentionally not inferred.
 */
export function measureOpticalGaps(items:LetteringItem[]):OpticalGap[]{
  const glyphs=items.filter(g=>!g.hidden&&(g.kind==="outline"||g.kind==="text")).sort((a,b)=>b.x-a.x);
  if(glyphs.length>80)return [];
  const prepared=glyphs.map(g=>({g,edges:edgesOf(g),bounds:preciseGlyphBounds(g)}));
  const results:OpticalGap[]=[];
  for(let i=0;i+1<prepared.length;i++){
    const r=prepared[i]!,l=prepared[i+1]!;
    if(!r.edges||!l.edges||!r.bounds||!l.bounds)continue;
    const top=Math.max(r.bounds.y,l.bounds.y);
    const bottom=Math.min(r.bounds.y+r.bounds.height,l.bounds.y+l.bounds.height);
    if(!(bottom>top))continue;
    const values:number[]=[];
    for(let j=0;j<32;j++){
      const y=top+(bottom-top)*(j+0.5)/32;
      const a=extentAt(r.edges,y),b=extentAt(l.edges,y);
      if(a&&b)values.push(a.left-b.right);
    }
    if(values.length<4)continue;
    values.sort((a,b)=>a-b);
    const n=values.length,mid=Math.floor(n/2);
    results.push({rightId:r.g.id,leftId:l.g.id,minimum:values[0]!,
      median:n%2?values[mid]!:(values[mid-1]!+values[mid]!)/2,
      samples:n,overlapRows:values.filter(v=>v< -0.05).length});
  }
  return results;
}
