import {describe,it,expect} from "vitest";
import {decorationBounds,suggestDecorationPositions} from "./decorationPlacement";
import type {LetteringItem} from "./model";
const glyph:LetteringItem={id:"g",kind:"outline",x:100,y:100,size:100,unitsPerEm:100,rotation:0,color:"#000",pathData:"M 0 0 L 40 0 L 40 40 L 0 40 Z"};
const mark:LetteringItem={id:"m",kind:"haraka",mark:"fatha",x:120,y:30,size:20,rotation:0,color:"#000",attachedToGlyphId:"g",anchorMode:"auto"};
const board={width:300,height:300};
describe("decoration space finder",()=>{
  it("keeps an above mark above its owner with the requested clearance",()=>{
    const result=suggestDecorationPositions([glyph,mark],"m",board,4);
    expect(result.ok).toBe(true);
    if(result.ok){
      expect(result.options.length).toBeGreaterThan(0);
      for(const p of result.options){
        const b=decorationBounds({...mark,x:p.x,y:p.y},[glyph,mark])!;
        expect(b.maxY).toBeLessThanOrEqual(56+1e-7);
        expect(b.minY).toBeGreaterThanOrEqual(0);
      }
    }
    expect(mark.y).toBe(30);
  });
  it("keeps below marks below their owner",()=>{
    const below={...mark,mark:"kasra" as const};
    const result=suggestDecorationPositions([glyph,below],"m",board,4);
    expect(result.ok).toBe(true);
    if(result.ok)for(const p of result.options)expect(decorationBounds({...below,x:p.x,y:p.y},[glyph,below])!.minY).toBeGreaterThanOrEqual(104-1e-7);
  });
  it("rejects a fully occupied artboard and unsupported live text",()=>{
    expect(suggestDecorationPositions([glyph,mark],"m",board,4,[{minX:0,minY:0,maxX:300,maxY:300}])).toEqual({ok:false,reason:"space"});
    expect(suggestDecorationPositions([glyph,mark,{...glyph,id:"text",kind:"text",text:"نص"}],"m",board)).toEqual({ok:false,reason:"unsupported"});
  });
  it("suggests independent ornament positions inside the artboard",()=>{
    const ornament:LetteringItem={...mark,id:"o",kind:"ornament",ornament:"diamond",attachedToGlyphId:undefined,x:160,y:100};
    const result=suggestDecorationPositions([glyph,ornament],"o",board,4);
    expect(result.ok).toBe(true);
    if(result.ok)for(const p of result.options){
      const b=decorationBounds({...ornament,x:p.x,y:p.y},[glyph,ornament])!;
      expect(b.minX).toBeGreaterThanOrEqual(0);
      expect(b.maxX).toBeLessThanOrEqual(300);
    }
  });
});
