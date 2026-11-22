import { describe, expect, it } from "vitest";
import { createLettering, type LetteringItem } from "../model";
import { getJoinAnchor, worldJoinAnchor } from "../contourComposer";
import { snapGlyphJoinAnchor } from "../joinAnchorSnap";
import { glyphPointToWorld } from "../pathEditor";
import { parseProject, serializeProject } from "../../objects/project";
import type { DocumentState } from "../../store/studioStore";

const square = "M0 0 L100 0 L100 100 L0 100 Z";
const farDot = "M180 180 L195 180 L195 195 L180 195 Z";
const glyph = (pathData:string):LetteringItem=>({
  ...createLettering(300,200),id:"arabic-glyph",kind:"outline",
  color:"#123456",size:200,unitsPerEm:1000,rotation:0,pathData,
});

describe("manual Arabic join anchors snapping to glyph boundary",()=>{
  it("projects an imprecise manual marker exactly to the nearest line edge",()=>{
    const item={...glyph(square),joinAnchors:{entry:{x:108,y:30}}};
    const before=item.pathData;
    const projection=snapGlyphJoinAnchor(item,"entry")!;
    expect(projection.contourIndex).toBe(0);
    expect(projection.point).toEqual({x:100,y:30});
    expect(projection.distance).toBeCloseTo(8,6);
    expect(item.pathData).toBe(before);
    expect(item.joinAnchors.entry).toEqual({x:108,y:30});
    const saved={...item,joinAnchors:{...item.joinAnchors,entry:projection.point}};
    expect(getJoinAnchor(saved,"entry")).toEqual(projection.point);
    expect(worldJoinAnchor(saved,"entry")).toEqual(glyphPointToWorld(saved,100,30));
  });

  it("finds a true point on a quadratic Bézier rather than its bounding box",()=>{
    const shape="M0 0 Q50 100 100 0 L100 -100 L0 -100 Z";
    const item={...glyph(shape),joinAnchors:{entry:{x:50,y:55}}};
    const projection=snapGlyphJoinAnchor(item,"entry")!;
    expect(projection.point.x).toBeCloseTo(50,1);
    expect(projection.point.y).toBeCloseTo(50,1);
    expect(projection.distance).toBeCloseTo(5,1);
  });

  it("refines a cubic optimum directly on the curve",()=>{
    const shape="M0 0 C0 100 100 100 100 0 L100 -100 L0 -100 Z";
    const item={...glyph(shape),joinAnchors:{exit:{x:50,y:82}}};
    const projection=snapGlyphJoinAnchor(item,"exit")!;
    expect(projection.point.x).toBeCloseTo(50,1);
    expect(projection.point.y).toBeCloseTo(75,1);
    expect(projection.distance).toBeCloseTo(7,1);
  });

  it("ignores detached dots/counters and respects a hand-labeled joining contour",()=>{
    const item={...glyph(square+" "+farDot),
      contourRoles:{"0":"body" as const,"1":"dot" as const},
      joinAnchors:{entry:{x:182,y:185}}};
    const snapped=snapGlyphJoinAnchor(item,"entry")!;
    expect(snapped.contourIndex).toBe(0);
    expect(snapped.point.x).toBeLessThanOrEqual(100);
    const classified={...item,contourRoles:{"0":"body" as const,"1":"join" as const}};
    const named=snapGlyphJoinAnchor(classified,"entry")!;
    expect(named.contourIndex).toBe(1);
    expect(named.point.x).toBeGreaterThan(170);
    expect(classified.pathData).toBe(item.pathData);
  });

  it("handles closing edges and malformed inputs without moving other glyphs",()=>{
    const item={...glyph(square),joinAnchors:{exit:{x:-10,y:65}}};
    expect(snapGlyphJoinAnchor(item,"exit")?.point).toEqual({x:0,y:65});
    expect(snapGlyphJoinAnchor({...item,pathData:"broken outline"},"exit")).toBeNull();
    expect(snapGlyphJoinAnchor({...item,kind:"text"},"exit")).toBeNull();
    expect(snapGlyphJoinAnchor({...item,joinAnchors:{entry:{x:Infinity,y:3}}},"entry")).toBeNull();
    const result=snapGlyphJoinAnchor(item,"exit")!;
    const doc:DocumentState={
      artboard:{width:800,height:600,unit:"px",background:"#ffffff"},
      grids:[],objects:[],lettering:[{...item,joinAnchors:{exit:result.point}}],
    };
    const restored=parseProject(serializeProject(doc))!;
    expect(restored.lettering?.[0]?.joinAnchors?.exit).toEqual(result.point);
    expect(restored.lettering?.[0]?.pathData).toBe(square);
  });
});
