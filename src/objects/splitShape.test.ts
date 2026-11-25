import {describe,it,expect} from "vitest";
import type {PathGeometry,Point} from "../core/geometry/types";
import {splitShape,splitShapeAtAngle,angledCutGuide,knifeLineParameters,curvedCutGuide,splitShapeCurved} from "./splitShape";
const box=(x:number,y:number,w:number,h:number):Point[]=>[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];
const area=(ring:Point[])=>Math.abs(ring.reduce((sum,p,i)=>{const q=ring[(i+1)%ring.length]!;return sum+p.x*q.y-q.x*p.y;},0)/2);
const filled=(g:PathGeometry)=>area(g.points)-(g.holes??[]).reduce((s,r)=>s+area(r),0);
const path:PathGeometry={kind:"path",closed:true,points:box(0,0,100,100),holes:[box(10,10,20,20)]};
describe("shape splitting",()=>{
  it("preserves a hole wholly on one side",()=>{
    const result=splitShape(path,"x",.5);
    expect(result.ok).toBe(true);
    if(!result.ok)throw new Error("split failed");
    expect(result.parts).toHaveLength(2);
    expect(result.parts[0]?.holes).toHaveLength(1);
    expect(result.parts[1]?.holes).toBeUndefined();
    expect(result.parts.reduce((s,p)=>s+filled(p),0)).toBeCloseTo(filled(path));
  });
  it("opens a hole intersected by the cut while preserving total filled area",()=>{
    const result=splitShape(path,"y",.2);
    expect(result.ok).toBe(true);
    if(!result.ok)throw new Error("split failed");
    expect(result.parts.every(p=>!p.holes?.length)).toBe(true);
    expect(result.parts.reduce((s,p)=>s+filled(p),0)).toBeCloseTo(filled(path));
  });
  it("rejects open shapes and endpoint cuts",()=>{
    expect(splitShape({...path,closed:false},"x",.5)).toEqual({ok:false,reason:"invalid"});
    expect(splitShape(path,"x",0)).toEqual({ok:false,reason:"invalid"});
  });
});

describe("angled shape splitting",()=>{
  it("uses the same geometry for the legacy vertical and horizontal cuts",()=>{
    expect(splitShapeAtAngle(path,0,.5)).toEqual(splitShape(path,"x",.5));
    expect(splitShapeAtAngle(path,90,.2)).toEqual(splitShape(path,"y",.2));
  });
  it("preserves filled area for a diagonal cut",()=>{
    const result=splitShapeAtAngle(path,45,.5);
    expect(result.ok).toBe(true);
    if(result.ok)expect(result.parts.reduce((s,p)=>s+filled(p),0)).toBeCloseTo(filled(path),6);
  });
  it("shares an identical cut boundary between the two cutters",()=>{
    const guide=angledCutGuide(path,30,.37)!;
    expect(guide.first.points[1]).toEqual(guide.second.points[0]);
    expect(guide.first.points[2]).toEqual(guide.second.points[3]);
    expect(guide.start).toEqual(guide.first.points[1]);
    expect(guide.end).toEqual(guide.first.points[2]);
  });
  it("rejects invalid angles without modifying the source",()=>{
    expect(splitShapeAtAngle(path,NaN,.5)).toEqual({ok:false,reason:"invalid"});
    expect(splitShapeAtAngle(path,30,1)).toEqual({ok:false,reason:"invalid"});
    expect(path.holes?.[0]).toEqual(box(10,10,20,20));
  });
});

describe("knife gesture geometry",()=>{
  it("maps a vertical drawn line to the same cut as the inspector",()=>{
    const p=knifeLineParameters(path,{x:40,y:-20},{x:40,y:120});
    expect(p?.degrees).toBeCloseTo(0);
    expect(p?.fraction).toBeCloseTo(.4);
  });
  it("produces the same cut line when the gesture direction reverses",()=>{
    const a=knifeLineParameters(path,{x:10,y:0},{x:90,y:100})!;
    const b=knifeLineParameters(path,{x:90,y:100},{x:10,y:0})!;
    expect(a.fraction+b.fraction).toBeCloseTo(1);
    const result=splitShapeAtAngle(path,a.degrees,a.fraction);
    expect(result.ok).toBe(true);
    if(result.ok)expect(result.parts.reduce((s,p)=>s+filled(p),0)).toBeCloseTo(filled(path),6);
  });
  it("rejects degenerate and out-of-bounds cuts",()=>{
    expect(knifeLineParameters(path,{x:20,y:20},{x:20,y:20})).toBeNull();
    expect(knifeLineParameters(path,{x:120,y:0},{x:120,y:100})).toBeNull();
  });
});

describe("curved shape splitting",()=>{
  it("uses an identical shared boundary for both cutters",()=>{
    const guide=curvedCutGuide(path,25,.5,.8)!;
    expect(guide.curve.length).toBeGreaterThan(2);
    expect(guide.first.points.slice(1,-1)).toEqual(guide.curve);
    expect([guide.second.points[0],...guide.second.points.slice(3).reverse()]).toEqual(guide.curve);
  });
  it("preserves total polygon area for both signs of bend",()=>{
    for(const bend of [-.8,.8]){
      const result=splitShapeCurved(path,30,.5,bend);
      expect(result.ok).toBe(true);
      if(result.ok)expect(result.parts.reduce((s,p)=>s+filled(p),0)).toBeCloseTo(filled(path),6);
    }
  });
  it("reduces a zero bend to the straight cutter",()=>{
    const straight=angledCutGuide(path,45,.4)!;
    const curved=curvedCutGuide(path,45,.4,0)!;
    expect(curved.first).toEqual(straight.first);
    expect(curved.second).toEqual(straight.second);
  });
  it("rejects excessive or nonfinite curvature and open shapes",()=>{
    expect(splitShapeCurved(path,0,.5,2)).toEqual({ok:false,reason:"invalid"});
    expect(splitShapeCurved(path,0,.5,NaN)).toEqual({ok:false,reason:"invalid"});
    expect(splitShapeCurved({...path,closed:false},0,.5,.5)).toEqual({ok:false,reason:"invalid"});
  });
});
