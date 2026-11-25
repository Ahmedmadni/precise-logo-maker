import { describe, it, expect } from "vitest";
import { hexToInkHsl, inkHslToHex, inkToneSwatches } from "./inkColor";

describe("ink palette",()=>{
  it.each(["#000000","#ffffff","#ff0000","#00ff00","#0000ff","#d1a95e","#747474","#123abc"])("round trips %s", color=>{
    const hsl=hexToInkHsl(color);
    expect(hsl).not.toBeNull();
    expect(inkHslToHex(hsl!)).toBe(color);
  });
  it("normalizes hue and clamps saturation and lightness",()=>{
    expect(inkHslToHex({h:360,s:120,l:50})).toBe("#ff0000");
    expect(inkHslToHex({h:-120,s:100,l:50})).toBe("#0000ff");
    expect(inkHslToHex({h:0,s:100,l:120})).toBe("#ffffff");
  });
  it("rejects invalid input",()=>{
    expect(hexToInkHsl("red")).toBeNull();
    expect(inkHslToHex({h:NaN,s:50,l:50})).toBeNull();
    expect(inkToneSwatches("invalid")).toEqual([]);
  });
  it("generates seven unique tones ordered by lightness",()=>{
    const tones=inkToneSwatches("#d1a95e");
    expect(tones).toHaveLength(7);
    expect(new Set(tones).size).toBe(7);
    const lightness=tones.map(c=>hexToInkHsl(c)!.l);
    expect(lightness).toEqual([...lightness].sort((a,b)=>a-b));
  });
});
