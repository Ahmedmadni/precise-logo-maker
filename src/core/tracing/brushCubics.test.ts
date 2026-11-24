import { describe, expect, it } from "vitest";
import { fitBrushCubics, vectorBrushOutline, DEFAULT_BRUSH } from "./vectorBrush";
import type { PathGeometry } from "../geometry/types";

describe("brush cubic fitting", () => {
  const ring: PathGeometry = {
    kind: "path", closed: true,
    points: Array.from({length:32}, (_,i) => ({x:20*Math.cos(i*Math.PI/16),y:20*Math.sin(i*Math.PI/16)})),
  };
  it("fits smooth edges without moving anchors", () => {
    const result=fitBrushCubics(ring);
    expect(result.points).toEqual(ring.points);
    expect(result.cubicSegments?.filter(Boolean)).toHaveLength(32);
  });
  it("keeps handles finite", () => {
    for (const c of fitBrushCubics(ring).cubicSegments ?? []) {
      if (c) expect([c.control1.x,c.control1.y,c.control2.x,c.control2.y].every(Number.isFinite)).toBe(true);
    }
  });
  it("preserves sharp corners", () => {
    const shape: PathGeometry={kind:"path",closed:true,points:[{x:0,y:0},{x:10,y:0},{x:20,y:0},{x:20,y:10},{x:10,y:10},{x:0,y:10}]};
    expect(fitBrushCubics(shape).cubicSegments?.every(c=>c===null)).toBe(true);
  });
  it("leaves open paths unchanged", () => {
    const open={...ring,closed:false};
    expect(fitBrushCubics(open)).toBe(open);
  });
  it("fits a generated brush outline", () => {
    const samples=Array.from({length:41},(_,i)=>({x:i*2,y:10*Math.sin(i/10),pressure:0.7}));
    const outline=vectorBrushOutline(samples,DEFAULT_BRUSH);
    expect(outline).not.toBeNull();
    if (!outline) throw new Error("Missing outline");
    const fitted=fitBrushCubics(outline);
    expect(fitted.closed).toBe(true);
    expect(fitted.points).toEqual(outline.points);
  });
});
