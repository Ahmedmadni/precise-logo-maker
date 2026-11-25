import {describe,it,expect} from "vitest";
import type {PathGeometry,Point} from "../core/geometry/types";
import {splitShape} from "./splitShape";
const box=(x:number,y:number,w:number,h:number):Point[]=>[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];
const area=(ring:Point[])=>Math.abs(ring.reduce((sum,p,i)=>{const q=ring[(i+1)%ring.length]!;return sum+p.x*q.y-q.x*p.y;},0)/2);
const filled=(g:PathGeometry)=>area(g.points)-(g.holes??[]).reduce((s,r)=>s+area(r),0);
const path:PathGeometry={kind:"path",closed:true,points:box(0,0,100,100),holes:[box(10,10,20,20)]};
describe("shape splitting",()=>{
  it("preserves a hole wholly on one side",()=>{
    const result=splitShape(path,"x",.5);
    expect(result.ok).toBe(true);
    if(!result.ok)throw new Error("split failed");
    expect(result.parts).toHaveLength(2);
    expect(result.parts[0]?.holes).toHaveLength(1);
    expect(result.parts[1]?.holes).toBeUndefined();
    expect(result.parts.reduce((s,p)=>s+filled(p),0)).toBeCloseTo(filled(path));
  });
  it("opens a hole intersected by the cut while preserving total filled area",()=>{
    const result=splitShape(path,"y",.2);
    expect(result.ok).toBe(true);
    if(!result.ok)throw new Error("split failed");
    expect(result.parts.every(p=>!p.holes?.length)).toBe(true);
    expect(result.parts.reduce((s,p)=>s+filled(p),0)).toBeCloseTo(filled(path));
  });
  it("rejects open shapes and endpoint cuts",()=>{
    expect(splitShape({...path,closed:false},"x",.5)).toEqual({ok:false,reason:"invalid"});
    expect(splitShape(path,"x",0)).toEqual({ok:false,reason:"invalid"});
  });
});
