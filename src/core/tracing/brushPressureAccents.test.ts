import { describe, it, expect } from "vitest";
import { appendBrushSamples, vectorBrushOutline, DEFAULT_BRUSH } from "./vectorBrush";

describe("stationary pressure accents",()=>{
  it("retains stronger pressure within the spatial sampling threshold",()=>{
    const result=appendBrushSamples([{x:0,y:0,pressure:0.2}],[{x:0.2,y:0,pressure:0.9}],1);
    expect(result).toEqual([{x:0,y:0,pressure:0.9}]);
  });
  it("does not lower a captured local pressure peak",()=>{
    const result=appendBrushSamples([{x:0,y:0,pressure:0.9}],[{x:0.2,y:0,pressure:0.3}],1);
    expect(result[0]!.pressure).toBe(0.9);
  });
  it("uses peak pressure for a stationary round imprint",()=>{
    const settings={...DEFAULT_BRUSH,preset:"round" as const,size:20};
    const path=vectorBrushOutline([{x:0,y:0,pressure:0.2},{x:0,y:0,pressure:1}],settings);
    expect(path?.points[0]?.x).toBeCloseTo(10);
  });
  it("preserves the final pointer position",()=>{
    const result=appendBrushSamples([{x:0,y:0,pressure:0.8}],[{x:0.5,y:0,pressure:0.8}],1,true);
    expect(result[0]).toEqual({x:0.5,y:0,pressure:0.8});
  });
});
