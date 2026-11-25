import { describe, expect, it } from "vitest";
import { buildKashidaOutline, createConnectedKashida, arrangeWordBounds, adjustGroupOverlap } from "./kelkComposition";
import { buildRibbonPath, sampleRibbon } from "./ribbonJoin";
import type { LetteringItem } from "./model";
import { preciseGlyphBounds } from "./morph";

const glyph = (id: string, x: number, size: number): LetteringItem => ({
  id, kind: "outline", x, y: 100, size, rotation: 0, color: "#111111",
  unitsPerEm: 1000, pathData: "M 0 0 L 300 0 L 300 100 L 0 100 Z",
  joinAnchors: { entry: {x:300,y:50}, exit: {x:0,y:50} },
});
const source = glyph("source", 220, 100);
const target = glyph("target", 40, 200);
const options = {style:"arch" as const, arch:100, thickness:80};

describe("kelk kashida", () => {
  it("honors full thickness for flat outlines", () => {
    expect(buildKashidaOutline({...options, length:600, style:"flat"})).toBe("M -300 80 L 300 80 L 300 0 L -300 0 Z");
  });
  it("rejects non-finite inputs", () => {
    expect(buildKashidaOutline({...options,length:Infinity})).toBeNull();
    expect(createConnectedKashida(source,target,{...options, thickness:NaN})).toBeNull();
  });
  it("interpolates widths for differently sized glyphs", () => {
    const bridge = createConnectedKashida(source,target,options);
    expect(bridge?.ribbon?.startWidth).toBe(8);
    expect(bridge?.ribbon?.endWidth).toBe(16);
    if (!bridge) throw new Error("Missing bridge");
    const samples=sampleRibbon(bridge,[source,target]);
    expect(samples?.[0]?.width).toBe(8);
    expect(samples?.at(-1)?.width).toBe(16);
  });
  it("follows a moved glyph without changing the link", () => {
    const bridge=createConnectedKashida(source,target,options);
    if (!bridge) throw new Error("Missing bridge");
    const original=buildRibbonPath(bridge,[source,target]);
    const moved=buildRibbonPath(bridge,[source,{...target,x:target.x-50}]);
    expect(original).not.toBeNull();
    expect(moved).not.toBeNull();
    expect(moved).not.toEqual(original);
    expect(bridge.ribbon?.targetGlyphId).toBe(target.id);
  });
  it("rejects hidden or identical glyphs", () => {
    expect(createConnectedKashida(source,{...target,hidden:true},options)).toBeNull();
    expect(createConnectedKashida(source,source,options)).toBeNull();
  });
});


describe("precise outline bounds and arrangement", () => {
  it("uses quadratic extrema rather than control-point bounds", () => {
    const g = {...glyph("q",0,1000), y:0, pathData:"M 0 0 Q 50 100 100 0 Z"};
    expect(preciseGlyphBounds(g)).toEqual({x:0,y:-50,width:100,height:50});
  });
  it("includes cubic extrema after rotation", () => {
    const g = {...glyph("c",0,1000), y:0, rotation:90, pathData:"M 0 0 C 0 100 100 100 100 0 Z"};
    const b=preciseGlyphBounds(g);
    expect(b?.width).toBeCloseTo(75,6);
    expect(b?.height).toBeCloseTo(100,6);
  });
  it("equalizes edge gaps and keeps outer glyphs fixed", () => {
    const group=[glyph("r",220,100),glyph("m",100,200),glyph("l",0,100)];
    expect(arrangeWordBounds(group)).toEqual([{id:"m",patch:{x:95}}]);
  });
  it("never reverses adjacent anchors during compression", () => {
    const group=[glyph("r",100,100),glyph("m",95,100),glyph("l",80,100)];
    const patches=adjustGroupOverlap(group,-100);
    const xs=group.map(g=>patches.find(p=>p.id===g.id)?.patch.x??g.x);
    expect(xs[0]!).toBeGreaterThan(xs[1]!);
    expect(xs[1]!).toBeGreaterThan(xs[2]!);
  });
});
