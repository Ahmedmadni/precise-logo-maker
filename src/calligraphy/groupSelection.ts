import type {Point} from "../core/geometry/types";
import type {LetteringItem} from "./model";
import {preciseGlyphBounds} from "./morph";
import {isValidRibbon} from "./ribbonJoin";
import {lassoNodeIndices} from "../editor/lassoSelection";

export function glyphLassoHits(items:LetteringItem[],ring:Point[]):string[]{
  const targets=items.flatMap(item=>{
    if(item.hidden||item.kind!=="outline")return [];
    const b=preciseGlyphBounds(item);
    return b?[{id:item.id,point:{x:b.x+b.width/2,y:b.y+b.height/2}}]:[];
  });
  return lassoNodeIndices(targets.map(t=>t.point),ring).map(i=>targets[i]!.id);
}

/** Reject edits across a live join rather than silently stretching its ribbon. */
export function groupMoveIds(items:LetteringItem[],ids:readonly string[]):{ok:true;ids:Set<string>}|{ok:false;reason:"selection"|"bridge"}{
  const selected=new Set(ids);
  if(!selected.size||ids.some(id=>!items.some(i=>i.id===id&&!i.hidden&&i.kind==="outline")))return {ok:false,reason:"selection"};
  for(const item of items){
    if(item.kind==="bridge"&&!item.hidden&&item.ribbon&&selected.has(item.ribbon.sourceGlyphId)!==selected.has(item.ribbon.targetGlyphId))return {ok:false,reason:"bridge"};
  }
  for(const item of items)if(item.kind==="haraka"&&item.attachedToGlyphId&&selected.has(item.attachedToGlyphId))selected.add(item.id);
  return {ok:true,ids:selected};
}
export function translateGlyphSelection(items:LetteringItem[],ids:readonly string[],dx:number,dy:number):LetteringItem[]|null{
  if(![dx,dy].every(Number.isFinite)||(dx===0&&dy===0))return null;
  const result=groupMoveIds(items,ids);
  if(!result.ok)return null;
  if(items.some(i=>result.ids.has(i.id)&&![i.x+dx,i.y+dy].every(Number.isFinite)))return null;
  return items.map(item=>result.ids.has(item.id)?{...item,x:item.x+dx,y:item.y+dy}:item);
}


export type GlyphGroupTransform={scale:number;degrees:number};
export function glyphGroupPivot(items:LetteringItem[],ids:readonly string[]):Point|null{
  const selected=new Set(ids);
  const bounds=items.filter(i=>selected.has(i.id)&&!i.hidden&&i.kind==="outline").map(preciseGlyphBounds);
  if(!bounds.length||bounds.some(b=>!b))return null;
  const b=bounds.filter((b):b is NonNullable<typeof b>=>!!b);
  const x1=Math.min(...b.map(v=>v.x)),x2=Math.max(...b.map(v=>v.x+v.width));
  const y1=Math.min(...b.map(v=>v.y)),y2=Math.max(...b.map(v=>v.y+v.height));
  return {x:(x1+x2)/2,y:(y1+y2)/2};
}
const wrap=(degrees:number)=>((degrees+180)%360+360)%360-180;

/** Uniform similarity transform around the selected outline bounds.
 * Preserve mark attachments and scale live ribbon widths/overlaps with their
 * endpoints. Reject values outside supported rendering limits. */
export function transformGlyphSelection(items:LetteringItem[],ids:readonly string[],options:GlyphGroupTransform):LetteringItem[]|null{
  const {scale,degrees}=options;
  if(!Number.isFinite(scale)||scale<.1||scale>5||!Number.isFinite(degrees)||Math.abs(degrees)>360)return null;
  const selected=groupMoveIds(items,ids),pivot=glyphGroupPivot(items,ids);
  if(!selected.ok||!pivot)return null;
  const angle=degrees*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle);
  const next:LetteringItem[]=[];
  for(const item of items){
    if(item.kind==="bridge"&&item.ribbon&&selected.ids.has(item.ribbon.sourceGlyphId)&&selected.ids.has(item.ribbon.targetGlyphId)){
      const r=item.ribbon;
      const ribbon={...r,startWidth:r.startWidth*scale,endWidth:r.endWidth*scale,startOverlap:(r.startOverlap??0)*scale,endOverlap:(r.endOverlap??0)*scale,nibAngle:wrap((r.nibAngle??35)+degrees)};
      if(!isValidRibbon(ribbon))return null;
      next.push({...item,ribbon});continue;
    }
    if(!selected.ids.has(item.id)){next.push(item);continue;}
    const x=(item.x-pivot.x)*scale,y=(item.y-pivot.y)*scale;
    const size=item.size*scale,weight=item.weight===undefined?undefined:item.weight*scale;
    const moved={...item,x:pivot.x+x*cos-y*sin,y:pivot.y+x*sin+y*cos,size,rotation:wrap(item.rotation+degrees),...(weight===undefined?{}:{weight})};
    if(![moved.x,moved.y,size,moved.rotation,weight??0].every(Number.isFinite)||size<1||size>1000||(weight!==undefined&&(weight<0||weight>20)))return null;
    next.push(moved);
  }
  return next;
}


export type GlyphArrangeAxis="x"|"y";
export type GlyphArrangeMode="min"|"center"|"max"|"distribute";
export type GlyphArrangeResult={ok:true;items:LetteringItem[];gap:number|null;changed:boolean}|{ok:false;reason:"selection"|"bridge"|"overlap"|"invalid"};

/** Arrange actual transformed outline bounds, not glyph origins or advances.
 * Distribution keeps the outer edges fixed, and refuses negative gaps.
 * Live joins may only move rigidly, never stretch as a side effect. */
export function arrangeGlyphSelection(items:LetteringItem[],ids:readonly string[],axis:GlyphArrangeAxis,mode:GlyphArrangeMode):GlyphArrangeResult{
  const selected=new Set(ids);
  if(selected.size<(mode==="distribute"?3:2)||selected.size>400)return {ok:false,reason:"selection"};
  if((axis!=="x"&&axis!=="y")||!(["min","center","max","distribute"] as const).includes(mode))return {ok:false,reason:"invalid"};
  const targets=items.filter(i=>selected.has(i.id)&&!i.hidden&&i.kind==="outline");
  if(targets.length!==selected.size)return {ok:false,reason:"selection"};
  const rows=targets.map(i=>{
    const b=preciseGlyphBounds(i);
    return b?{id:i.id,min:b[axis],extent:axis==="x"?b.width:b.height}:null;
  });
  if(rows.some(r=>!r||!Number.isFinite(r.min)||!Number.isFinite(r.extent)||r.extent<0))return {ok:false,reason:"invalid"};
  const sorted=rows.filter((r):r is NonNullable<typeof r>=>!!r).sort((a,b)=>a.min-b.min||a.extent-b.extent||a.id.localeCompare(b.id));
  const low=sorted[0]!.min,high=Math.max(...sorted.map(r=>r.min+r.extent));
  const offsets=new Map<string,number>();
  let gap:number|null=null,cursor=low;
  if(mode==="distribute"){
    // Keep the end-to-end span fixed and preserve the order of outlines.
    gap=(high-low-sorted.reduce((sum,r)=>sum+r.extent,0))/(sorted.length-1);
    if(gap < -1e-7)return {ok:false,reason:"overlap"};
    gap=Math.max(0,gap);
  }
  for(const row of sorted){
    const position=mode==="min"?low:mode==="max"?high-row.extent:mode==="center"?(low+high-row.extent)/2:cursor;
    offsets.set(row.id,position-row.min);
    if(gap!==null)cursor+=row.extent+gap;
  }
  for(const i of items){
    if(i.kind==="bridge"&&!i.hidden&&i.ribbon){
      const a=offsets.get(i.ribbon.sourceGlyphId)??0,b=offsets.get(i.ribbon.targetGlyphId)??0;
      if(Math.abs(a-b)>1e-7)return {ok:false,reason:"bridge"};
    }
  }
  const next=items.map(i=>{
    const delta=offsets.get(i.id)??(i.kind==="haraka"&&i.attachedToGlyphId?offsets.get(i.attachedToGlyphId):undefined)??0;
    return Math.abs(delta)<=1e-7?i:{...i,[axis]:i[axis]+delta};
  });
  if(next.some(i=>!Number.isFinite(i.x)||!Number.isFinite(i.y)))return {ok:false,reason:"invalid"};
  return {ok:true,items:next,gap,changed:next.some((i,j)=>i!==items[j])};
}


export type GlyphOverlap={a:string;b:string;x:number;y:number;width:number;height:number;ratio:number};
/** Broad-phase overlap candidates, not ink collision or a calligraphic error. */
export function glyphOverlapCandidates(items:LetteringItem[],ids:readonly string[]):GlyphOverlap[]{
  const selected=new Set(ids);
  if(selected.size>400)return [];
  const rows=items.filter(i=>selected.has(i.id)&&i.kind==="outline"&&!i.hidden).flatMap(i=>{const b=preciseGlyphBounds(i);return b?[{id:i.id,...b}]:[];});
  const overlaps:GlyphOverlap[]=[];
  for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
    const a=rows[i]!,b=rows[j]!,x=Math.max(a.x,b.x),y=Math.max(a.y,b.y);
    const width=Math.min(a.x+a.width,b.x+b.width)-x,height=Math.min(a.y+a.height,b.y+b.height)-y;
    if(width<=1e-7||height<=1e-7)continue;
    overlaps.push({a:a.id,b:b.id,x,y,width,height,ratio:width*height/Math.max(1e-7,Math.min(a.width*a.height,b.width*b.height))});
  }
  return overlaps.sort((a,b)=>b.ratio-a.ratio);
}

/** Explicit signed spacing permits intentional stacking while keeping
 * outline centers in order and preserving the group's original midpoint. */
export function spaceGlyphSelection(items:LetteringItem[],ids:readonly string[],axis:GlyphArrangeAxis,gap:number):GlyphArrangeResult{
  const selected=new Set(ids);
  if(selected.size<2||selected.size>400)return {ok:false,reason:"selection"};
  if((axis!=="x"&&axis!=="y")||!Number.isFinite(gap)||Math.abs(gap)>10000)return {ok:false,reason:"invalid"};
  const rows=items.filter(i=>selected.has(i.id)&&i.kind==="outline"&&!i.hidden).map(i=>{
    const b=preciseGlyphBounds(i);return b?{id:i.id,min:b[axis],extent:axis==="x"?b.width:b.height}:null;
  });
  if(rows.length!==selected.size)return {ok:false,reason:"selection"};
  if(rows.some(r=>!r||!Number.isFinite(r.min)||!Number.isFinite(r.extent)||r.extent<=0))return {ok:false,reason:"invalid"};
  const sorted=rows.filter((r):r is NonNullable<typeof r>=>!!r).sort((a,b)=>a.min+a.extent/2-b.min-b.extent/2||a.id.localeCompare(b.id));
  const low=Math.min(...sorted.map(r=>r.min)),high=Math.max(...sorted.map(r=>r.min+r.extent));
  // Require advancing starts and ends, so negative spacing cannot swallow
  // or reverse a neighboring glyph in the chosen order.
  if(sorted.slice(1).some((r,i)=>gap<=-Math.min(r.extent,sorted[i]!.extent)+1e-7))return {ok:false,reason:"overlap"};
  const span=sorted.reduce((sum,r)=>sum+r.extent,0)+gap*(sorted.length-1);
  let cursor=(low+high-span)/2;
  const offsets=new Map<string,number>();
  for(const r of sorted){offsets.set(r.id,cursor-r.min);cursor+=r.extent+gap;}
  for(const i of items)if(i.kind==="bridge"&&!i.hidden&&i.ribbon&&Math.abs((offsets.get(i.ribbon.sourceGlyphId)??0)-(offsets.get(i.ribbon.targetGlyphId)??0))>1e-7)return {ok:false,reason:"bridge"};
  const next=items.map(i=>{
    const delta=offsets.get(i.id)??(i.kind==="haraka"&&i.attachedToGlyphId?offsets.get(i.attachedToGlyphId):undefined)??0;
    return Math.abs(delta)<=1e-7?i:{...i,[axis]:i[axis]+delta};
  });
  if(next.some(i=>!Number.isFinite(i.x)||!Number.isFinite(i.y)))return {ok:false,reason:"invalid"};
  return {ok:true,items:next,gap,changed:next.some((i,j)=>i!==items[j])};
}
