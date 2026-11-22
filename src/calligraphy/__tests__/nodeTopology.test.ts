import { describe, expect, it } from "vitest";
import { outlineNodes, parseOutline } from "../pathEditor";
import {
  changeOutlineAnchor, insertOutlineAnchor, outlineNodeActions,
  outlineNodeCount, removeOutlineAnchor,
} from "../nodeTopology";

const cubicPoint = (p: number[], t: number) => {
  const s = 1 - t;
  return [0, 1].map((i) =>
    p[i]! * s ** 3 + 3 * p[i + 2]! * s * s * t +
    3 * p[i + 4]! * s * t * t + p[i + 6]! * t ** 3);
};
const quadraticPoint = (p: number[], t: number) => {
  const s = 1 - t;
  return [0, 1].map((i) => p[i]! * s * s + 2 * p[i + 2]! * s * t + p[i + 4]! * t * t);
};

describe("Arabic outline node topology edits", () => {
  it("subdivides cubic outlines with de Casteljau without changing rendered geometry", () => {
    const d = "M0 0 C10 80 60 -20 90 30 Z M200 100 L210 120 Z";
    const result = insertOutlineAnchor(d, 3)!;
    expect(result).not.toBeNull();
    expect(result.selectedNodeId).toBe(3); // control/control/new anchor
    const original = parseOutline(d)!;
    const segments = parseOutline(result.path)!;
    expect(segments.map((s) => s.cmd)).toEqual(["M","C","C","Z","M","L","Z"]);
    expect(segments.slice(4)).toEqual(original.slice(3)); // untouched dot
    const before = [0, 0, ...original[1]!.values];
    const first = [0, 0, ...segments[1]!.values];
    const second = [...segments[1]!.values.slice(-2), ...segments[2]!.values];
    for (const t of [0, 0.06, 0.18, 0.4, 0.5, 0.73, 0.9, 1]) {
      const actual = t <= 0.5
        ? cubicPoint(first, t * 2) : cubicPoint(second, (t - 0.5) * 2);
      const expected = cubicPoint(before, t);
      expect(actual[0]).toBeCloseTo(expected[0]!, 2);
      expect(actual[1]).toBeCloseTo(expected[1]!, 2);
    }
    expect(outlineNodes(result.path)[result.selectedNodeId]).toMatchObject({ role: "anchor" });
  });

  it("subdivides quadratic and line segments while preserving disconnected marks", () => {
    const quadratic = "M0 0 Q20 40 60 0 Z M70 90 L90 90 Z";
    const q = insertOutlineAnchor(quadratic, 2, 0.3)!;
    expect(parseOutline(q.path)!.map((s) => s.cmd)).toEqual(["M","Q","Q","Z","M","L","Z"]);
    const original = [0, 0, 20, 40, 60, 0];
    const s = parseOutline(q.path)!;
    const first = [0,0,...s[1]!.values];
    const second = [...s[1]!.values.slice(-2),...s[2]!.values];
    for (const t of [0.1,0.3,0.6,0.92]) {
      const x = t <= 0.3 ? quadraticPoint(first,t / 0.3) : quadraticPoint(second, (t - 0.3) / 0.7);
      const y = quadraticPoint(original,t);
      expect(x[0]).toBeCloseTo(y[0]!,2);
      expect(x[1]).toBeCloseTo(y[1]!,2);
    }
    expect(s.slice(4)).toEqual(parseOutline(quadratic)!.slice(3));
    const line = insertOutlineAnchor("M0 0 L100 0 L100 100 Z", 1, 0.25)!;
    expect(outlineNodes(line.path)[line.selectedNodeId]).toMatchObject({ x: 25, y: 0, role: "anchor" });
    expect(outlineNodeCount(line.path)).toBe(4);
  });

  it("deletes only safe straight-join nodes and protects small closed contours", () => {
    const d = "M0 0 L20 0 L40 0 L40 40 L0 40 Z M90 90 L95 92 Z";
    const result = removeOutlineAnchor(d, 1)!;
    expect(result).not.toBeNull();
    expect(parseOutline(result.path)!.map((s) => s.cmd)).toEqual(["M","L","L","L","Z","M","L","Z"]);
    expect(parseOutline(result.path)!.slice(-3)).toEqual(parseOutline(d)!.slice(-3));
    expect(removeOutlineAnchor("M0 0 L20 0 L20 20 Z", 1)).toBeNull(); // triangle
    expect(removeOutlineAnchor("M0 0 L10 0 L10 10 L0 0 Z", 3)).toBeNull(); // seam
    expect(removeOutlineAnchor("M0 0 C0 10 10 10 10 0 L10 10 Z", 3)).toBeNull(); // curved transition
    expect(removeOutlineAnchor("M0 0 L10 0", 0)).toBeNull(); // M
    expect(removeOutlineAnchor(d, 800)).toBeNull();
    expect(removeOutlineAnchor("M0 0 L20 0 L40 0", 1)).not.toBeNull(); // two open endpoints remain
  });

  it("supports corner/smooth/symmetric tangents without affecting disconnected dots", () => {
    const d = "M0 0 C10 0 10 10 20 10 C30 12 32 20 40 20 Z M70 70 C72 80 76 80 80 70 Z";
    const corner = changeOutlineAnchor(d, 3, "corner")!;
    expect(corner).not.toBeNull();
    const c = outlineNodes(corner.path);
    expect(c[2]).toMatchObject({x:20,y:10});
    expect(c[4]).toMatchObject({x:20,y:10});
    expect(c.slice(7)).toEqual(outlineNodes(d).slice(7));
    const symmetric = changeOutlineAnchor(d, 3, "symmetric")!;
    const s = outlineNodes(symmetric.path);
    expect(s[4]).toMatchObject({ x:30, y:10 });
    expect(s.slice(7)).toEqual(outlineNodes(d).slice(7));
    const smoothed = changeOutlineAnchor(d, 3, "smooth")!;
    expect(smoothed.path).not.toBe(d);
    expect(changeOutlineAnchor(d, 2, "corner")).toBeNull();
    expect(changeOutlineAnchor(d, 3, "impossible" as "corner")).toBeNull();
  });

  it("handles explicit closed curve seams, and rejects open Z closing edges", () => {
    const closed = "M0 0 C10 0 20 0 0 0 Z M30 30 L45 30 Z";
    const symmetric = changeOutlineAnchor(closed, 0, "symmetric")!;
    expect(symmetric).not.toBeNull();
    const nodes = outlineNodes(symmetric.path);
    expect(nodes[1]).toMatchObject({x:-20,y:0});
    expect(nodes.slice(4)).toEqual(outlineNodes(closed).slice(4));
    expect(changeOutlineAnchor("M0 0 C10 0 20 0 30 0 Z", 0, "corner")).toBeNull();
  });


  it("removes an inserted cubic node by constrained inverse subdivision", () => {
    const d="M0 0 C25 80 70 -50 100 20 L130 20 Z M200 200 L210 205 Z";
    const inserted=insertOutlineAnchor(d,3)!;
    expect(inserted).not.toBeNull();
    const removed=removeOutlineAnchor(inserted.path,inserted.selectedNodeId,0.1)!;
    expect(removed).not.toBeNull();
    expect(removed.maxDeviation!).toBeLessThan(0.1);
    expect(parseOutline(removed.path)!.map(s=>s.cmd))
      .toEqual(parseOutline(d)!.map(s=>s.cmd));
    expect(parseOutline(removed.path)!.slice(-3)).toEqual(parseOutline(d)!.slice(-3));
    const o=parseOutline(d)![1]!.values, v=parseOutline(removed.path)![1]!.values;
    for(let i=0;i<o.length;i++) expect(v[i]).toBeCloseTo(o[i]!,1);
    expect(outlineNodeActions(inserted.path, inserted.selectedNodeId,0.1).remove).toBe(true);
  });

  it("recovers inserted quadratic nodes and keeps separated dots untouched", () => {
    const d="M10 20 Q40 90 100 20 L100 -20 L10 -20 Z M150 150 Q160 170 170 150 Z";
    const inserted=insertOutlineAnchor(d,2)!;
    const removed=removeOutlineAnchor(inserted.path,inserted.selectedNodeId,0.1)!;
    expect(removed.maxDeviation!).toBeLessThan(0.1);
    expect(parseOutline(removed.path)!.map(s=>s.cmd))
      .toEqual(parseOutline(d)!.map(s=>s.cmd));
    expect(parseOutline(removed.path)!.slice(-3)).toEqual(parseOutline(d)!.slice(-3));
    expect(removed.selectedNodeId).toBe(2);
    const tiny=insertOutlineAnchor("M10 20 Q40 90 100 20 Z",2)!;
    expect(removeOutlineAnchor(tiny.path,tiny.selectedNodeId,1)).toBeNull();
    expect(outlineNodeActions(inserted.path,inserted.selectedNodeId).removeDeviation).not.toBeNull();
  });

  it("preserves near-equivalent smooth curves only within a measured tolerance", () => {
    const d="M0 0 C25 65 75 65 100 0 L100 -30 L0 -30 Z";
    const added=insertOutlineAnchor(d,3)!;
    const segments=parseOutline(added.path)!;
    segments[2]!.values[0]! += 0.3;
    const changed=segments.map(s=>s.cmd+(s.values.length?s.values.join(" "):"")).join(" ");
    expect(removeOutlineAnchor(changed,added.selectedNodeId,0.01)).toBeNull();
    const merged=removeOutlineAnchor(changed,added.selectedNodeId,0.5)!;
    expect(merged.maxDeviation!).toBeLessThanOrEqual(0.5);
    expect(merged.maxDeviation!).toBeGreaterThan(0.01);
  });

  it("does not silently flatten corners, cusps, mixed curves or non-collinear lines", () => {
    const curvedCorner="M0 0 C0 50 20 50 50 50 C30 50 20 0 10 0 L10 -20 L0 -20 Z";
    expect(removeOutlineAnchor(curvedCorner,3,5)).toBeNull();
    expect(removeOutlineAnchor("M0 0 Q20 60 40 0 C50 0 60 0 80 0 Z",2)).toBeNull();
    expect(removeOutlineAnchor("M0 0 L20 20 L40 0 L40 40 L0 40 Z",1,2)).toBeNull();
    expect(removeOutlineAnchor("M0 0 L20 0 L40 0 L40 40 L0 40 Z",1,0.1)).not.toBeNull();
    expect(removeOutlineAnchor("M0 0 L20 0 L40 0",1,NaN)).toBeNull();
    expect(removeOutlineAnchor("M0 0 L20 0 L40 0",1,1000)).toBeNull();
  });

  it("reports context-specific actions and blocks invalid commands safely", () => {
    const d = "M0 0 C10 20 20 20 30 0 L40 0 L40 40 Z";
    expect(outlineNodeActions(d, 0).insert).toBe(false);
    expect(outlineNodeActions(d, 1).insert).toBe(false); // control
    expect(outlineNodeActions(d, 3).insert).toBe(true);
    expect(outlineNodeActions(d, 4).insert).toBe(true);
    expect(outlineNodeActions(d, 800).corner).toBe(false);
    expect(insertOutlineAnchor(d, 3, 0)).toBeNull();
    expect(insertOutlineAnchor(d, 3, 1)).toBeNull();
    expect(insertOutlineAnchor(d, 3, Number.NaN)).toBeNull();
    expect(insertOutlineAnchor("M0 0 Z", 0)).toBeNull();
    expect(changeOutlineAnchor(d, 4, "symmetric")).toBeNull();
  });
});
