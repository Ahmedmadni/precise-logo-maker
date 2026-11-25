import { describe, expect, it } from "vitest";
import { DEFAULT_GUIDE, sampleGuide, splitGuideSegment, moveGuidePoint, validGuide, composeFreePath, composeWordGroupsOnPath } from "./freePathLayout";
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


describe("intact word composition",()=>{
  it("moves each word rigidly in explicit selection order",()=>{
    const items=[{...glyph("a",100,0),groupId:"first"},{...glyph("b",130,1),groupId:"first",rotation:15},{...glyph("c",0,0),groupId:"second"}];
    const patches=composeWordGroupsOnPath(items,["first","second"],straight,{scale:1,margin:0,reverse:false,tangent:false,upright:true});
    expect(patches).toHaveLength(3);
    const a=patches.find(p=>p.id==="a")!.patch,b=patches.find(p=>p.id==="b")!.patch;
    expect(b.x!-a.x!).toBeCloseTo(30);
    expect(b.y!-a.y!).toBeCloseTo(0);
    expect(b.rotation).toBeUndefined();
    expect(a.x!).toBeGreaterThan(patches.find(p=>p.id==="c")!.patch.x!);
  });
  it("requires two distinct valid groups",()=>{
    const items=[{...glyph("a",100,0),groupId:"first"}];
    expect(composeWordGroupsOnPath(items,["first","first"],straight,{scale:1,margin:0,reverse:false,tangent:false,upright:true})).toEqual([]);
  });
});


describe("rigid tangent word rotation",()=>{
  it("preserves distances and relative rotations including attached marks",()=>{
    const items:LetteringItem[]=[
      {...glyph("a",100,0),groupId:"first"},
      {...glyph("b",130,1),groupId:"first",rotation:15},
      {...glyph("c",0,0),groupId:"second"},
      {id:"mark",kind:"haraka",x:100,y:80,size:12,rotation:0,color:"#111111",mark:"fatha",attachedToGlyphId:"a",anchorMode:"auto"},
    ];
    const vertical=[{x:50,y:10},{x:50,y:35},{x:50,y:65},{x:50,y:90}];
    const opts={scale:1,margin:0,reverse:false,tangent:true,upright:true};
    const patches=composeWordGroupsOnPath(items,["first","second"],vertical,opts);
    const a=patches.find(p=>p.id==="a")!.patch,b=patches.find(p=>p.id==="b")!.patch,m=patches.find(p=>p.id==="mark")!.patch;
    expect(a.rotation).toBeCloseTo(90);
    expect(b.rotation!-a.rotation!).toBeCloseTo(15);
    expect(Math.hypot(b.x!-a.x!,b.y!-a.y!)).toBeCloseTo(30);
    expect(Math.hypot(m.x!-a.x!,m.y!-a.y!)).toBeCloseTo(20);
    expect(m.anchorMode).toBe("manual");
    const moved=items.map(g=>({...g,...patches.find(p=>p.id===g.id)?.patch}));
    const second=composeWordGroupsOnPath(moved,["first","second"],vertical,opts);
    expect(second.find(p=>p.id==="a")?.patch.rotation).toBeCloseTo(90);
    expect(second.find(p=>p.id==="b")?.patch.rotation).toBeCloseTo(105);
  });
});
