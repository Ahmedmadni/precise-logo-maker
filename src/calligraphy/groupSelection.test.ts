import {describe,it,expect} from "vitest";
import type {LetteringItem} from "./model";
import {glyphLassoHits,groupMoveIds,translateGlyphSelection} from "./groupSelection";
const glyph=(id:string,x:number):LetteringItem=>({id,kind:"outline",x,y:0,size:100,rotation:0,color:"#000",unitsPerEm:100,pathData:"M 0 0 L 10 0 L 10 10 L 0 10 Z"});
const a=glyph("a",0),b=glyph("b",40);
const mark:LetteringItem={id:"mark",kind:"haraka",x:5,y:-20,size:12,rotation:0,color:"#000",mark:"fatha",attachedToGlyphId:"a",anchorMode:"manual"};
const bridge:LetteringItem={id:"bridge",kind:"bridge",x:0,y:0,size:100,rotation:0,color:"#000",ribbon:{sourceGlyphId:"a",targetGlyphId:"b",sourceSide:"exit",targetSide:"entry",startWidth:5,endWidth:5,tension:.3,curvature:0}};
describe("glyph group selection",()=>{
  it("selects visible outlined glyphs by transformed bounds center",()=>{
    expect(glyphLassoHits([a,b,mark,{...a,id:"hidden",hidden:true}],[{x:-1,y:-11},{x:15,y:-11},{x:15,y:1},{x:-1,y:1}])).toEqual(["a"]);
  });
  it("moves attached marks exactly once while preserving attachment and geometry",()=>{
    const moved=translateGlyphSelection([a,b,mark],["a"],7,9)!;
    expect(moved[0]).toMatchObject({x:7,y:9,pathData:a.pathData});
    expect(moved[2]).toMatchObject({x:12,y:-11,attachedToGlyphId:"a",anchorMode:"manual"});
    expect(moved[1]).toBe(b);
    expect(a.x).toBe(0);
  });
  it("rejects a selection spanning only one end of a live bridge",()=>{
    expect(groupMoveIds([a,b,bridge],["a"])).toEqual({ok:false,reason:"bridge"});
    expect(translateGlyphSelection([a,b,bridge],["a"],5,0)).toBeNull();
    const moved=translateGlyphSelection([a,b,bridge],["a","b"],5,0)!;
    expect(moved[0]?.x).toBe(5);
    expect(moved[1]?.x).toBe(45);
    expect(moved[2]).toBe(bridge);
  });
  it("rejects hidden, missing or non-outline selections",()=>{
    expect(groupMoveIds([a,mark],["mark"])).toEqual({ok:false,reason:"selection"});
    expect(groupMoveIds([{...a,hidden:true}],["a"])).toEqual({ok:false,reason:"selection"});
    expect(translateGlyphSelection([a],["missing"],1,1)).toBeNull();
  });
});
