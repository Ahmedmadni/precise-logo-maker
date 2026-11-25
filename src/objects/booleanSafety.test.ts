import {describe,it,expect} from "vitest";
import type {PathGeometry} from "../core/geometry/types";
import {booleanGeometryChecked} from "./boolean";
const box=(x:number,y:number,w:number,h:number):PathGeometry=>({kind:"path",closed:true,points:[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}]});
describe("safe pathfinder",()=>{
  it("merges overlapping closed shapes",()=>{
    const result=booleanGeometryChecked([box(0,0,10,10),box(5,0,10,10)],"union");
    expect(result.ok).toBe(true);
    if(result.ok)expect(result.parts).toHaveLength(1);
  });
  it("refuses a hole instead of returning it as a filled object",()=>{
    expect(booleanGeometryChecked([box(0,0,20,20),box(5,5,10,10)],"subtract")).toEqual({ok:false,reason:"holes"});
  });
  it("rejects the entire operation if an operand is open",()=>{
    expect(booleanGeometryChecked([box(0,0,10,10),box(5,0,10,10),{...box(1,1,2,2),closed:false}],"union")).toEqual({ok:false,reason:"invalid"});
  });
  it("distinguishes an empty intersection from a failure",()=>{
    expect(booleanGeometryChecked([box(0,0,10,10),box(20,20,10,10)],"intersect")).toEqual({ok:false,reason:"empty"});
  });
});
