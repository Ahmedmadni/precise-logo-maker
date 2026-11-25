import {describe,it,expect} from "vitest";
import type {PathGeometry,Point} from "../core/geometry/types";
import {replaceCompoundHole,translateCompoundHole,scaleCompoundHole} from "./compoundRings";
const box=(x:number,y:number,w:number,h:number):Point[]=>[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];
const path:PathGeometry={kind:"path",closed:true,points:box(0,0,100,100),holes:[box(10,10,20,20),box(60,60,20,20)]};
describe("compound ring edits",()=>{
  it("moves just the selected hole without mutating the original",()=>{
    const result=translateCompoundHole(path,0,5,10);
    expect(result.ok).toBe(true);
    if(!result.ok)throw new Error("move failed");
    expect(result.path.holes?.[0]).toEqual(box(15,20,20,20));
    expect(result.path.holes?.[1]).toBe(path.holes?.[1]);
    expect(result.path.points).toBe(path.points);
    expect(path.holes?.[0]).toEqual(box(10,10,20,20));
  });
  it("scales around the selected ring center",()=>{
    const result=scaleCompoundHole(path,0,.5);
    expect(result.ok).toBe(true);
    if(result.ok)expect(result.path.holes?.[0]).toEqual(box(15,15,10,10));
  });
  it("rejects touching or leaving the outer contour",()=>{
    expect(translateCompoundHole(path,0,-10,0)).toEqual({ok:false,reason:"outside"});
    expect(translateCompoundHole(path,0,-20,0)).toEqual({ok:false,reason:"outside"});
  });
  it("rejects crossing and nested holes",()=>{
    expect(translateCompoundHole(path,0,40,40)).toEqual({ok:false,reason:"overlap"});
    expect(replaceCompoundHole(path,0,box(65,65,5,5))).toEqual({ok:false,reason:"overlap"});
  });
  it("rejects self-intersecting and invalid rings",()=>{
    expect(replaceCompoundHole(path,0,[{x:10,y:10},{x:30,y:30},{x:10,y:30},{x:30,y:10}])).toEqual({ok:false,reason:"invalid"});
    expect(replaceCompoundHole(path,0,[{x:NaN,y:10},{x:20,y:10},{x:10,y:20}])).toEqual({ok:false,reason:"invalid"});
  });
  it("rejects a hole crossing the concave outer boundary",()=>{
    const concave:PathGeometry={kind:"path",closed:true,points:[{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:60,y:100},{x:60,y:30},{x:40,y:30},{x:40,y:100},{x:0,y:100}],holes:[box(10,40,10,10)]};
    expect(replaceCompoundHole(concave,0,box(30,40,40,10))).toEqual({ok:false,reason:"outside"});
  });
});
