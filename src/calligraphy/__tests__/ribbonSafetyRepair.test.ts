import { describe, expect, it } from "vitest";
import { createLettering, type LetteringItem } from "../model";
import { createRibbonLink, buildRibbonPath } from "../ribbonJoin";
import { analyzeRibbonSafety, suggestRibbonSafetyAdjustment } from "../ribbonSafety";
import { bakeRibbonAsOutline } from "../bakeUnion";

const glyph = (id:string,x:number):LetteringItem => ({
  ...createLettering(x,100),id,kind:"outline",
  color:"#123456",size:200,unitsPerEm:1000,rotation:0,
  pathData:"M0 0 L100 0 L100 100 L0 100 Z",
  joinAnchors:{entry:{x:100,y:50},exit:{x:0,y:50}},
});
const source=glyph("a",100),far=glyph("far",500),near=glyph("near",155);

describe("non-destructive Arabic ribbon safety suggestions",()=>{
  it("returns no patch on a healthy connection or invalid geometry",()=>{
    const ribbon=createRibbonLink(source,far)!;
    expect(analyzeRibbonSafety(ribbon,[source,far])?.needsReview).toBe(false);
    expect(suggestRibbonSafetyAdjustment(ribbon,[source,far])).toBeNull();
    expect(suggestRibbonSafetyAdjustment(ribbon,[source])).toBeNull();
  });

  it("reduces an oversized cap without touching original letters or losing SVG geometry",()=>{
    const ribbon=createRibbonLink(source,near)!;
    const unsafe={...ribbon,ribbon:{...ribbon.ribbon!,startWidth:110,endWidth:110}};
    const beforePath=buildRibbonPath(unsafe,[source,near]);
    const before=analyzeRibbonSafety(unsafe,[source,near])!;
    expect(before.needsReview).toBe(true);
    expect(before.widthRatio).toBeGreaterThan(0.7);
    const suggestion=suggestRibbonSafetyAdjustment(unsafe,[source,near])!;
    expect(suggestion).not.toBeNull();
    expect(suggestion.changes.length).toBeGreaterThan(0);
    expect(suggestion.ribbon.startWidth).toBeLessThan(110);
    expect(suggestion.ribbon.endWidth).toBeLessThan(110);
    expect(suggestion.after.widthRatio).toBeLessThan(before.widthRatio);
    expect(suggestion.after.edgeCrossings).toBeLessThanOrEqual(before.edgeCrossings);
    const repaired={...unsafe,ribbon:suggestion.ribbon};
    expect(buildRibbonPath(repaired,[source,near])).not.toBe(beforePath);
    expect(buildRibbonPath(repaired,[source,near])).toContain(" C ");
    expect(unsafe.ribbon.startWidth).toBe(110);
    expect(source.pathData).toBe("M0 0 L100 0 L100 100 L0 100 Z");
    expect(near.pathData).toBe(source.pathData);
  });

  it("does not claim a geometric repair if no measurable issue was improved",()=>{
    const item=createRibbonLink(source,near)!;
    const spec={...item.ribbon!,startWidth:0.8,endWidth:0.8};
    const valid={...item,ribbon:spec};
    const result=suggestRibbonSafetyAdjustment(valid,[source,near]);
    if(result){
      const before=analyzeRibbonSafety(valid,[source,near])!;
      expect(result.after.edgeCrossings).toBeLessThanOrEqual(before.edgeCrossings);
      expect(result.after.sharpTurns).toBeLessThanOrEqual(before.sharpTurns);
    }
  });

  it("refuses to bake a ribbon with visibly crossed sample edges",()=>{
    const left=glyph("left",0),right=glyph("right",65);
    const bridge=createRibbonLink(left,right,"exit","entry")!;
    expect(bridge).not.toBeNull();
    let crossed:LetteringItem|null=null;
    for(const a of [-70,-45,0,45,70]){
      for(const b of [-70,0,70]){
        for(const bend of [-0.5,-0.25,0.25,0.5]){
          const trial={...bridge,ribbon:{...bridge.ribbon!,
            startWidth:150,endWidth:150,startAngle:a,endAngle:b,
            curvature:bend,tension:0.7}};
          if((analyzeRibbonSafety(trial,[left,right])?.edgeCrossings??0)>0){
            crossed=trial;
            break;
          }
        }
        if(crossed)break;
      }
      if(crossed)break;
    }
    expect(crossed).not.toBeNull();
    const result=bakeRibbonAsOutline([left,right,crossed!],crossed!.id);
    expect(result.ok).toBe(false);
    if(!result.ok)expect(result.reason).toMatch(/تقاطع/);
    expect(left.pathData).toBe("M0 0 L100 0 L100 100 L0 100 Z");
  });
});
