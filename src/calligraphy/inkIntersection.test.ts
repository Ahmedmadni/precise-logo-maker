import {describe,it,expect} from "vitest";
import {analyzeGlyphInk} from "./bakeUnion";
import type {LetteringItem} from "./model";
const glyph=(id:string,pathData:string,patch:Partial<LetteringItem>={}):LetteringItem=>({id,kind:"outline",x:0,y:0,size:100,unitsPerEm:100,rotation:0,color:"#000",pathData,...patch});
const box=(x:number,y:number,w:number,h:number)=>`M ${x} ${y} L ${x+w} ${y} L ${x+w} ${y+h} L ${x} ${y+h} Z`;
const candidates=[{a:"a",b:"b"}];
describe("filled ink intersection",()=>{
  it("measures true intersection area and the smaller glyph coverage",()=>{
    const result=analyzeGlyphInk([glyph("a",box(0,0,10,10)),glyph("b",box(5,0,10,10))],candidates);
    expect(result.checked).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.pairs[0]?.area).toBeCloseTo(50);
    expect(result.pairs[0]?.ratio).toBeCloseTo(.5);
    expect(result.pairs[0]?.path).toContain("Z");
  });
  it("does not treat a glyph inside an even-odd counter as ink collision",()=>{
    const a=glyph("a",box(0,0,20,20)+" "+box(5,5,10,10),{fillRule:"evenodd"});
    const result=analyzeGlyphInk([a,glyph("b",box(7,7,4,4))],candidates);
    expect(result.checked).toBe(1);
    expect(result.pairs).toEqual([]);
  });
  it("ignores zero-area contact at an edge",()=>{
    const result=analyzeGlyphInk([glyph("a",box(0,0,10,10)),glyph("b",box(10,0,10,10))],candidates);
    expect(result.checked).toBe(1);
    expect(result.pairs).toEqual([]);
  });
  it("reports unsupported weighted or missing outlines as skipped",()=>{
    const result=analyzeGlyphInk([glyph("a",box(0,0,10,10),{weight:2}),glyph("b",box(5,0,10,10))],candidates);
    expect(result.checked).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.pairs).toEqual([]);
  });
});
