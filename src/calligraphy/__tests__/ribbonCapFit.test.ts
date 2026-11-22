import { describe, expect, it } from "vitest";
import { createLettering, type LetteringItem } from "../model";
import { suggestRibbonCapFit } from "../ribbonCapFit";
import { analyzeRibbonSafety } from "../ribbonSafety";
import { buildRibbonPath, createRibbonLink } from "../ribbonJoin";
import { parseProject, serializeProject } from "../../objects/project";
import type { DocumentState } from "../../store/studioStore";

const rectangle = "M0 0 L100 0 L100 40 L0 40 Z";
const glyph=(id:string,x:number,part:"source"|"target",pathData=rectangle):LetteringItem=>({
  ...createLettering(x,100),id,kind:"outline",color:"#445566",
  size:1000,unitsPerEm:1000,rotation:0,pathData,
  joinAnchors:part==="source"
    ? {exit:{x:100,y:20}} : {entry:{x:0,y:20}},
});
const a=glyph("a",0,"source"),b=glyph("b",150,"target");
const pair=()=>createRibbonLink(a,b,"exit","entry")!;

describe("opt-in Arabic kashida endpoint fit",()=>{
  it("measures actual cross-section width and matches both endpoint caps",()=>{
    const bridge=pair();
    const fit=suggestRibbonCapFit(bridge,[a,b])!;
    expect(fit).not.toBeNull();
    expect(fit.start?.width).toBeCloseTo(40,2);
    expect(fit.end?.width).toBeCloseTo(40,2);
    expect(fit.start?.angle).toBeCloseTo(0,4);
    expect(fit.end?.angle).toBeCloseTo(0,4);
    expect(fit.ribbon.startWidth).toBeCloseTo(40,2);
    expect(fit.ribbon.endWidth).toBeCloseTo(40,2);
    expect(fit.changes).toEqual(["بداية الوصلة","نهاية الوصلة"]);
    const after=analyzeRibbonSafety({...bridge,ribbon:fit.ribbon},[a,b])!;
    const before=analyzeRibbonSafety(bridge,[a,b])!;
    expect(after.edgeCrossings).toBeLessThanOrEqual(before.edgeCrossings);
    expect(buildRibbonPath({...bridge,ribbon:fit.ribbon},[a,b])).not.toBeNull();
    expect(a.pathData).toBe(rectangle);
    expect(b.pathData).toBe(rectangle);
  });

  it("does not mistake a detached dot or mark for the stroke body",()=>{
    const source={...a,pathData:rectangle+" M200 200 L230 200 L230 230 L200 230 Z",
      contourRoles:{"0":"body" as const,"1":"dot" as const}};
    const bridge=createRibbonLink(source,b,"exit","entry")!;
    const fit=suggestRibbonCapFit(bridge,[source,b])!;
    expect(fit.start?.width).toBeCloseTo(40,2);
    expect(source.pathData).toContain("M200 200");
  });

  it("declines corner anchors and skips only the ambiguous side",()=>{
    const corner={...a,joinAnchors:{exit:{x:100,y:0}}};
    const bridge=createRibbonLink(corner,b,"exit","entry")!;
    const fit=suggestRibbonCapFit(bridge,[corner,b]);
    expect(fit?.start).toBeNull();
    // The terminal is 40 units tall, but this chord slopes 20/50:
    // the section perpendicular to the chord is longer by sec(theta).
    const expected = 40 * Math.hypot(50, 20) / 50;
    expect(fit?.end?.width).toBeCloseTo(expected, 2);
  });

  it("refuses off-contour and invalid geometry rather than guessing",()=>{
    const off={...a,joinAnchors:{exit:{x:115,y:20}}};
    const bridge=createRibbonLink(off,b,"exit","entry")!;
    const fit=suggestRibbonCapFit(bridge,[off,b]);
    expect(fit?.start).toBeNull();
    expect(suggestRibbonCapFit(bridge,[off])).toBeNull();
    expect(suggestRibbonCapFit({...bridge,ribbon:{...bridge.ribbon!,startWidth:-1}},[a,b])).toBeNull();
  });

  it("finds a nonzero angle for a sloped glyph terminal",()=>{
    const outline="M0 0 L90 -20 L110 40 L0 60 Z";
    const source={...glyph("inclined",0,"source",outline),
      joinAnchors:{exit:{x:100,y:10}}};
    const bridge=createRibbonLink(source,b,"exit","entry")!;
    const fit=suggestRibbonCapFit(bridge,[source,b]);
    expect(fit?.start).not.toBeNull();
    expect(Math.abs(fit!.start!.angle)).toBeGreaterThan(10);
    expect(Math.abs(fit!.start!.angle)).toBeLessThanOrEqual(70);
  });

  it("round trips fitted widths/angles as an editable .logo without rewriting glyphs",()=>{
    const bridge=pair(),fit=suggestRibbonCapFit(bridge,[a,b])!;
    const letters=[a,b,{...bridge,ribbon:fit.ribbon}];
    const doc:DocumentState={artboard:{width:800,height:600,unit:"px",background:"#ffffff"},
      grids:[],objects:[],lettering:letters};
    const restored=parseProject(serializeProject(doc))!;
    expect(restored.lettering![2]!.ribbon!.startWidth).toBe(40);
    expect(restored.lettering![2]!.ribbon!.endWidth).toBe(40);
    expect(restored.lettering![0]!.pathData).toBe(rectangle);
    expect(restored.lettering![1]!.pathData).toBe(rectangle);
  });
});
