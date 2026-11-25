import {describe,it,expect} from "vitest";
import type {PathGeometry,Point} from "../core/geometry/types";
import {cutOpenPath} from "./scissors";

const path:PathGeometry={kind:"path",closed:false,points:[{x:0,y:0},{x:10,y:0},{x:20,y:10}],cubicSegments:[{control1:{x:0,y:10},control2:{x:10,y:10}},null,null]};
const at=(p:PathGeometry,edge:number,t:number):Point=>{
  const a=p.points[edge]!,b=p.points[edge+1]!,c=p.cubicSegments?.[edge],u=1-t;
  if(!c)return {x:u*a.x+t*b.x,y:u*a.y+t*b.y};
  return {x:u*u*u*a.x+3*u*u*t*c.control1.x+3*u*t*t*c.control2.x+t*t*t*b.x,y:u*u*u*a.y+3*u*u*t*c.control1.y+3*u*t*t*c.control2.y+t*t*t*b.y};
};
describe("exact open-path scissors",()=>{
  it("subdivides a cubic into matching subcurves at arbitrary t",()=>{
    const t=.37,parts=cutOpenPath(path,0,t)!;
    expect(parts).toHaveLength(2);
    for(const u of [0,.25,.5,.75,1]){
      const left=at(parts[0],0,u),right=at(parts[1],0,u);
      const a=at(path,0,t*u),b=at(path,0,t+(1-t)*u);
      expect(left.x).toBeCloseTo(a.x,9);expect(left.y).toBeCloseTo(a.y,9);
      expect(right.x).toBeCloseTo(b.x,9);expect(right.y).toBeCloseTo(b.y,9);
    }
    expect(parts[0].points.at(-1)).toEqual(parts[1].points[0]);
    expect(parts[1].points.at(-1)).toEqual(path.points[2]);
    expect(path.points).toHaveLength(3);
  });
  it("cuts a straight edge without introducing cubic controls",()=>{
    const parts=cutOpenPath(path,1,.5)!;
    expect(parts[1].points).toEqual([{x:15,y:5},{x:20,y:10}]);
    expect(parts[1].cubicSegments).toBeUndefined();
    expect(parts[0].cubicSegments?.[0]).toEqual(path.cubicSegments?.[0]);
  });
  it("supports an existing interior node from either adjacent edge",()=>{
    expect(cutOpenPath(path,0,1)).toEqual(cutOpenPath(path,1,0));
    expect(cutOpenPath(path,0,1)?.[0].points).toEqual(path.points.slice(0,2));
  });
  it("rejects closed paths, endpoint cuts and invalid parameters",()=>{
    expect(cutOpenPath({...path,closed:true},0,.5)).toBeNull();
    expect(cutOpenPath(path,0,0)).toBeNull();
    expect(cutOpenPath(path,1,1)).toBeNull();
    expect(cutOpenPath(path,0,NaN)).toBeNull();
    expect(cutOpenPath(path,3,.5)).toBeNull();
  });
});
