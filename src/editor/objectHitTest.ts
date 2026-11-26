import type {Bounds,Geometry,Point,VectorObject} from "../core/geometry/types";
import {closestPointOnGeometry,dist,geometryBounds} from "../core/geometry/math";
import {geometryToRing} from "../objects/boolean";

const boundsCache=new WeakMap<Geometry,Bounds>();
const ringCache=new WeakMap<Geometry,Point[]>();
function boundsFor(g:Geometry):Bounds{
  const existing=boundsCache.get(g);
  if(existing)return existing;
  const b=geometryBounds(g);boundsCache.set(g,b);return b;
}
function ringFor(g:Geometry):Point[]{
  const existing=ringCache.get(g);
  if(existing)return existing;
  const ring=geometryToRing(g);ringCache.set(g,ring);return ring;
}
function winding(point:Point,ring:Point[]):number{
  let n=0;
  for(let i=0;i<ring.length;i++){
    const a=ring[i]!,b=ring[(i+1)%ring.length]!;
    const cross=(b.x-a.x)*(point.y-a.y)-(b.y-a.y)*(point.x-a.x);
    if(a.y<=point.y&&b.y>point.y&&cross>0)n++;
    else if(a.y>point.y&&b.y<=point.y&&cross<0)n--;
  }
  return n;
}
const paintVisible=(paint:string)=>paint!=="none"&&paint!=="transparent";
export function pointInObjectFill(o:VectorObject,p:Point):boolean{
  const g=o.geometry;
  if(o.guide||g.kind==="line"||!paintVisible(o.style.fill)||(o.style.fillOpacity??1)<=0)return false;
  if(g.kind==="circle")return dist(g.center,p)<=g.radius;
  const ring=ringFor(g);
  if(ring.length<3)return false;
  if(g.kind==="path"&&g.closed&&g.holes?.length){
    return ([ring,...g.holes].reduce((s,r)=>s+Math.abs(winding(p,r)),0)%2)===1;
  }
  return winding(p,ring)!==0;
}
export type GuideHitPolicy={locked:boolean;hidden:boolean;edit:boolean};
export function canHitObject(o:VectorObject,guides:GuideHitPolicy):boolean{
  return o.visible&&!o.locked&&(o.style.opacity??1)>0&&!(o.guide&&(guides.locked||guides.hidden))&&(!guides.edit||!!o.guide);
}
/** Direct hits use visible stacking order; nearby edges fall back to the closest.
 * Stroke width on canvas is non-scaling, so convert screen pixels to world units. */
export function hitObject(objects:VectorObject[],p:Point,zoom:number,tolerancePx:number,guides:GuideHitPolicy):string|null{
  if(![p.x,p.y,zoom,tolerancePx].every(Number.isFinite)||zoom<=0||tolerancePx<0)return null;
  let best:{id:string;distance:number}|null=null;
  for(let i=objects.length-1;i>=0;i--){
    const o=objects[i]!;
    if(!canHitObject(o,guides))continue;
    const stroke=o.guide||paintVisible(o.style.stroke)?Math.max(0,o.style.strokeWidth)/2/zoom:0;
    const margin=stroke+tolerancePx/zoom;
    const b=boundsFor(o.geometry);
    if(p.x<b.minX-margin||p.x>b.maxX+margin||p.y<b.minY-margin||p.y>b.maxY+margin)continue;
    if(pointInObjectFill(o,p))return o.id;
    if(!o.guide&&(!paintVisible(o.style.stroke)||o.style.strokeWidth<=0))continue;
    const d=dist(closestPointOnGeometry(o.geometry,p),p);
    if(!Number.isFinite(d))continue;
    if(d<=stroke)return o.id;
    const distance=d-stroke;
    if(distance<=tolerancePx/zoom&&(!best||distance<best.distance))best={id:o.id,distance};
  }
  return best?.id??null;
}
