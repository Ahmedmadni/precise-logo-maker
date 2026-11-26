import { describe, expect, it } from "vitest";
import { parseOutline, outlineNodes, moveOutlineNodeWithHandles, smoothOutlineAnchor, editOutlineNode, glyphPointToWorld, worldToGlyphPoint } from "./pathEditor";

describe("outline editing regressions", () => {
  const single = "M0 0 Q10 20 0 0 Z";
  it("moves a shared quadratic handle only once when moving the first anchor", () => {
    const result = moveOutlineNodeWithHandles(single, 0, 3, 4);
    expect(result).not.toBeNull();
    expect(outlineNodes(result!).map(n => [n.x,n.y])).toEqual([[3,4],[13,24],[3,4]]);
  });
  it("moves a shared quadratic handle only once when moving the last anchor", () => {
    const result = moveOutlineNodeWithHandles(single, 2, 3, 4);
    expect(result).not.toBeNull();
    expect(outlineNodes(result!).map(n => [n.x,n.y])).toEqual([[3,4],[13,24],[3,4]]);
  });
  it("does not smooth a quadratic against its own control", () => {
    expect(smoothOutlineAnchor(single,0)).toBeNull();
  });
  it.each(["M0 0 X10 20", "L0 0", "M0 0 Z 1 2", "M1e308 0 l1e308 0", " "])("rejects malformed outlines: %s", d => {
    expect(parseOutline(d)).toBeNull();
  });
  it("preserves valid compact and exponent notation", () => {
    expect(parseOutline("M1e-2,2L3-4Z")).toEqual([
      {cmd:"M",values:[0.01,2]}, {cmd:"L",values:[3,-4]}, {cmd:"Z",values:[]},
    ]);
  });
  it("rejects out-of-range free edits", () => {
    expect(editOutlineNode(single,0,100001,0)).toBeNull();
  });
});

describe("SVG-aligned outline coordinate transforms",()=>{
  const item={id:"g",kind:"outline" as const,x:100,y:60,size:100,unitsPerEm:100,rotation:0,color:"#000"};
  it("uses the same scale and size limits as the rendered SVG",()=>{
    expect(glyphPointToWorld({...item,size:2000,scaleX:50,scaleY:-30},2,3)).toEqual({x:500,y:660});
  });
  it("uses consistent finite fallback values for legacy malformed font metrics",()=>{
    const point=glyphPointToWorld({...item,size:NaN,unitsPerEm:0,rotation:NaN,scaleX:Infinity},1000,1000);
    expect(point).toEqual({x:148,y:12});
  });
  it("round trips mirrored, rotated and skewed coordinates",()=>{
    const glyph={...item,scaleX:-25,scaleY:1.2,rotation:37,skewX:80,skewY:-31};
    const p=glyphPointToWorld(glyph,12.5,-8.2);
    const restored=worldToGlyphPoint(glyph,p.x,p.y);
    expect(restored?.x).toBeCloseTo(12.5,8);
    expect(restored?.y).toBeCloseTo(-8.2,8);
  });
  it("rejects non-invertible scales and nonfinite pointer positions",()=>{
    expect(worldToGlyphPoint({...item,scaleX:0},1,2)).toBeNull();
    expect(worldToGlyphPoint(item,Infinity,2)).toBeNull();
  });
});
