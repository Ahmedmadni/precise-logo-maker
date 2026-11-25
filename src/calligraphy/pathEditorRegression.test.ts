import { describe, expect, it } from "vitest";
import { parseOutline, outlineNodes, moveOutlineNodeWithHandles, smoothOutlineAnchor, editOutlineNode } from "./pathEditor";

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
