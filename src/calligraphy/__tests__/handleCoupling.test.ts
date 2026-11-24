import { describe, expect, it } from "vitest";
import { linkedCubicControl, moveLinkedCubicControl } from "../handleCoupling";
import { outlineNodes, parseOutline } from "../pathEditor";
import { serializeProject } from "../../objects/project";
import type { DocumentState } from "../../store/studioStore";

const path = "M0 0 C10 0 20 0 30 0 C40 0 50 0 60 0 Z M100 100 C110 110 120 120 130 100 Z";
const nodes = (d:string)=>outlineNodes(d);
const p=(d:string,i:number)=>nodes(d)[i]!;
describe("live Bézier handle coupling for Arabic glyph outlines",()=>{
  it("retains the opposite tangent's length while dragging an incoming cubic handle",()=>{
    const result=moveLinkedCubicControl(path,2,25,10,"smooth")!;
    expect(result).not.toBeNull();
    expect(p(result,2)).toMatchObject({x:25,y:10});
    const anchor=p(result,3),out=p(result,4);
    const tangentIn={x:anchor.x-25,y:anchor.y-10};
    const tangentOut={x:out.x-anchor.x,y:out.y-anchor.y};
    expect(tangentIn.x*tangentOut.y-tangentIn.y*tangentOut.x).toBeCloseTo(0,2);
    expect(tangentIn.x*tangentOut.x+tangentIn.y*tangentOut.y).toBeGreaterThan(0);
    expect(Math.hypot(tangentOut.x,tangentOut.y)).toBeCloseTo(10,2);
    expect(nodes(result).slice(7)).toEqual(nodes(path).slice(7));
  });
  it("mirrors handle lengths when moving an outgoing cubic handle",()=>{
    const result=moveLinkedCubicControl(path,4,38,12,"symmetric")!;
    expect(p(result,4)).toMatchObject({x:38,y:12});
    expect(p(result,2)).toMatchObject({x:22,y:-12});
    expect(p(result,3)).toMatchObject({x:30,y:0});
    const backward=moveLinkedCubicControl(path,2,25,10,"symmetric")!;
    expect(p(backward,4)).toMatchObject({x:35,y:-10});
    expect(nodes(result).slice(7)).toEqual(nodes(path).slice(7));
  });
  it("handles a genuinely coincident closed contour seam, without joining disconnected dots",()=>{
    const seam="M0 0 C10 5 20 5 0 0 Z M80 80 C90 82 95 84 80 80 Z";
    const first=moveLinkedCubicControl(seam,1,15,3,"symmetric")!;
    expect(first).not.toBeNull();
    expect(p(first,1)).toMatchObject({x:15,y:3});
    expect(p(first,2)).toMatchObject({x:-15,y:-3});
    expect(p(first,0)).toMatchObject({x:0,y:0});
    expect(nodes(first).slice(4)).toEqual(nodes(seam).slice(4));
    const back=moveLinkedCubicControl(seam,2,22,9,"symmetric")!;
    expect(p(back,1)).toMatchObject({x:-22,y:-9});
    expect(p(back,2)).toMatchObject({x:22,y:9});
  });
  it("rejects false seam coupling across a straight Z edge or separate contours",()=>{
    expect(linkedCubicControl("M0 0 C5 0 10 0 20 0 Z",1)).toBeNull();
    expect(moveLinkedCubicControl("M0 0 C5 0 10 0 20 0 Z",1,3,2,"smooth")).toBeNull();
    expect(linkedCubicControl("M0 0 C5 0 10 0 20 0 M20 0 C25 0 30 0 40 0",2)).toBeNull();
    expect(moveLinkedCubicControl("M0 0 L10 0 C20 0 25 0 30 0",2,23,2,"symmetric")).toBeNull();
    expect(linkedCubicControl(path,3)).toBeNull();
    expect(linkedCubicControl(path,90)).toBeNull();
  });
  it("falls back to free editing when no linked control exists and rejects invalid coordinates",()=>{
    const plain=moveLinkedCubicControl(path,1,12,8,"free")!;
    expect(p(plain,1)).toMatchObject({x:12,y:8});
    expect(p(plain,2)).toEqual(p(path,2));
    expect(moveLinkedCubicControl(path,2,NaN,1,"smooth")).toBeNull();
    expect(moveLinkedCubicControl(path,2,100001,1,"symmetric")).toBeNull();
    expect(moveLinkedCubicControl(path,2,30,0,"smooth")).toBeNull();
    expect(moveLinkedCubicControl(path,2,12,3,"invalid" as "free")).toBeNull();
  });
  it("preserves closed SVG geometry for a linked edit and leaves project data independent of UI mode",()=>{
    const updated=moveLinkedCubicControl(path,4,43,-6,"smooth")!;
    expect(parseOutline(updated)!.map(s=>s.cmd))
      .toEqual(parseOutline(path)!.map(s=>s.cmd));
    const doc:DocumentState={
      artboard:{width:300,height:300,unit:"px",background:"#fff"},
      grids:[],objects:[],lettering:[],
    };
    const saved=serializeProject(doc);
    expect(saved).not.toContain("controlLinkMode");
  });
});
