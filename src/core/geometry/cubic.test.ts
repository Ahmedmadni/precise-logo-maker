import { describe, expect, it } from "vitest";
import type { PathGeometry } from "./types";
import { closestPointOnGeometry, geometryBounds, sampledPathSegments } from "./math";
import { geometryToPathData } from "../../objects/render";
import { translateGeometry, scaleGeometry, mirrorGeometry } from "../../objects/transform";
import { geometryToRing } from "../../objects/boolean";

const curve: PathGeometry = {
  kind: "path", closed: false, points: [{x:0,y:0},{x:12,y:0}],
  cubicSegments: [{control1:{x:0,y:12},control2:{x:12,y:12}}],
};
describe("cubic paths", () => {
  it("renders cubic SVG commands", () => {
    expect(geometryToPathData(curve)).toContain(" C ");
  });
  it("keeps legacy paths linear", () => {
    expect(geometryToPathData({kind:"path",points:curve.points,closed:false})).not.toContain(" C ");
  });
  it("picks the midpoint of the curved edge", () => {
    expect(closestPointOnGeometry(curve,{x:6,y:9})).toEqual({x:6,y:9});
    expect(sampledPathSegments(curve)).toHaveLength(24);
  });
  it("bounds the actual curve rather than its control hull", () => {
    expect(geometryBounds(curve)).toEqual({minX:0,minY:0,maxX:12,maxY:9});
  });
  it("translates controls", () => {
    const g=translateGeometry(curve,3,4);
    expect(g.kind==="path" && g.cubicSegments?.[0]?.control1).toEqual({x:3,y:16});
  });
  it("scales controls", () => {
    const g=scaleGeometry(curve,2,{x:0,y:0});
    expect(g.kind==="path" && g.cubicSegments?.[0]?.control2).toEqual({x:24,y:24});
  });
  it("mirrors controls", () => {
    const g=mirrorGeometry(curve,"x",{x:0,y:0});
    expect(g.kind==="path" && g.cubicSegments?.[0]?.control2).toEqual({x:-12,y:12});
  });
  it("flattens curved edges for polygon operations", () => {
    expect(geometryToRing(curve)).toHaveLength(25);
    expect(geometryToRing(curve)[12]).toEqual({x:6,y:9});
  });
});

describe("cubic bounds regressions", () => {
  it("includes the curved closing edge of a two-anchor path", () => {
    const g: PathGeometry = {...curve, closed:true, cubicSegments:[null,{control1:{x:12,y:-12},control2:{x:0,y:-12}}]};
    expect(geometryBounds(g)).toEqual({minX:0,minY:-9,maxX:12,maxY:0});
    expect(sampledPathSegments(g)).toHaveLength(25);
  });
  it("ignores non-finite control points", () => {
    const g: PathGeometry = {...curve,cubicSegments:[{control1:{x:NaN,y:12},control2:{x:12,y:12}}]};
    expect(geometryBounds(g)).toEqual({minX:0,minY:0,maxX:12,maxY:0});
    expect(sampledPathSegments(g)).toHaveLength(1);
  });
  it("ignores unused controls on an open path", () => {
    const g: PathGeometry = {...curve,cubicSegments:[null,{control1:{x:100,y:100},control2:{x:200,y:200}}]};
    expect(geometryBounds(g)).toEqual({minX:0,minY:0,maxX:12,maxY:0});
  });
});
