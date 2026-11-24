import { describe, expect, it } from "vitest";
import { DEFAULT_BRUSH, smoothBrushSamples, vectorBrushOutline, type BrushSample } from "../vectorBrush";
import { geometryToPathData } from "../../../objects/render";
import { vectorBrushPreviewOutline } from "../brushPreview";

const s = (x: number,y: number,pressure=0.5):BrushSample=>({x,y,pressure});

describe("corner- and pressure-aware Arabic calligraphy smoothing",()=>{
  it("preserves right-angle corners and endpoints at maximal smoothing",()=>{
    const original=[s(0,0),s(40,0),s(40,40)];
    const result=smoothBrushSamples(original,0.9);
    expect(result).toEqual(original);
    const withSmoothing=vectorBrushOutline(original,{...DEFAULT_BRUSH,preset:"round",pressure:false,smoothing:0.9})!;
    const without=vectorBrushOutline(original,{...DEFAULT_BRUSH,preset:"round",pressure:false,smoothing:0})!;
    expect(geometryToPathData(withSmoothing)).toBe(geometryToPathData(without));
    expect(original[1]).toEqual(s(40,0));
  });

  it("smooths shallow hand jitter while preserving intentional large turns",()=>{
    const shallow=[s(0,0),s(12,2),s(24,0)];
    const result=smoothBrushSamples(shallow,0.8);
    expect(result[1]!.y).toBeGreaterThan(0);
    expect(result[1]!.y).toBeLessThan(2);
    expect(result[1]!.x).toBeCloseTo(12,7);
    expect(result[0]).toBe(shallow[0]);
    expect(result[2]).toBe(shallow[2]);
    const square=[s(0,0),s(25,0),s(25,25),s(50,25)];
    expect(smoothBrushSamples(square,0.8)).toEqual(square);
  });

  it("does not shift unevenly sampled points along a straight stroke",()=>{
    const original=[s(0,0),s(1,0),s(40,0),s(150,0)];
    const smoothed=smoothBrushSamples(original,0.8);
    expect(smoothed.map(p=>p.x)).toEqual([0,1,40,150]);
    expect(smoothed.every(p=>p.y===0)).toBe(true);
    const unevenSlope=[s(0,0),s(2,4),s(20,40)];
    expect(smoothBrushSamples(unevenSlope,0.8)[1]).toMatchObject({x:2,y:4});
  });

  it("preserves strong pressure peaks/dips but gently smooths small pressure noise",()=>{
    const peak=[s(0,0,0.3),s(10,0,0.98),s(20,0,0.3)];
    const trough=[s(0,0,0.9),s(10,0,0.2),s(20,0,0.9)];
    expect(smoothBrushSamples(peak,0.8)[1]!.pressure).toBe(0.98);
    expect(smoothBrushSamples(trough,0.8)[1]!.pressure).toBe(0.2);
    const slight=[s(0,0,0.5),s(10,0,0.56),s(20,0,0.5)];
    const result=smoothBrushSamples(slight,0.8);
    expect(result[1]!.pressure).toBeLessThan(0.56);
    expect(result[1]!.pressure).toBeGreaterThan(0.5);
  });

  it("keeps previews and final SVG geometry coherent for all three nib presets",()=>{
    const points=[s(0,0,0.2),s(12,2,0.5),s(24,0,0.8),s(24,24,1),s(45,24,0.3)];
    for(const preset of ["round","qalam","taper"] as const){
      const settings={...DEFAULT_BRUSH,preset,smoothing:0.8};
      const preview=vectorBrushPreviewOutline(points,settings,1)!;
      const final=vectorBrushOutline(points,settings)!;
      expect(preview).toEqual(final);
      expect(final.closed).toBe(true);
      expect(geometryToPathData(final)).not.toMatch(/NaN|Infinity/);
    }
  });

  it("maintains legacy no-smoothing semantics and handles malformed settings conservatively",()=>{
    const raw=[s(0,0),s(15,3),s(25,0)];
    expect(smoothBrushSamples(raw,0)).toBe(raw);
    expect(smoothBrushSamples(raw,NaN)).toBe(raw);
    expect(smoothBrushSamples(raw,-1)).toBe(raw);
    expect(smoothBrushSamples(raw,1)).toBe(raw);
    expect(vectorBrushOutline(raw,{...DEFAULT_BRUSH,smoothing:NaN})).toBeNull();
  });
});
