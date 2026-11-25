import {describe,it,expect} from "vitest";
import type {LetteringItem} from "./model";
import {glyphLassoHits,groupMoveIds,translateGlyphSelection,glyphGroupPivot,transformGlyphSelection,arrangeGlyphSelection} from "./groupSelection";
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


describe("group similarity transforms",()=>{
  it("uses the common outline center and scales attached marks once",()=>{
    const pivot=glyphGroupPivot([a,b,mark],["a","b"]);
    expect(pivot).toEqual({x:25,y:-5});
    const next=transformGlyphSelection([a,b,mark],["a","b"],{scale:2,degrees:0})!;
    expect(next[0]).toMatchObject({x:-25,y:5,size:200});
    expect(next[1]).toMatchObject({x:55,y:5,size:200});
    expect(next[2]).toMatchObject({x:-15,y:-35,size:24,attachedToGlyphId:"a",anchorMode:"manual"});
    expect(a.x).toBe(0);
  });
  it("rotates all anchors about the same pivot",()=>{
    const next=transformGlyphSelection([a,b],["a","b"],{scale:1,degrees:90})!;
    expect(next[0]?.x).toBeCloseTo(20);
    expect(next[0]?.y).toBeCloseTo(-30);
    expect(next[1]?.x).toBeCloseTo(20);
    expect(next[1]?.y).toBeCloseTo(10);
    expect(next[0]?.rotation).toBe(90);
  });
  it("scales both widths and rotates the ribbon nib",()=>{
    const next=transformGlyphSelection([a,b,bridge],["a","b"],{scale:2,degrees:30})!;
    expect(next[2]?.ribbon).toMatchObject({startWidth:10,endWidth:10,nibAngle:65,sourceGlyphId:"a",targetGlyphId:"b"});
    expect(transformGlyphSelection([a,b,bridge],["a"],{scale:2,degrees:30})).toBeNull();
  });
  it("rejects unsupported sizes and ribbon widths",()=>{
    expect(transformGlyphSelection([{...a,size:900}],["a"],{scale:2,degrees:0})).toBeNull();
    const thick={...bridge,ribbon:{...bridge.ribbon!,startWidth:100}};
    expect(transformGlyphSelection([a,b,thick],["a","b"],{scale:2,degrees:0})).toBeNull();
  });
});


describe("group outline alignment and distribution",()=>{
  it("aligns real outline edges and translates attached marks by the same amount",()=>{
    const raised={...b,y:20};
    const result=arrangeGlyphSelection([a,raised,mark],["a","b"],"y","max");
    expect(result.ok).toBe(true);
    if(result.ok){
      expect(result.items[0]?.y).toBeCloseTo(20);
      expect(result.items[1]).toBe(raised);
      expect(result.items[2]?.y).toBeCloseTo(0);
    }
  });
  it("distributes unequal-width glyphs by gaps rather than centers",()=>{
    const middle={...glyph("middle",15),size:200};
    const right=glyph("right",80);
    const result=arrangeGlyphSelection([a,middle,right],["a","middle","right"],"x","distribute");
    expect(result.ok).toBe(true);
    if(result.ok){
      expect(result.gap).toBeCloseTo(25);
      expect(result.items[0]).toBe(a);
      expect(result.items[1]?.x).toBeCloseTo(35);
      expect(result.items[2]).toBe(right);
    }
  });
  it("refuses insufficient space rather than forcing overlapping gaps",()=>{
    expect(arrangeGlyphSelection([a,glyph("c",3),glyph("d",6)],["a","c","d"],"x","distribute")).toEqual({ok:false,reason:"overlap"});
  });
  it("protects live joins when alignment would change their relative endpoints",()=>{
    expect(arrangeGlyphSelection([a,b,bridge],["a","b"],"x","min")).toEqual({ok:false,reason:"bridge"});
    const result=arrangeGlyphSelection([a,b,bridge],["a","b"],"y","min");
    expect(result.ok&&result.changed).toBe(false);
  });
});
