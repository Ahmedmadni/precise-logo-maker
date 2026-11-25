import { describe, it, expect } from "vitest";
import { COMPOSITION_PRESETS, guideSvgPath } from "./compositionPresets";
import { validGuide, sampleGuide } from "./freePathLayout";

describe("composition presets",()=>{
  it("provides unique and editable valid guide chains",()=>{
    expect(new Set(COMPOSITION_PRESETS.map(p=>p.id)).size).toBe(COMPOSITION_PRESETS.length);
    for(const p of COMPOSITION_PRESETS){
      expect(validGuide(p.guide)).toBe(true);
      expect(guideSvgPath(p.guide)).toMatch(/^M /);
      expect(p.options.scale).toBeGreaterThanOrEqual(.5);
      expect(p.options.scale).toBeLessThanOrEqual(3);
    }
  });
  it("produces distinct positions for the minimum word count",()=>{
    for(const p of COMPOSITION_PRESETS){
      const samples=sampleGuide(p.guide,p.minWords,p.options.margin,p.options.reverse);
      expect(samples).toHaveLength(p.minWords);
      expect(new Set(samples.map(s=>s.point.x.toFixed(3)+":"+s.point.y.toFixed(3))).size).toBe(p.minWords);
    }
  });
});
