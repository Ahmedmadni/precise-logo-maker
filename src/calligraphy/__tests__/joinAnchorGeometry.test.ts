import { describe, expect, it } from "vitest";
import { outlineContours, getJoinAnchor, suggestJoinAnchor, worldJoinAnchor } from "../contourComposer";
import { contourSidePoint, selectJoiningContour } from "../joinAnchorGeometry";
import { createLettering } from "../model";
import { createRibbonLink, buildRibbonPath } from "../ribbonJoin";
import { analyzeRibbonSafety, ribbonEdgeCrossings, strictSegmentIntersection } from "../ribbonSafety";

const body="M0 0 L100 0 L100 60 L0 60 Z";
const farDot="M140 90 L156 90 L156 106 L140 106 Z";
const kashida="M-40 20 L-20 20 L-20 30 L-40 30 Z";
const shape=(pathData:string)=>({
  ...createLettering(220,180),id:"glyph-a",kind:"outline" as const,
  size:200,unitsPerEm:1000,pathData,rotation:0,
});

describe("Arabic join anchors follow real contours, not detached marks",()=>{
  it("chooses the dominant body instead of far-away unannotated dot and counter",()=>{
    const glyph=shape(body+" "+farDot);
    const entry=suggestJoinAnchor(glyph,"entry")!;
    const exit=suggestJoinAnchor(glyph,"exit")!;
    expect(entry.x).toBeCloseTo(100,3);
    expect(exit.x).toBeCloseTo(0,3);
    expect(entry.y).toBeGreaterThan(15);
    expect(entry.y).toBeLessThan(45);
    expect(getJoinAnchor(glyph,"entry")).toEqual(entry);
    const roles={"0":"body" as const,"1":"dot" as const};
    expect(suggestJoinAnchor({...glyph,contourRoles:roles},"entry")).toEqual(entry);
    expect(worldJoinAnchor(glyph,"entry")).toEqual({x:240,y:180-entry.y*0.2});
  });

  it("honors an explicitly labeled join part before the largest body",()=>{
    const glyph=shape(body+" "+kashida+" "+farDot);
    const roles={"0":"body" as const,"1":"join" as const,"2":"dot" as const};
    const entry=suggestJoinAnchor({...glyph,contourRoles:roles},"entry")!;
    expect(entry.x).toBe(-20);
    const manual={...glyph,contourRoles:roles,joinAnchors:{entry:{x:12,y:17}}};
    expect(getJoinAnchor(manual,"entry")).toEqual({x:12,y:17});
    const options=outlineContours(glyph.pathData!);
    expect(selectJoiningContour(options,roles,"entry")?.contourIndex).toBe(1);
  });

  it("uses head for entry and tail for exit when user labeled the parts",()=>{
    const glyph=shape(body+" "+kashida);
    const role={"0":"head" as const,"1":"tail" as const};
    expect(selectJoiningContour(outlineContours(glyph.pathData!),role,"entry")?.contourIndex).toBe(0);
    expect(selectJoiningContour(outlineContours(glyph.pathData!),role,"exit")?.contourIndex).toBe(1);
  });

  it("returns actual boundary positions rather than imaginary bbox midpoints",()=>{
    const triangle="M0 0 L100 0 L0 100 Z";
    const chosen=contourSidePoint(triangle,"entry")!;
    expect(chosen).toEqual({x:100,y:0});
    expect(contourSidePoint(triangle,"exit")!.x).toBe(0);
    const curve="M0 0 C200 0 -200 30 0 40 Z";
    const curved=contourSidePoint(curve,"entry")!;
    expect(curved.x).toBeGreaterThan(20);
    expect(curved.x).toBeLessThan(200); // ignore distant control point
    expect(contourSidePoint("broken path","entry")).toBeNull();
    expect(suggestJoinAnchor(shape("broken path"),"entry")).toBeNull();
  });

  it("falls back gracefully on glyphs consisting of a single small contour",()=>{
    const tiny=shape(farDot);
    expect(suggestJoinAnchor(tiny,"entry")?.x).toBe(156);
  });
});

describe("ribbon preflight self-intersection and proportional width checks",()=>{
  const glyph=(id:string,x:number)=>({
    ...shape(body),id,x,groupId:"w1",color:"#123456",
    joinAnchors:{entry:{x:100,y:30},exit:{x:0,y:30}},
  });

  it("counts actual segment crossings but ignores disjoint paths and endpoint touch",()=>{
    const a={x:0,y:0},b={x:10,y:10},c={x:0,y:10},d={x:10,y:0};
    expect(strictSegmentIntersection(a,b,c,d)).toBe(true);
    expect(strictSegmentIntersection(a,b,{x:11,y:11},{x:15,y:11})).toBe(false);
    expect(strictSegmentIntersection(a,b,a,{x:20,y:0})).toBe(false);
    expect(ribbonEdgeCrossings([a,b],[c,d])).toBe(1);
    expect(ribbonEdgeCrossings([a,{x:10,y:0}],[c,{x:10,y:10}])).toBe(0);
  });

  it("reports narrow and oversized connections as geometric diagnostics, not arbitrary scores",()=>{
    const source=glyph("from",100),target=glyph("to",440);
    const bridge=createRibbonLink(source,target)!;
    expect(bridge).not.toBeNull();
    const normal=analyzeRibbonSafety(bridge,[source,target])!;
    expect(normal.distance).toBeGreaterThan(300);
    expect(normal.maxWidth).toBeGreaterThan(0);
    expect(normal.widthRatio).toBeLessThan(0.7);
    expect(normal.edgeCrossings).toBe(0);
    expect(normal.needsReview).toBe(false);
    const closeTarget=glyph("close",140);
    const close=createRibbonLink(source,closeTarget)!;
    const excessive={...close,ribbon:{...close.ribbon!,startWidth:100,endWidth:100}};
    const bad=analyzeRibbonSafety(excessive,[source,closeTarget])!;
    expect(bad.widthRatio).toBeGreaterThan(0.7);
    expect(bad.needsReview).toBe(true);
    expect(buildRibbonPath(excessive,[source,closeTarget])).not.toBeNull();
  });

  it("does not export editor-only geometry diagnostics or mutate artwork",()=>{
    const a=glyph("a",50),b=glyph("b",420),r=createRibbonLink(a,b)!;
    const original=buildRibbonPath(r,[a,b]);
    expect(analyzeRibbonSafety(r,[a,b])?.distance).toBeGreaterThan(0);
    expect(buildRibbonPath(r,[a,b])).toBe(original);
    expect(analyzeRibbonSafety(r,[a])).toBeNull();
  });
});
