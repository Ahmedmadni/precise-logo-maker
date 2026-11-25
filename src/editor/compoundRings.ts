import type {PathGeometry,Point} from "../core/geometry/types";
import {closestPointOnSegment,dist} from "../core/geometry/math";

const EPS=1e-7;
const finite=(p:Point)=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.abs(p.x)<=1e7&&Math.abs(p.y)<=1e7;
const cross=(a:Point,b:Point,c:Point)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const on=(a:Point,b:Point,p:Point)=>dist(p,closestPointOnSegment(a,b,p))<=EPS;
function meets(a:Point,b:Point,c:Point,d:Point){
  if(Math.max(a.x,b.x)+EPS<Math.min(c.x,d.x)||Math.max(c.x,d.x)+EPS<Math.min(a.x,b.x)||Math.max(a.y,b.y)+EPS<Math.min(c.y,d.y)||Math.max(c.y,d.y)+EPS<Math.min(a.y,b.y))return false;
  if(on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b))return true;
  return (cross(a,b,c)>0)!==(cross(a,b,d)>0)&&(cross(c,d,a)>0)!==(cross(c,d,b)>0);
}
function inside(p:Point,ring:Point[]){
  let contained=false;
  for(let i=0;i<ring.length;i++){
    const a=ring[i]!,b=ring[(i+1)%ring.length]!;
    if(on(a,b,p))return false;
    if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)contained=!contained;
  }
  return contained;
}
function simple(ring:Point[]){
  if(ring.length<3||ring.some(p=>!finite(p)))return false;
  let area=0;
  for(let i=0;i<ring.length;i++){
    const a=ring[i]!,b=ring[(i+1)%ring.length]!,c=ring[(i+2)%ring.length]!;
    if(dist(a,b)<=EPS)return false;
    if(on(a,b,c)||on(b,c,a))return false;
    area+=a.x*b.y-b.x*a.y;
    for(let j=i+2;j<ring.length;j++){
      if(i===0&&j===ring.length-1)continue;
      if(meets(a,b,ring[j]!,ring[(j+1)%ring.length]!))return false;
    }
  }
  return Math.abs(area)>EPS;
}
function boundariesMeet(a:Point[],b:Point[]){
  return a.some((p,i)=>b.some((q,j)=>meets(p,a[(i+1)%a.length]!,q,b[(j+1)%b.length]!)));
}
export type RingEditResult={ok:true;path:PathGeometry}|{ok:false;reason:"unsupported"|"invalid"|"outside"|"overlap"};

/** Conservative validation for polygonal compound paths only.
 * Limit quadratic topology checks to 1600 total points per edit. */
export function replaceCompoundHole(path:PathGeometry,index:number,ring:Point[]):RingEditResult{
  const holes=path.holes;
  if(!path.closed||path.cubicSegments?.some(Boolean)||!holes||!Number.isInteger(index)||!holes[index])return {ok:false,reason:"unsupported"};
  const total=path.points.length+holes.reduce((s,r,i)=>s+(i===index?ring.length:r.length),0);
  if(total>1600)return {ok:false,reason:"unsupported"};
  if(!simple(ring)||!simple(path.points))return {ok:false,reason:"invalid"};
  if(!inside(ring[0]!,path.points)||boundariesMeet(ring,path.points))return {ok:false,reason:"outside"};
  for(let i=0;i<holes.length;i++){
    if(i===index)continue;
    const other=holes[i]!;
    if(!simple(other))return {ok:false,reason:"invalid"};
    if(boundariesMeet(ring,other)||inside(ring[0]!,other)||inside(other[0]!,ring))return {ok:false,reason:"overlap"};
  }
  return {ok:true,path:{...path,holes:holes.map((r,i)=>i===index?ring:r)}};
}
export function translateCompoundHole(path:PathGeometry,index:number,dx:number,dy:number):RingEditResult{
  const ring=path.holes?.[index];
  if(!ring||![dx,dy].every(Number.isFinite))return {ok:false,reason:"invalid"};
  return replaceCompoundHole(path,index,ring.map(p=>({x:p.x+dx,y:p.y+dy})));
}
export function scaleCompoundHole(path:PathGeometry,index:number,factor:number):RingEditResult{
  const ring=path.holes?.[index];
  if(!ring?.length||!Number.isFinite(factor)||factor<=0||factor>10)return {ok:false,reason:"invalid"};
  const center=ring.reduce((s,p)=>({x:s.x+p.x/ring.length,y:s.y+p.y/ring.length}),{x:0,y:0});
  return replaceCompoundHole(path,index,ring.map(p=>({x:center.x+(p.x-center.x)*factor,y:center.y+(p.y-center.y)*factor})));
}


/** Subdivide a ring edge without changing the filled shape. */
export function insertCompoundHoleNode(path:PathGeometry,index:number,node:number):RingEditResult{
  const ring=path.holes?.[index];
  if(!ring||!Number.isInteger(node)||node<0||node>=ring.length)return {ok:false,reason:"invalid"};
  const a=ring[node]!,b=ring[(node+1)%ring.length]!;
  const next=[...ring];
  next.splice(node+1,0,{x:(a.x+b.x)/2,y:(a.y+b.y)/2});
  return replaceCompoundHole(path,index,next);
}

/** Remove a node only when the resulting ring remains valid. */
export function deleteCompoundHoleNode(path:PathGeometry,index:number,node:number):RingEditResult{
  const ring=path.holes?.[index];
  if(!ring||ring.length<=3||!Number.isInteger(node)||node<0||node>=ring.length)return {ok:false,reason:"invalid"};
  return replaceCompoundHole(path,index,ring.filter((_,i)=>i!==node));
}

/** Rotate one hole around its vertex centroid. */
export function rotateCompoundHole(path:PathGeometry,index:number,degrees:number):RingEditResult{
  const ring=path.holes?.[index];
  if(!ring?.length||!Number.isFinite(degrees))return {ok:false,reason:"invalid"};
  const center=ring.reduce((s,p)=>({x:s.x+p.x/ring.length,y:s.y+p.y/ring.length}),{x:0,y:0});
  const angle=(degrees%360)*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle);
  return replaceCompoundHole(path,index,ring.map(p=>({x:center.x+(p.x-center.x)*cos-(p.y-center.y)*sin,y:center.y+(p.x-center.x)*sin+(p.y-center.y)*cos})));
}
