import { describe,it,expect } from "vitest";
import type { PathGeometry } from "../core/geometry/types";
import { buildBrushStroke, DEFAULT_BRUSH } from "../core/tracing/vectorBrush";
import { vectorBrushPreviewOutline } from "../core/tracing/brushPreview";
import { handlesOf, pickHandle, applyHandle } from "./handles";
import { geometryToPathData } from "../objects/render";
import { movePathNode,insertPathNode,deletePathNode,setPathEdgeCurved,movePathControl } from "./path-nodes";

const path:PathGeometry={kind:"path",closed:true,points:[{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}],cubicSegments:[{control1:{x:0,y:10},control2:{x:10,y:10}},null,null,{control1:{x:-4,y:10},control2:{x:-4,y:0}}]};

describe("cubic path node operations",()=>{
  it("moves both handles attached to the node",()=>{
    const moved=movePathNode(path,0,{x:2,y:3});
    expect(moved.cubicSegments?.[0]?.control1).toEqual({x:2,y:13});
    expect(moved.cubicSegments?.[3]?.control2).toEqual({x:-2,y:3});
    expect(path.points[0]).toEqual({x:0,y:0});
  });
  it("splits a cubic at its actual midpoint",()=>{
    const split=insertPathNode(path,0);
    expect(split.points[1]).toEqual({x:5,y:7.5});
    expect(split.cubicSegments).toHaveLength(5);
    expect(split.cubicSegments?.[0]?.control2).toEqual({x:2.5,y:7.5});
    expect(split.cubicSegments?.[1]?.control1).toEqual({x:7.5,y:7.5});
    expect(split.cubicSegments?.[4]).toEqual(path.cubicSegments?.[3]);
  });
  it("keeps unrelated controls correctly indexed after deletion",()=>{
    const result=deletePathNode(path,1);
    expect(result.cubicSegments).toEqual([null,null,path.cubicSegments?.[3]]);
  });
  it("uses the same curve setting for preview and final stroke",()=>{
    const samples=Array.from({length:41},(_,i)=>({x:i*3,y:10*Math.sin(i/8),pressure:.8}));
    const settings={...DEFAULT_BRUSH,preset:"round" as const,size:10,smoothCurves:true};
    const result=buildBrushStroke(samples,settings)!;
    expect(result.cubicSegments?.some(Boolean)).toBe(true);
    expect(geometryToPathData(result)).toContain(" C ");
    expect(vectorBrushPreviewOutline(samples,settings,1)).toEqual(result);
    expect(buildBrushStroke(samples,{...settings,smoothCurves:false})?.cubicSegments).toBeUndefined();
  });
});


describe("direct cubic handle editing",()=>{
  it("converts a straight edge to an equivalent cubic and back",()=>{
    const straight:PathGeometry={kind:"path",closed:false,points:[{x:0,y:0},{x:12,y:0},{x:20,y:0}]};
    const curved=setPathEdgeCurved(straight,0,true);
    expect(curved.cubicSegments?.[0]).toEqual({control1:{x:4,y:0},control2:{x:8,y:0}});
    expect(setPathEdgeCurved(curved,0,false).cubicSegments?.[0]).toBeNull();
    expect(setPathEdgeCurved(straight,2,true)).toBe(straight);
  });
  it("keeps unrelated controls intact in free mode",()=>{
    const moved=movePathControl(path,0,"control1",{x:3,y:4});
    expect(moved.cubicSegments?.[0]?.control1).toEqual({x:3,y:4});
    expect(moved.cubicSegments?.[3]).toEqual(path.cubicSegments?.[3]);
  });
  it("mirrors the opposing control at the closed seam",()=>{
    const moved=movePathControl(path,0,"control1",{x:3,y:4},"symmetric");
    expect(moved.cubicSegments?.[3]?.control2).toEqual({x:-3,y:-4});
    expect(path.cubicSegments?.[3]?.control2).toEqual({x:-4,y:0});
  });
  it("aligns the opposing control while preserving its original length",()=>{
    const moved=movePathControl(path,0,"control1",{x:0,y:8},"aligned");
    expect(moved.cubicSegments?.[3]?.control2).toEqual({x:0,y:-4});
  });
});


describe("canvas cubic handles",()=>{
  it("shows only the two controls for the requested edge",()=>{
    expect(handlesOf(path).filter(h=>h.role==="control")).toEqual([]);
    expect(handlesOf(path,0).filter(h=>h.role==="control").map(h=>h.id)).toEqual(["c0:1","c0:2"]);
    expect(handlesOf(path,1).filter(h=>h.role==="control")).toEqual([]);
  });
  it("picks a visible control and applies the selected coupling mode",()=>{
    const shape=movePathControl(path,0,"control1",{x:2,y:5});
    const h=pickHandle(shape,{x:2,y:5},.5,0);
    expect(h?.id).toBe("c0:1");
    const moved=applyHandle(shape,h!.id,{x:4,y:6},"symmetric") as PathGeometry;
    expect(moved.cubicSegments?.[0]?.control1).toEqual({x:4,y:6});
    expect(moved.cubicSegments?.[3]?.control2).toEqual({x:-4,y:-6});
    expect(moved.points).toEqual(path.points);
  });
});
