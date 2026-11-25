import {describe,it,expect} from "vitest";
import type {PathGeometry} from "../core/geometry/types";
import {booleanGeometryChecked,geometryToRing,BOOLEAN_TOLERANCE} from "./boolean";
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


describe("adaptive polygon approximation",()=>{
  it("increases circle resolution with radius and bounds chord sagitta",()=>{
    const small=geometryToRing({kind:"circle",center:{x:0,y:0},radius:10});
    const large=geometryToRing({kind:"circle",center:{x:0,y:0},radius:1000});
    expect(large.length).toBeGreaterThan(small.length);
    expect(1000*(1-Math.cos(Math.PI/large.length))).toBeLessThanOrEqual(BOOLEAN_TOLERANCE);
  });
  it("closes partial arcs by a chord without inserting the center",()=>{
    const ring=geometryToRing({kind:"arc",center:{x:0,y:0},radius:50,startAngle:0,endAngle:90});
    expect(ring.every(p=>Math.abs(Math.hypot(p.x,p.y)-50)<1e-8)).toBe(true);
    expect(ring[0]).toEqual({x:50,y:0});
    expect(ring.at(-1)?.y).toBeCloseTo(50);
  });
  it("subdivides long curved edges more finely than flat ones",()=>{
    const flat:PathGeometry={kind:"path",closed:true,points:[{x:0,y:0},{x:100,y:0},{x:100,y:100}],cubicSegments:[{control1:{x:20,y:0},control2:{x:80,y:0}},null,null]};
    const bowed:PathGeometry={...flat,cubicSegments:[{control1:{x:0,y:-200},control2:{x:100,y:-200}},null,null]};
    expect(geometryToRing(flat)).toHaveLength(3);
    expect(geometryToRing(bowed).length).toBeGreaterThan(10);
    expect(geometryToRing(bowed).some(p=>p.y<-100)).toBe(true);
  });
});
