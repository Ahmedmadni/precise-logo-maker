import { describe, expect, it } from "vitest";
import { createLettering, type LetteringItem } from "../model";
import { createRibbonLink } from "../ribbonJoin";
import {
  inspectRibbonChainIntersections, ribbonCenterlineIntersection,
} from "../ribbonChainIntersections";
import { buildSvgDocument } from "../../objects/export";
import type { DocumentState } from "../../store/studioStore";

const point=(x:number,y:number)=>({x,y});
const glyph=(id:string,x:number,y:number):LetteringItem=>({
  ...createLettering(x,y),id,kind:"outline",color:"#334455",
  size:1000,unitsPerEm:1000,rotation:0,
  pathData:"M0 0 L20 0 L20 20 L0 20 Z",
  joinAnchors:{entry:{x:0,y:0},exit:{x:0,y:0}},
});
const a=glyph("a",0,0),b=glyph("b",100,100),c=glyph("c",200,100),d=glyph("d",0,80);
const link=(src:LetteringItem,dst:LetteringItem)=>createRibbonLink(src,dst,"exit","entry")!;

describe("selected Arabic ribbon chain crossing diagnostics",()=>{
  it("solves strict segment crossings without treating endpoint touches as defects",()=>{
    const crossing=ribbonCenterlineIntersection(
      point(0,0),point(100,100),point(0,100),point(100,0))!;
    expect(crossing.x).toBeCloseTo(50,6);
    expect(crossing.y).toBeCloseTo(50,6);
    expect(ribbonCenterlineIntersection(
      point(0,0),point(100,0),point(100,0),point(100,100))).toBeNull();
    expect(ribbonCenterlineIntersection(
      point(0,0),point(100,0),point(10,10),point(100,10))).toBeNull();
    expect(ribbonCenterlineIntersection(
      point(0,0),point(100,0),point(20,0),point(60,0))).toBeNull();
    expect(ribbonCenterlineIntersection(
      point(0,0),point(Infinity,0),point(0,10),point(10,0))).toBeNull();
  });

  it("identifies crossing of non-neighboring strokes within one selected chain",()=>{
    const ab=link(a,b),bc=link(b,c),cd=link(c,d);
    const items=[a,b,c,d,ab,bc,cd];
    const first=inspectRibbonChainIntersections(items,ab.id);
    const last=inspectRibbonChainIntersections(items,cd.id);
    expect(first.length).toBeGreaterThan(0);
    expect(first).toEqual(last);
    expect(first[0]?.firstRibbonId).toBe(ab.id);
    expect(first[0]?.secondRibbonId).toBe(cd.id);
    expect(first[0]?.point.x).toBeCloseTo(88.889,0);
    expect(first[0]?.point.y).toBeCloseTo(88.889,0);
    expect(a.pathData).toBe("M0 0 L20 0 L20 20 L0 20 Z");
    expect(ab.ribbon?.startAngle).toBe(0);
    const document:DocumentState={artboard:{width:500,height:500,unit:"px",background:"#fff"},
      grids:[],objects:[],lettering:items};
    const svg=buildSvgDocument(document,{background:false});
    expect(svg).not.toContain("data-ribbon-chain-diagnostic");
    expect(svg).not.toContain("نقاط مراجعة تقاطع الكشائد");
  });

  it("does not mistake adjoining ribbon caps for nonadjacent crossing warnings",()=>{
    const ab=link(a,b),bc=link(b,c);
    const items=[a,b,c,ab,bc];
    expect(inspectRibbonChainIntersections(items,ab.id)).toEqual([]);
    expect(inspectRibbonChainIntersections(items,bc.id)).toEqual([]);
  });

  it("does not mix independent groups even if their centerlines cross",()=>{
    const ab=link(a,b),cd=link(c,d);
    const items=[a,b,c,d,ab,cd];
    expect(inspectRibbonChainIntersections(items,ab.id)).toEqual([]);
    expect(inspectRibbonChainIntersections(items,cd.id)).toEqual([]);
  });

  it("ignores hidden links, unknown selection and malformed geometry",()=>{
    const ab=link(a,b),bc=link(b,c),cd=link(c,d);
    const items=[a,b,c,d,ab,bc,{...cd,hidden:true}];
    expect(inspectRibbonChainIntersections(items,ab.id)).toEqual([]);
    expect(inspectRibbonChainIntersections(items,cd.id)).toEqual([]);
    expect(inspectRibbonChainIntersections(items,"unknown")).toEqual([]);
    const invalid={...cd,ribbon:{...cd.ribbon!,curvature:NaN}};
    expect(inspectRibbonChainIntersections([a,b,c,d,ab,bc,invalid],ab.id)).toEqual([]);
  });
});
