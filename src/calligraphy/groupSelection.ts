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
    if(![moved.x,moved.y,size,moved.rotation,weight??0].every(Number.isFinite)||size<1||size>1000)return null;
    next.push(moved);
  }
  return next;
}
