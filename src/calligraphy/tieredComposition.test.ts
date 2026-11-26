import {describe,it,expect} from "vitest";
import {composeGlyphTiers,tierSelectionFits,type TierOptions} from "./tieredComposition";
import type {LetteringItem} from "./model";
const glyph=(id:string,x:number,y=0,groupId?:string):LetteringItem=>({id,kind:"outline",x,y,size:100,unitsPerEm:100,rotation:0,color:"#000",pathData:"M 0 0 L 10 0 L 10 10 L 0 10 Z",groupId});
const options:TierOptions={rows:2,style:"balanced",horizontalGap:4,verticalGap:5,stagger:10};
describe("tiered composition",()=>{
  it("keeps whole words rigid and attached marks at their original offsets",()=>{
    const a=glyph("a",100,50,"word"),b=glyph("b",88,50,"word"),c=glyph("c",40,50);
    const mark:LetteringItem={id:"m",kind:"haraka",x:102,y:30,rotation:0,size:12,color:"#000",mark:"fatha",attachedToGlyphId:"a",anchorMode:"manual"};
    const r=composeGlyphTiers([a,b,c,mark],["a","b","c"],options);
    if(!r.ok)throw Error(r.reason);
    expect(r.blocks).toBe(2);
    expect(r.items[0]!.x-r.items[1]!.x).toBeCloseTo(12);
    expect(r.items[0]!.y-r.items[1]!.y).toBeCloseTo(0);
    expect(r.items[3]!.x-r.items[0]!.x).toBeCloseTo(2);
    expect(r.items[3]!.y-r.items[0]!.y).toBeCloseTo(-20);
    expect(r.items[2]!.y-r.items[0]!.y).toBeCloseTo(15);
    expect(a.x).toBe(100);
  });
  it("rejects an incomplete word selection",()=>{
    expect(composeGlyphTiers([glyph("a",100,50,"w"),glyph("b",85,50,"w"),glyph("c",40)],["a","c"],options)).toEqual({ok:false,reason:"partial-word"});
  });
  it("shifts the second row in a cascade while retaining vertical spacing",()=>{
    const a=glyph("a",100),b=glyph("b",40);
    const r=composeGlyphTiers([a,b],["a","b"],{...options,style:"cascade"});
    if(!r.ok)throw Error(r.reason);
    expect(r.items[1]!.x-r.items[0]!.x).toBeCloseTo(10);
    expect(r.items[1]!.y-r.items[0]!.y).toBeCloseTo(15);
  });
  it("rejects an unsafe negative row gap and insufficient blocks",()=>{
    const items=[glyph("a",100),glyph("b",40)];
    expect(composeGlyphTiers(items,["a","b"],{...options,verticalGap:-10})).toEqual({ok:false,reason:"overlap"});
    expect(composeGlyphTiers(items,["a","b"],{...options,rows:3})).toEqual({ok:false,reason:"selection"});
  });
});

describe("tier layout reading order and safe application",()=>{
  it("reads existing rows from top to bottom before sorting each row RTL",()=>{
    const items=[glyph("a",120,30),glyph("b",80,30),glyph("c",120,75),glyph("d",80,75)];
    const ids=items.map(i=>i.id);
    const r=composeGlyphTiers(items,ids,options);
    if(!r.ok)throw Error(r.reason);
    expect(r.items[0]!.y).toBeCloseTo(r.items[1]!.y);
    expect(r.items[2]!.y).toBeCloseTo(r.items[3]!.y);
    expect(r.items[0]!.x).toBeGreaterThan(r.items[1]!.x);
    expect(r.items[0]!.y).toBeLessThan(r.items[2]!.y);
    const again=composeGlyphTiers(r.items,ids,options);
    if(!again.ok)throw Error(again.reason);
    expect(again.changed).toBe(false);
  });
  it("rejects visible attached marks outside the artboard",()=>{
    const a=glyph("a",100,100);
    const m:LetteringItem={id:"m",kind:"haraka",x:100,y:-10,rotation:0,size:20,color:"#000",mark:"fatha",attachedToGlyphId:"a"};
    expect(tierSelectionFits([a],["a"],{width:200,height:200})).toBe(true);
    expect(tierSelectionFits([a,m],["a"],{width:200,height:200})).toBe(false);
    expect(tierSelectionFits([a,{...m,hidden:true}],["a"],{width:200,height:200})).toBe(true);
  });
  it("rejects empty selections and malformed artboard dimensions",()=>{
    const a=glyph("a",100,100);
    expect(tierSelectionFits([a],[],{width:200,height:200})).toBe(false);
    expect(tierSelectionFits([a],["a"],{width:NaN,height:200})).toBe(false);
  });
});
