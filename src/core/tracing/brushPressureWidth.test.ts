import {describe,it,expect} from "vitest";
import {DEFAULT_BRUSH,brushPressure,brushPressureWidth,brushIsValid,vectorBrushOutline} from "./vectorBrush";

describe("brush pressure transfer",()=>{
  it("preserves legacy linear response",()=>{
    expect(brushPressureWidth(.5,DEFAULT_BRUSH)).toBeCloseTo(.65);
    expect(brushPressureWidth(1,DEFAULT_BRUSH)).toBe(1);
  });
  it("allows a finer minimum and constant-width strokes",()=>{
    expect(brushPressureWidth(.2,{...DEFAULT_BRUSH,pressureFloor:.05})).toBeCloseTo(.24);
    expect(brushPressureWidth(.2,{...DEFAULT_BRUSH,pressureFloor:1})).toBe(1);
    expect(brushPressureWidth(.2,{...DEFAULT_BRUSH,pressure:false})).toBe(1);
  });
  it("changes response with soft and firm curves",()=>{
    expect(brushPressureWidth(.4,{...DEFAULT_BRUSH,pressureCurve:"soft"})).toBeGreaterThan(brushPressureWidth(.4,DEFAULT_BRUSH));
    expect(brushPressureWidth(.4,{...DEFAULT_BRUSH,pressureCurve:"firm"})).toBeLessThan(brushPressureWidth(.4,DEFAULT_BRUSH));
  });
  it("rejects invalid floor and sanitizes device pressure",()=>{
    expect(brushIsValid({...DEFAULT_BRUSH,pressureFloor:NaN})).toBe(false);
    expect(brushIsValid({...DEFAULT_BRUSH,pressureFloor:0})).toBe(false);
    expect(brushPressure(Infinity,"pen")).toBe(.15);
    expect(brushPressure(NaN,"touch")).toBe(.68);
  });
  it("applies the same response to a round dot silhouette",()=>{
    const config={...DEFAULT_BRUSH,preset:"round" as const,size:100,pressureFloor:.1};
    const shape=vectorBrushOutline([{x:0,y:0,pressure:.5}],config)!;
    expect(shape.closed).toBe(true);
    expect(shape.points[0]?.x).toBeCloseTo(27.5);
  });
});
