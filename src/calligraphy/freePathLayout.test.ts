import { describe, expect, it } from "vitest";
import { DEFAULT_GUIDE, sampleGuide, splitGuideSegment, moveGuidePoint, validGuide, composeFreePath } from "./freePathLayout";
import type { LetteringItem } from "./model";
const glyph=(id:string,x:number,glyphIndex:number):LetteringItem=>({id,kind:"outline",x,y:100,size:100,rotation:0,color:"#111111",unitsPerEm:1000,pathData:"M 0 0 L 300 0 L 300 100 L 0 100 Z",glyphIndex});
const straight=[{x:90,y:50},{x:65,y:50},{x:35,y:50},{x:10,y:50}];

describe("free path guides",()=>{
  it("preserves the sampled curve when subdividing",()=>{
    const split=splitGuideSegment(DEFAULT_GUIDE,0);
    expect(split).toHaveLength(7);
    const a=sampleGuide(DEFAULT_GUIDE,11),b=sampleGuide(split,11);
    expect(b).toHaveLength(a.length);
    a.forEach((s,i)=>{
      expect(Math.hypot(s.point.x-b[i]!.point.x,s.point.y-b[i]!.point.y)).toBeLessThan(.02);
    });
  });
  it("reverses positions and tangent directions",()=>{
    const a=sampleGuide(straight,3),b=sampleGuide(straight,3,0,true);
    expect(b[0]?.point).toEqual(a[2]?.point);
    expect(b[0]?.angle).toBeCloseTo(0);
  });
  it("keeps linked handles collinear on a shared anchor",()=>{
    const split=splitGuideSegment(DEFAULT_GUIDE,0);
    const result=moveGuidePoint(split,2,{x:65,y:30},true);
    const a=result[3]!,p=result[2]!,q=result[4]!;
    expect((p.x-a.x)*(q.y-a.y)-(p.y-a.y)*(q.x-a.x)).toBeCloseTo(0);
    expect((p.x-a.x)*(q.x-a.x)+(p.y-a.y)*(q.y-a.y)).toBeLessThan(0);
    expect(validGuide(result)).toBe(true);
  });
  it("rejects malformed or collapsed guides",()=>{
    expect(validGuide([{x:1,y:1}])).toBe(false);
    expect(sampleGuide(Array.from({length:4},()=>({x:0,y:0})),3)).toEqual([]);
  });
  it("distributes outlines with stable glyph order without mutating input",()=>{
    const items=[glyph("left",0,0),glyph("right",100,1)];
    const patches=composeFreePath(items,straight,{scale:1,margin:0,reverse:false,tangent:true,upright:true});
    expect(patches.map(p=>p.id)).toEqual(["right","left"]);
    expect(patches[0]!.patch.x!).toBeGreaterThan(patches[1]!.patch.x!);
    expect(patches[0]!.patch.rotation).toBeCloseTo(0);
    expect(items[0]!.x).toBe(0);
  });
});
