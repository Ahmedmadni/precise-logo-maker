import {describe,it,expect} from "vitest";
import {cleanStroke,simplifyPath} from "./simplify";
const options={tolerance:0.5,smoothing:0,fitShapes:true};
describe("freehand cleanup regression",()=>{
  it("retains a collinear overshoot rather than collapsing it onto the endpoint segment",()=>{
    const points=[{x:0,y:0},{x:100,y:0},{x:30,y:0}];
    expect(simplifyPath(points,.5)).toEqual(points);
    expect(cleanStroke(points,options)).toEqual({kind:"path",points,closed:false});
  });
  it("preserves deliberate reversals inside the endpoint span",()=>{
    const points=[{x:0,y:0},{x:70,y:0},{x:20,y:0},{x:100,y:0}];
    expect(cleanStroke(points,options)?.kind).toBe("path");
  });
  it("retains an intentional closed path",()=>{
    const points=[{x:0,y:0},{x:20,y:0},{x:20,y:20},{x:0,y:20}];
    expect(cleanStroke(points,options,true)).toMatchObject({kind:"path",closed:true});
  });
  it("recognizes a normal straight stroke and rejects invalid samples",()=>{
    expect(cleanStroke([{x:0,y:0},{x:10,y:.1},{x:20,y:0}],options)?.kind).toBe("line");
    expect(cleanStroke([{x:0,y:0},{x:NaN,y:1}],options)).toBeNull();
  });
});
