import { describe, expect, it } from "vitest";
import { buildKashidaOutline, createConnectedKashida } from "./kelkComposition";
import { buildRibbonPath, sampleRibbon } from "./ribbonJoin";
import type { LetteringItem } from "./model";

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
