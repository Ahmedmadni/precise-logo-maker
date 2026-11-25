import type {Point,VectorObject} from "../core/geometry/types";
import {geometryBounds,pathSegments,sampledPathSegments,arcSweep} from "../core/geometry/math";
import {geometryToRing} from "../objects/boolean";

export type LassoMode="replace"|"add"|"subtract";
const EPS=1e-7;
const cross=(a:Point,b:Point,c:Point)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
function on(a:Point,b:Point,p:Point){
  return Math.abs(cross(a,b,p))<=EPS&&p.x>=Math.min(a.x,b.x)-EPS&&p.x<=Math.max(a.x,b.x)+EPS&&p.y>=Math.min(a.y,b.y)-EPS&&p.y<=Math.max(a.y,b.y)+EPS;
}
function meets(a:Point,b:Point,c:Point,d:Point){
  if(Math.max(a.x,b.x)+EPS<Math.min(c.x,d.x)||Math.max(c.x,d.x)+EPS<Math.min(a.x,b.x)||Math.max(a.y,b.y)+EPS<Math.min(c.y,d.y)||Math.max(c.y,d.y)+EPS<Math.min(a.y,b.y))return false;
  if(on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b))return true;
  return (cross(a,b,c)>0)!==(cross(a,b,d)>0)&&(cross(c,d,a)>0)!==(cross(c,d,b)>0);
}
function inside(p:Point,ring:Point[]){
  let hit=false;
  for(let i=0;i<ring.length;i++){
    const a=ring[i]!,b=ring[(i+1)%ring.length]!;
    if(on(a,b,p))return true;
    if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)hit=!hit;
  }
  return hit;
}

export function lassoHits(objects:VectorObject[],ring:Point[]):string[]{
  if(ring.length<3||ring.length>512||ring.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return [];
  const lx=Math.min(...ring.map(p=>p.x)),rx=Math.max(...ring.map(p=>p.x)),ly=Math.min(...ring.map(p=>p.y)),ry=Math.max(...ring.map(p=>p.y));
  if(rx-lx<=EPS||ry-ly<=EPS)return [];
  const boundary=pathSegments(ring,true);
  return objects.filter(o=>{
    if(!o.visible||o.locked||o.guide)return false;
    const g=o.geometry,b=geometryBounds(g);
    if(b.maxX<lx||b.minX>rx||b.maxY<ly||b.minY>ry)return false;
    const filled=o.style.fill!=="none"&&o.style.fill!=="transparent"&&(o.style.fillOpacity??1)>0;
    let outline:Point[],edges:[Point,Point][];
    if(g.kind==="path"){
      const segments=sampledPathSegments(g);
      outline=segments.length?[segments[0]![0],...segments.map(e=>e[1])]:g.points;
      edges=[...segments,...(g.closed?(g.holes??[]).flatMap(r=>pathSegments(r,true)):[])];
    }else{
      outline=geometryToRing(g);
      edges=pathSegments(outline,g.kind==="circle"||(g.kind==="arc"&&arcSweep(g)>=359.999));
    }
    if(outline.length<2)return false;
    if(filled&&g.kind!=="line")edges.push([outline.at(-1)!,outline[0]!]);
    if(edges.some(([a,b])=>inside(a,ring)||inside(b,ring)||boundary.some(([c,d])=>meets(a,b,c,d))))return true;
    return filled&&g.kind!=="line"&&ring.some(p=>inside(p,outline)&&!(g.kind==="path"&&(g.holes??[]).some(h=>inside(p,h))));
  }).map(o=>o.id);
}

export function combineLassoSelection(previous:string[],hits:string[],mode:LassoMode):string[]{
  const hitSet=new Set(hits);
  return mode==="subtract"?previous.filter(id=>!hitSet.has(id)):mode==="add"?[...new Set([...previous,...hits])]:[...hitSet];
}


/** Select anchors, not control handles or the filled area. */
export function lassoNodeIndices(points:Point[],ring:Point[]):number[]{
  if(ring.length<3||ring.length>512||ring.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return [];
  const xs=ring.map(p=>p.x),ys=ring.map(p=>p.y);
  if(Math.max(...xs)-Math.min(...xs)<=EPS||Math.max(...ys)-Math.min(...ys)<=EPS)return [];
  return points.flatMap((p,i)=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&inside(p,ring)?[i]:[]);
}
export function combineNodeSelection(previous:number[],hits:number[],mode:LassoMode):number[]{
  const hitSet=new Set(hits);
  return (mode==="subtract"?previous.filter(i=>!hitSet.has(i)):mode==="add"?[...new Set([...previous,...hits])]:[...hitSet]).sort((a,b)=>a-b);
}
