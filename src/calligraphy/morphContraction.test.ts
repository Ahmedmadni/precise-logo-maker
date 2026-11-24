import { describe, it, expect } from "vitest";
import { morphOutline, type MorphProfile, type MorphRegion } from "./morph";
import { outlineNodes } from "./pathEditor";

describe("local glyph contraction", () => {
  for (const profile of ["gradual","tip","balanced"] as MorphProfile[]) {
    for (const region of ["whole","outer-half","outer-third"] as MorphRegion[]) {
      it(`preserves axial ordering for ${profile}/${region}`, () => {
        const source = "M0 0 " + Array.from({length:100},(_,i)=>`L${i+1} 0`).join(" ");
        const result = morphOutline(source,"right",-100,profile,region);
        expect(result).not.toBeNull();
        const nodes = outlineNodes(result!);
        expect(nodes.length).toBeGreaterThan(1);
        for(let i=1;i<nodes.length;i++) expect(nodes[i]!.x).toBeGreaterThan(nodes[i-1]!.x);
      });
    }
  }
});
