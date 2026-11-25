import { describe, expect, it } from "vitest";
import { measureOpticalGaps, suggestOpticalArrangement } from "./opticalSpacing";
import type { LetteringItem } from "./model";

const glyph = (id:string,x:number):LetteringItem => ({
  id,kind:"outline",x,y:100,size:100,rotation:0,color:"#111111",
  unitsPerEm:1000,pathData:"M 0 0 L 300 0 L 300 100 L 0 100 Z",
});

describe("optical spacing",()=>{
  it("measures constant rectangular clearances",()=>{
    const gaps=measureOpticalGaps([glyph("r",200),glyph("m",130),glyph("l",0)]);
    expect(gaps.map(g=>g.median)).toEqual([40,100]);
    expect(gaps.every(g=>g.samples===32&&g.overlapRows===0)).toBe(true);
  });
  it("equalizes median clearances with fixed endpoints",()=>{
    const items=[glyph("r",200),glyph("m",130),glyph("l",0)];
    const p=suggestOpticalArrangement(items);
    expect(p?.patches).toEqual([{id:"m",patch:{x:100}}]);
    expect(p?.beforeSpread).toBe(60);
    expect(p?.afterSpread).toBe(0);
  });
  it("supports partial correction",()=>{
    const p=suggestOpticalArrangement([glyph("r",200),glyph("m",130),glyph("l",0)],0.5);
    expect(p?.patches).toEqual([{id:"m",patch:{x:115}}]);
    expect(p?.afterSpread).toBe(30);
  });
  it("does not invent a proposal for non-overlapping vertical ranges",()=>{
    expect(suggestOpticalArrangement([glyph("r",200),{...glyph("m",130),y:500},glyph("l",0)])).toBeNull();
  });
  it("does not worsen existing sampled negative clearance",()=>{
    const items=[glyph("r",200),glyph("m",190),glyph("l",0)];
    const p=suggestOpticalArrangement(items);
    expect(p).not.toBeNull();
    const revised=items.map(g=>({...g,...p?.patches.find(q=>q.id===g.id)?.patch}));
    expect(measureOpticalGaps(revised)[0]?.minimum).toBeGreaterThanOrEqual(-20);
  });
});
