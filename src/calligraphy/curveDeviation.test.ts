import {describe,it,expect} from "vitest";
import {curveDeviationBound,insertOutlineAnchor,removeOutlineAnchor,changeOutlineAnchor} from "./nodeTopology";
describe("conservative curve deviation",()=>{
  it("bounds the full curve, not only isolated sample points",()=>{
    const delta=[{x:0,y:0},{x:0,y:2},{x:0,y:0}];
    expect(curveDeviationBound(delta,1.01)).toBeLessThanOrEqual(1.01);
    expect(curveDeviationBound(delta,.99)).toBeGreaterThan(.99);
  });
  it("can recover a non-midpoint cubic subdivision",()=>{
    const original="M0 0 C20 100 80 100 100 0";
    const split=insertOutlineAnchor(original,3,.37);
    if(!split)throw Error("missing split");
    const merged=removeOutlineAnchor(split.path,split.selectedNodeId,.1);
    expect(merged).not.toBeNull();
    expect(merged?.maxDeviation).toBeLessThanOrEqual(.1);
  });
  it("does not modify a single shared quadratic handle as two independent handles",()=>{
    const d="M0 0 Q10 20 0 0 Z";
    expect(changeOutlineAnchor(d,0,"corner")).toBeNull();
    expect(changeOutlineAnchor(d,2,"symmetric")).toBeNull();
  });
});
