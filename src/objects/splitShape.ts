import type {Geometry,PathGeometry,Point} from "../core/geometry/types";
import {geometryBounds} from "../core/geometry/math";
import {booleanGeometryChecked,BOOLEAN_TOLERANCE} from "./boolean";

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
  return splitWithGuide(g,guide);
}

function splitWithGuide(g:Geometry,guide:Pick<CutGuide,"first"|"second">):SplitResult{
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


/** Convert a drawn line to the same normal-angle/offset representation used
 * by the inspector. The infinite extension of the line is the cut. */
export function knifeLineParameters(g:Geometry,start:Point,end:Point):{degrees:number;fraction:number}|null{
  if(![start.x,start.y,end.x,end.y].every(Number.isFinite))return null;
  const dx=end.x-start.x,dy=end.y-start.y,length=Math.hypot(dx,dy);
  if(length<1e-6)return null;
  const nx=dy/length,ny=-dx/length;
  const b=geometryBounds(g);
  if(![b.minX,b.minY,b.maxX,b.maxY].every(Number.isFinite))return null;
  const cx=(b.minX+b.maxX)/2,cy=(b.minY+b.maxY)/2;
  const radius=(Math.abs(nx)*(b.maxX-b.minX)+Math.abs(ny)*(b.maxY-b.minY))/2;
  if(radius<=1e-8)return null;
  const fraction=.5+((start.x-cx)*nx+(start.y-cy)*ny)/(2*radius);
  if(!Number.isFinite(fraction)||fraction<=0||fraction>=1)return null;
  return {degrees:Math.atan2(ny,nx)*180/Math.PI,fraction};
}


export interface CurvedCutGuide extends CutGuide {curve:Point[];control:Point}

/** A quadratic cut in the same projected frame as the straight knife.
 * Both clipping polygons reuse the exact sampled cut boundary.
 * Bend is a signed fraction of the available normal clearance. */
export function curvedCutGuide(g:Geometry,degrees:number,fraction:number,bend:number):CurvedCutGuide|null{
  if(!Number.isFinite(bend)||Math.abs(bend)>1)return null;
  const base=angledCutGuide(g,degrees,fraction);
  if(!base)return null;
  const {start,end}=base;
  const low=base.first.points[0]!,high=base.second.points[1]!;
  const width=Math.hypot(high.x-low.x,high.y-low.y);
  if(width<=1e-8||!Number.isFinite(width))return null;
  const nx=(high.x-low.x)/width,ny=(high.y-low.y)/width;
  const clearance=Math.min(Math.hypot(start.x-low.x,start.y-low.y),Math.hypot(high.x-start.x,high.y-start.y));
  const amplitude=bend*clearance*.85;
  const control={x:(start.x+end.x)/2+2*amplitude*nx,y:(start.y+end.y)/2+2*amplitude*ny};
  // A quadratic's deviation from each equally spaced chord is <= |amplitude| / steps².
  const steps=Math.max(1,Math.ceil(Math.sqrt(Math.abs(amplitude)/BOOLEAN_TOLERANCE)));
  if(steps>1024||!Number.isFinite(steps))return null;
  const curve=Array.from({length:steps+1},(_,i)=>{
    if(i===0)return start;if(i===steps)return end;
    const t=i/steps,u=1-t;
    return {x:u*u*start.x+2*u*t*control.x+t*t*end.x,y:u*u*start.y+2*u*t*control.y+t*t*end.y};
  });
  if(curve.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return null;
  const first:PathGeometry={kind:"path",closed:true,points:[low,...curve,base.first.points[3]!]};
  const second:PathGeometry={kind:"path",closed:true,points:[start,high,base.second.points[2]!,...curve.slice(1).reverse()]};
  return {start,end,first,second,curve,control};
}
export function splitShapeCurved(g:Geometry,degrees:number,fraction:number,bend:number):SplitResult{
  if(g.kind!=="circle"&&(g.kind!=="path"||!g.closed))return {ok:false,reason:"invalid"};
  const guide=curvedCutGuide(g,degrees,fraction,bend);
  return guide?splitWithGuide(g,guide):{ok:false,reason:"invalid"};
}
