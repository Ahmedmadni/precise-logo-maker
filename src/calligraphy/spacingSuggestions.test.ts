import {describe,it,expect} from "vitest";
import {suggestGlyphSpacing,pickSpacingSuggestion} from "./spacingSuggestions";
import type {LetteringItem} from "./model";
const glyph=(id:string,x:number):LetteringItem=>({id,kind:"outline",x,y:0,size:100,unitsPerEm:100,rotation:0,color:"#000",pathData:"M 0 0 L 10 0 L 10 10 L 0 10 Z"});
const a=glyph("a",0),b=glyph("b",30);
describe("ink-aware spacing suggestions",()=>{
  it("evaluates six alternatives without modifying the source",()=>{
    const result=suggestGlyphSpacing([a,b],["a","b"],"x");
    expect(result.ok).toBe(true);
    if(result.ok){
      expect(result.options).toHaveLength(6);
      expect(result.options[0]?.gap).toBeCloseTo(-3.5);
      expect(result.options[0]?.maxRatio).toBeCloseTo(.35);
      expect(result.options[0]?.span).toBeCloseTo(16.5);
    }
    expect(b.x).toBe(30);
  });
  it("selects the tightest evaluated arrangement under the chosen overlap limit",()=>{
    const result=suggestGlyphSpacing([a,b],["a","b"],"x");
    if(!result.ok)throw Error("expected suggestions");
    expect(pickSpacingSuggestion(result.options,0)?.gap).toBe(0);
    expect(pickSpacingSuggestion(result.options,.2)?.gap).toBe(-2);
    expect(pickSpacingSuggestion(result.options,.35)?.gap).toBe(-3.5);
  });
  it("rejects weighted outlines and selections outside supported size",()=>{
    expect(suggestGlyphSpacing([{...a,weight:2},b],["a","b"],"x")).toEqual({ok:false,reason:"unsupported"});
    expect(suggestGlyphSpacing([a],["a"],"x")).toEqual({ok:false,reason:"selection"});
  });
});
