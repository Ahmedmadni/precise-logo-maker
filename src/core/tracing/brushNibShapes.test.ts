import { describe, it, expect } from "vitest";
import { DEFAULT_BRUSH, brushIsValid, vectorBrushOutline, type BrushSettings } from "./vectorBrush";
const settings:BrushSettings={...DEFAULT_BRUSH,preset:"qalam",size:20,angle:0,pressure:false,nibRatio:.2};
const dot=[{x:0,y:0,pressure:1}];
describe("qalam nib shapes",()=>{
  it("preserves the original chisel for older saved settings",()=>{
    expect(vectorBrushOutline(dot,settings)).toEqual(vectorBrushOutline(dot,{...settings,nibShape:"chisel"}));
  });
  it("builds distinct ellipse and rectangular imprints",()=>{
    expect(vectorBrushOutline(dot,{...settings,nibShape:"ellipse"})?.points).toHaveLength(24);
    expect(vectorBrushOutline(dot,{...settings,nibShape:"square"})?.points).toHaveLength(4);
  });
  it("respects the configured nib width and direction",()=>{
    const stroke=[{x:0,y:0,pressure:1},{x:40,y:0,pressure:1}];
    for(const nibShape of ["ellipse","square","chisel"] as const){
      const g=vectorBrushOutline(stroke,{...settings,nibShape});
      expect(g).not.toBeNull();
      expect(Math.max(...g!.points.map(p=>p.y))).toBeCloseTo(2);
    }
  });
  it("rejects an unsupported nib shape",()=>{
    expect(brushIsValid({...settings,nibShape:"invalid" as BrushSettings["nibShape"]})).toBe(false);
  });
});
