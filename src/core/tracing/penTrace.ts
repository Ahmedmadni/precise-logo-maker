import type {Point} from "../geometry/types";
import {thinBrushSamples} from "./vectorBrush";

export const MAX_PEN_POINTS=2800;
/** Mutates only the private gesture buffer; published preview arrays are copied. */
export function appendPenPoint(points:Point[],point:Point,minDistance:number,finish=false,limit=MAX_PEN_POINTS):boolean{
  if(!Number.isFinite(point.x)||!Number.isFinite(point.y)||!Number.isFinite(minDistance)||minDistance<0||!Number.isInteger(limit)||limit<8)return false;
  const last=points.at(-1);
  if(last){
    const distance=Math.hypot(point.x-last.x,point.y-last.y);
    if(distance===0)return false;
    if(!finish&&distance<minDistance)return false;
    if(finish&&distance<minDistance&&points.length>1){points[points.length-1]=point;return true;}
  }
  if(points.length>=limit){
    const kept=thinBrushSamples(points.map(p=>({...p,pressure:0.68})),Math.max(2,Math.floor(limit*.68)),1/Math.max(minDistance,.1));
    points.splice(0,points.length,...kept.map(({x,y})=>({x,y})));
  }
  points.push(point);
  return true;
}
