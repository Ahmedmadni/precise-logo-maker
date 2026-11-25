import {describe,it,expect} from "vitest";
import type {PathGeometry} from "../core/geometry/types";
import {joinOpenPaths,reverseOpenPath,nearestPathEnds} from "./joinPaths";
const a:PathGeometry={kind:"path",closed:false,points:[{x:0,y:0},{x:10,y:0}],cubicSegments:[{control1:{x:2,y:5},control2:{x:8,y:0}},null]};
const b:PathGeometry={kind:"path",closed:false,points:[{x:20,y:0},{x:30,y:10}]};
describe("open-path joins",()=>{
  it("reverses anchors and swaps cubic controls without mutation",()=>{
    const reversed=reverseOpenPath(a);
    expect(reversed.points).toEqual([...a.points].reverse());
    expect(reversed.cubicSegments?.[0]).toEqual({control1:{x:8,y:0},control2:{x:2,y:5}});
    expect(reverseOpenPath(reversed)).toEqual(a);
  });
  it("uses the nearest pair and preserves original segments",()=>{
    expect(nearestPathEnds(a,b)).toEqual({a:"end",b:"start"});
    const joined=joinOpenPaths(a,b,"end","start","line")!;
    expect(joined.points).toEqual([...a.points,...b.points]);
    expect(joined.cubicSegments?.[0]).toEqual(a.cubicSegments?.[0]);
    expect(joined.cubicSegments?.[1]).toBeNull();
  });
  it("welds exactly coincident endpoints without a redundant edge",()=>{
    const next:PathGeometry={...b,points:[a.points[1]!,b.points[1]!]};
    const joined=joinOpenPaths(a,next,"end","start","smooth")!;
    expect(joined.points).toEqual([...a.points,b.points[1]]);
    expect(joined.cubicSegments?.[0]).toEqual(a.cubicSegments?.[0]);
  });
  it("adds a cubic tangent connector without modifying the neighboring curve",()=>{
    const joined=joinOpenPaths(a,b,"end","start","smooth")!;
    expect(joined.cubicSegments?.[0]).toEqual(a.cubicSegments?.[0]);
    const bridge=joined.cubicSegments?.[1]!;
    expect(bridge.control1.x).toBeCloseTo(10+10/3);
    expect(bridge.control1.y).toBeCloseTo(0);
    expect(20-bridge.control2.x).toBeCloseTo(-bridge.control2.y);
  });
  it("supports joining two straight line primitives and rejects closed paths",()=>{
    expect(joinOpenPaths({kind:"line",a:a.points[0]!,b:a.points[1]!},b,"end","start")?.points).toHaveLength(4);
    expect(joinOpenPaths({...a,closed:true},b,"end","start")).toBeNull();
  });
});
