import {describe,it,expect} from "vitest";
import {appendPenPoint} from "./penTrace";
import type {Point} from "../geometry/types";

describe("freehand pen recording",()=>{
  it("filters near-duplicate points and captures the actual endpoint",()=>{
    const points:Point[]=[{x:0,y:0}];
    expect(appendPenPoint(points,{x:1,y:0},2.5)).toBe(false);
    expect(appendPenPoint(points,{x:4,y:0},2.5)).toBe(true);
    expect(appendPenPoint(points,{x:5,y:0},2.5,true)).toBe(true);
    expect(points).toEqual([{x:0,y:0},{x:5,y:0}]);
  });
  it("retains endpoints when long strokes exceed their sampling budget",()=>{
    const points:Point[]=[];
    for(let i=0;i<160;i++)appendPenPoint(points,{x:i*3,y:Math.sin(i/8)*20},1,false,32);
    expect(points.length).toBeLessThanOrEqual(32);
    expect(points[0]).toEqual({x:0,y:0});
    expect(points.at(-1)?.x).toBe(477);
    expect(appendPenPoint(points,{x:480,y:0},1,true,32)).toBe(true);
    expect(points.at(-1)).toEqual({x:480,y:0});
  });
  it("rejects invalid coordinates without altering the trace",()=>{
    const points:Point[]=[{x:0,y:0}];
    expect(appendPenPoint(points,{x:NaN,y:1},1)).toBe(false);
    expect(points).toEqual([{x:0,y:0}]);
  });
});
