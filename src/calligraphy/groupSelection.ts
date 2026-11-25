import type {Point} from "../core/geometry/types";
import type {LetteringItem} from "./model";
import {preciseGlyphBounds} from "./morph";
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
