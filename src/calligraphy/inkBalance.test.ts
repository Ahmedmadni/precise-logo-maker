import {describe,it,expect} from "vitest";
import {analyzeInkBalance} from "./bakeUnion";
import type {LetteringItem} from "./model";
const glyph=(id:string,pathData:string,patch:Partial<LetteringItem>={}):LetteringItem=>({id,kind:"outline",x:0,y:0,size:100,unitsPerEm:100,rotation:0,color:"#000",pathData,...patch});
const box=(x:number,y:number,w:number,h:number)=>`M ${x} ${y} L ${x+w} ${y} L ${x+w} ${y+h} L ${x} ${y+h} Z`;
describe("ink balance",()=>{
  it("measures a rectangle's centroid and equal quadrants",()=>{
    const result=analyzeInkBalance([glyph("a",box(0,0,20,10))],["a"]);
    if(!result.ok)throw Error("expected ink balance");
    expect(result.area).toBeCloseTo(200);
    expect(result.centroid).toEqual({x:10,y:-5});
    expect(result.density).toBeCloseTo(1);
    for(const q of result.quadrants)expect(q).toBeCloseTo(.25);
  });
  it("counts overlapping ink once",()=>{
    const result=analyzeInkBalance([glyph("a",box(0,0,10,10)),glyph("b",box(5,0,10,10))],["a","b"]);
    if(!result.ok)throw Error("expected ink balance");
    expect(result.area).toBeCloseTo(150);
    expect(result.centroid.x).toBeCloseTo(7.5);
  });
  it("subtracts the area and moment of an asymmetric hole",()=>{
    const item=glyph("a",box(0,0,20,20)+" "+box(2,2,6,6),{fillRule:"evenodd"});
    const result=analyzeInkBalance([item],["a"]);
    if(!result.ok)throw Error("expected ink balance");
    expect(result.area).toBeCloseTo(364);
    expect(result.centroid.x).toBeCloseTo((400*10-36*5)/364);
    expect(result.centroid.y).toBeCloseTo(-(400*10-36*5)/364);
    expect(result.quadrants.reduce((s,v)=>s+v,0)).toBeCloseTo(1);
  });
  it("rejects unsupported weights rather than reporting misleading balance",()=>{
    expect(analyzeInkBalance([glyph("a",box(0,0,10,10),{weight:2})],["a"])).toEqual({ok:false,reason:"unsupported"});
    expect(analyzeInkBalance([],[])).toEqual({ok:false,reason:"selection"});
  });
});
