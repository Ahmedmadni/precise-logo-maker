import type {Geometry,PathGeometry} from "../core/geometry/types";
import {geometryBounds} from "../core/geometry/math";
import {booleanGeometryChecked} from "./boolean";

export type SplitAxis="x"|"y";
export type SplitResult={ok:true;parts:PathGeometry[];firstCount:number}|{ok:false;reason:"invalid"|"empty"|"complexity"};
const rectangle=(x1:number,y1:number,x2:number,y2:number):PathGeometry=>({kind:"path",closed:true,points:[{x:x1,y:y1},{x:x2,y:y1},{x:x2,y:y2},{x:x1,y:y2}]});

/** Split by intersecting with two complementary rectangles. Each side may
 * contain multiple polygons, including compound polygons with inner rings. */
export function splitShape(g:Geometry,axis:SplitAxis,fraction:number):SplitResult{
  if((g.kind!=="circle"&&(g.kind!=="path"||!g.closed))||(axis!=="x"&&axis!=="y")||!Number.isFinite(fraction)||fraction<=0||fraction>=1)return {ok:false,reason:"invalid"};
  const b=geometryBounds(g);
  if(![b.minX,b.minY,b.maxX,b.maxY].every(Number.isFinite)||b.maxX<=b.minX||b.maxY<=b.minY)return {ok:false,reason:"invalid"};
  const pad=Math.max(1,(b.maxX-b.minX)*.01,(b.maxY-b.minY)*.01);
  const x1=b.minX-pad,y1=b.minY-pad,x2=b.maxX+pad,y2=b.maxY+pad;
  const cut=axis==="x"?b.minX+(b.maxX-b.minX)*fraction:b.minY+(b.maxY-b.minY)*fraction;
  const cutters=axis==="x"?[rectangle(x1,y1,cut,y2),rectangle(cut,y1,x2,y2)]:[rectangle(x1,y1,x2,cut),rectangle(x1,cut,x2,y2)];
  const first=booleanGeometryChecked([g,cutters[0]!],"intersect");
  const second=booleanGeometryChecked([g,cutters[1]!],"intersect");
  if(!first.ok||!second.ok){
    const errors=[first,second].filter(r=>!r.ok);
    return {ok:false,reason:errors.some(r=>!r.ok&&r.reason==="complexity")?"complexity":errors.some(r=>!r.ok&&r.reason==="invalid")?"invalid":"empty"};
  }
  if(first.parts.length+second.parts.length>1000)return {ok:false,reason:"complexity"};
  return {ok:true,parts:[...first.parts,...second.parts],firstCount:first.parts.length};
}
