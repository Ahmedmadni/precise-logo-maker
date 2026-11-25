import type {Geometry,PathGeometry,Point} from "../core/geometry/types";
import {geometryBounds} from "../core/geometry/math";
import {booleanGeometryChecked} from "./boolean";

export type SplitAxis="x"|"y";
export type SplitResult={ok:true;parts:PathGeometry[];firstCount:number}|{ok:false;reason:"invalid"|"empty"|"complexity"};
export interface CutGuide {start:Point;end:Point;first:PathGeometry;second:PathGeometry}

/** Angle denotes the normal direction: 0° is a vertical cut, 90° horizontal.
 * Fraction locates the cut across the projected artboard bounds. */
export function angledCutGuide(g:Geometry,degrees:number,fraction:number):CutGuide|null{
  if(!Number.isFinite(degrees)||!Number.isFinite(fraction)||fraction<=0||fraction>=1)return null;
  const b=geometryBounds(g);
  if(![b.minX,b.minY,b.maxX,b.maxY].every(Number.isFinite)||b.maxX<=b.minX||b.maxY<=b.minY)return null;
  const center={x:(b.minX+b.maxX)/2,y:(b.minY+b.maxY)/2};
  const radians=(degrees%360)*Math.PI/180;
  const snap=(v:number)=>Math.abs(v)<1e-12?0:v;
  const nx=snap(Math.cos(radians)),ny=snap(Math.sin(radians)),tx=-ny,ty=nx;
  const halfX=(b.maxX-b.minX)/2,halfY=(b.maxY-b.minY)/2;
  const normalRadius=Math.abs(nx)*halfX+Math.abs(ny)*halfY;
  const tangentRadius=Math.abs(tx)*halfX+Math.abs(ty)*halfY;
  const pad=Math.max(1,halfX*.02,halfY*.02);
  const cut=normalRadius*(2*fraction-1);
  const point=(u:number,v:number):Point=>({x:center.x+nx*u+tx*v,y:center.y+ny*u+ty*v});
  const low=-normalRadius-pad,high=normalRadius+pad,t=tangentRadius+pad;
  const start=point(cut,-t),end=point(cut,t);
  const ring=(points:Point[]):PathGeometry=>({kind:"path",closed:true,points});
  const first=ring([point(low,-t),start,end,point(low,t)]);
  const second=ring([start,point(high,-t),point(high,t),end]);
  if([...first.points,...second.points].some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return null;
  return {start,end,first,second};
}

export function splitShapeAtAngle(g:Geometry,degrees:number,fraction:number):SplitResult{
  if(g.kind!=="circle"&&(g.kind!=="path"||!g.closed))return {ok:false,reason:"invalid"};
  const guide=angledCutGuide(g,degrees,fraction);
  if(!guide)return {ok:false,reason:"invalid"};
  const first=booleanGeometryChecked([g,guide.first],"intersect");
  const second=booleanGeometryChecked([g,guide.second],"intersect");
  if(!first.ok||!second.ok){
    const errors=[first,second].filter(r=>!r.ok);
    return {ok:false,reason:errors.some(r=>!r.ok&&r.reason==="complexity")?"complexity":errors.some(r=>!r.ok&&r.reason==="invalid")?"invalid":"empty"};
  }
  if(first.parts.length+second.parts.length>1000)return {ok:false,reason:"complexity"};
  return {ok:true,parts:[...first.parts,...second.parts],firstCount:first.parts.length};
}

export function splitShape(g:Geometry,axis:SplitAxis,fraction:number):SplitResult{
  if(axis!=="x"&&axis!=="y")return {ok:false,reason:"invalid"};
  return splitShapeAtAngle(g,axis==="x"?0:90,fraction);
}
