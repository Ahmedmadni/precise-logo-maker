import { describe, expect, it } from "vitest";
import type { LetteringItem } from "./model";
import { DEFAULT_RIBBON, sampleRibbon, buildRibbonPath, ribbonRenderSteps, type RibbonLink } from "./ribbonJoin";

const source: LetteringItem = {id:"a",kind:"outline",x:0,y:0,size:100,rotation:0,color:"#000",joinAnchors:{exit:{x:0,y:0}}};
const target: LetteringItem = {...source,id:"b",x:120,joinAnchors:{entry:{x:0,y:0}}};
const spec: RibbonLink = {...DEFAULT_RIBBON,sourceGlyphId:"a",targetGlyphId:"b",sourceSide:"exit",targetSide:"entry",startWidth:8,endWidth:20};
const bridge = (ribbon:RibbonLink):LetteringItem => ({id:"r",kind:"bridge",x:0,y:0,size:1000,rotation:0,color:"#000",ribbon});

describe("ribbon refinement",()=>{
  it("keeps simple straight joins at legacy resolution",()=>{
    expect(ribbonRenderSteps({...spec,nibContrast:0})).toBe(16);
  });
  it("increases resolution for complex joins",()=>{
    expect(ribbonRenderSteps({...spec,curvature:0.4,startAngle:50,endAngle:-45})).toBeGreaterThan(16);
    expect(ribbonRenderSteps({...spec,curvature:0.5,startAngle:70,endAngle:-70,nibContrast:0.8})).toBeLessThanOrEqual(64);
  });
  it("preserves exact cap widths despite nib contrast",()=>{
    const s=sampleRibbon(bridge({...spec,curvature:0.3,nibContrast:0.8}),[source,target],64)!;
    expect(s[0]!.width).toBe(8);
    expect(s.at(-1)!.width).toBe(20);
    expect(s.every(p=>Number.isFinite(p.width)&&p.width>0)).toBe(true);
  });
  it("exports a finite closed cubic outline",()=>{
    const d=buildRibbonPath(bridge({...spec,curvature:0.3,startAngle:25,endAngle:-20}),[source,target]);
    expect(d).not.toBeNull();
    expect(d).toMatch(/^M .* C .* Z$/);
    expect(d).not.toMatch(/NaN|Infinity/);
  });
});
