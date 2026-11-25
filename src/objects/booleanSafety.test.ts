import {describe,it,expect} from "vitest";
import type {PathGeometry} from "../core/geometry/types";
import {booleanGeometryChecked} from "./boolean";
import {geometryToPathData} from "./render";
import {translateGeometry,mirrorGeometry} from "./transform";
import {closestPointOnGeometry} from "../core/geometry/math";
import {handlesOf} from "../editor/handles";
const box=(x:number,y:number,w:number,h:number):PathGeometry=>({kind:"path",closed:true,points:[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}]});
describe("safe pathfinder",()=>{
  it("merges overlapping closed shapes",()=>{
    const result=booleanGeometryChecked([box(0,0,10,10),box(5,0,10,10)],"union");
    expect(result.ok).toBe(true);
    if(result.ok)expect(result.parts).toHaveLength(1);
  });
  it("retains an enclosed subtraction as one path with an inner ring",()=>{
    const result=booleanGeometryChecked([box(0,0,20,20),box(5,5,10,10)],"subtract");
    expect(result.ok).toBe(true);
    if(!result.ok)throw new Error("Compound subtraction failed");
    expect(result.parts).toHaveLength(1);
    expect(result.parts[0]?.holes).toHaveLength(1);
    const shape=result.parts[0]!;
    expect((geometryToPathData(shape).match(/M /g)??[])).toHaveLength(2);
    expect(closestPointOnGeometry(shape,{x:10,y:5})).toEqual({x:10,y:5});
    expect(handlesOf(shape)).toEqual([]);
  });
  it("keeps inner rings through transforms",()=>{
    const shape:PathGeometry={...box(0,0,20,20),holes:[box(5,5,10,10).points]};
    const moved=translateGeometry(shape,3,4) as PathGeometry;
    expect(moved.holes?.[0]?.[0]).toEqual({x:8,y:9});
    const flipped=mirrorGeometry(moved,"x",{x:0,y:0}) as PathGeometry;
    expect(flipped.holes?.[0]?.[0]).toEqual({x:-8,y:9});
    expect(shape.holes?.[0]?.[0]).toEqual({x:5,y:5});
  });
  it("reuses a compound path without filling its original hole",()=>{
    const shape:PathGeometry={...box(0,0,20,20),holes:[box(5,5,10,10).points]};
    const empty=booleanGeometryChecked([shape,box(7,7,2,2)],"intersect");
    expect(empty).toEqual({ok:false,reason:"empty"});
    const union=booleanGeometryChecked([shape,box(5,5,10,10)],"union");
    expect(union.ok).toBe(true);
    if(union.ok)expect(union.parts[0]?.holes).toBeUndefined();
  });
  it("rejects the entire operation if an operand is open",()=>{
    expect(booleanGeometryChecked([box(0,0,10,10),box(5,0,10,10),{...box(1,1,2,2),closed:false}],"union")).toEqual({ok:false,reason:"invalid"});
  });
  it("distinguishes an empty intersection from a failure",()=>{
    expect(booleanGeometryChecked([box(0,0,10,10),box(20,20,10,10)],"intersect")).toEqual({ok:false,reason:"empty"});
  });
});
