import { describe, expect, it } from "vitest";
import { createLettering, letteringSvg, type LetteringItem } from "../model";
import { buildRibbonPath, createRibbonLink, remapRibbons, sampleRibbon } from "../ribbonJoin";
import { buildSvgDocument } from "../../objects/export";
import { parseProject, serializeProject } from "../../objects/project";
import type { DocumentState } from "../../store/studioStore";
import { worldJoinAnchor } from "../contourComposer";

const glyph = (id: string, x: number, y: number, groupId = "w1"): LetteringItem => ({
  ...createLettering(x, y), id, kind: "outline", size: 140, unitsPerEm: 1000,
  pathData: "M0 0 L100 0 L100 250 L0 250 Z",
  groupId, color: "#123456", rotation: 16, skewX: 6,
  joinAnchors: { entry: { x: 100, y: 130 }, exit: { x: 0, y: 130 } },
});

const source = glyph("a", 100, 220);
const target = glyph("b", 390, 255);

describe("editable SVG ribbon between calligraphy glyphs", () => {
  it("creates one closed cubic outline, rendered consistently in web and export", () => {
    const item = createRibbonLink(source, target)!;
    expect(item.kind).toBe("bridge");
    expect(item.ribbon?.sourceGlyphId).toBe("a");
    const path = buildRibbonPath(item, [source, target])!;
    expect(path).toMatch(/^M /);
    expect(path).toContain(" C ");
    expect(path).toMatch(/ Z$/);
    // Multiple smooth cubic segments per edge, rather than two coarse curves.
    expect(path.match(/ C /g)!.length).toBeGreaterThan(20);
    expect(letteringSvg(item, [source, target])).toContain(`d="${path}"`);
    expect(letteringSvg(item)).toBe("");
  });
  it("follows both anchors when the word is moved or one letter is rotated", () => {
    const item = createRibbonLink(source, target)!;
    const before = buildRibbonPath(item, [source, target])!;
    const movedSource = { ...source, x: source.x + 45, y: source.y - 12 };
    const movedTarget = { ...target, rotation: 37 };
    const after = buildRibbonPath(item, [movedSource, movedTarget])!;
    expect(after).not.toEqual(before);
    const anchor = worldJoinAnchor(movedSource, "exit")!;
    expect(Number.isFinite(anchor.x)).toBe(true);
    expect(item.ribbon?.sourceGlyphId).toBe(source.id);
  });
  it("keeps tangent directions independent and avoids kinks in the centerline", () => {
    const base = createRibbonLink(source, target)!;
    const angled = { ...base, ribbon: { ...base.ribbon!,
      startAngle: 34, endAngle: -24, curvature: 0.22, widthEase: -0.6 } };
    const samples = sampleRibbon(angled, [source, target], 64)!;
    expect(samples).toHaveLength(65);
    expect(samples[0]!.width).toBeCloseTo(angled.ribbon.startWidth, 8);
    expect(samples[64]!.width).toBeCloseTo(angled.ribbon.endWidth, 8);
    const start = samples[0]!.center;
    const finish = samples[64]!.center;
    const chord = Math.atan2(finish.y - start.y, finish.x - start.x);
    const tangentAngle = (a: {x:number;y:number}, b:{x:number;y:number}) =>
      Math.atan2(b.y - a.y, b.x - a.x);
    const radians = (deg:number) => deg * Math.PI / 180;
    expect(tangentAngle(samples[0]!.center, samples[1]!.center) - chord)
      .toBeCloseTo(radians(34), 1);
    expect(tangentAngle(samples[63]!.center, samples[64]!.center) - chord)
      .toBeCloseTo(radians(-24), 1);
    expect(buildRibbonPath(angled, [source, target])).not.toEqual(buildRibbonPath(base, [source, target]));
  });
  it("smoothly changes ribbon width and preserves exact endpoint widths", () => {
    const base = createRibbonLink(source, target)!;
    const value = { ...base, ribbon: { ...base.ribbon!,
      startWidth: 5, endWidth: 45, widthEase: 0.8 } };
    const samples = sampleRibbon(value, [source, target], 64)!;
    expect(samples[0]!.width).toBe(5);
    expect(samples.at(-1)!.width).toBe(45);
    expect(samples.every((s, i) => i === 0 || s.width >= samples[i - 1]!.width)).toBe(true);
    expect(samples[1]!.width - samples[0]!.width).toBeLessThan(0.1);
    expect(samples[64]!.width - samples[63]!.width).toBeLessThan(0.1);
    expect(samples.every((s) => Number.isFinite(s.center.x) && Number.isFinite(s.normal.y))).toBe(true);
  });
  it("opens legacy .logo ribbons without tangent/width easing properties", () => {
    const base = createRibbonLink(source, target)!;
    const spec = { ...base.ribbon! };
    delete (spec as Partial<typeof spec>).startAngle;
    delete (spec as Partial<typeof spec>).endAngle;
    delete (spec as Partial<typeof spec>).widthEase;
    const legacy = { ...base, ribbon: spec };
    expect(buildRibbonPath(legacy, [source, target])).toBeTruthy();
    const explicit = { ...legacy, ribbon: { ...spec, startAngle: 0, endAngle: 0, widthEase: 0 } };
    expect(buildRibbonPath(legacy, [source, target])).toBe(buildRibbonPath(explicit, [source, target]));
  });
  it("supports asymmetric width and curvature while preserving original glyph paths", () => {
    const item = createRibbonLink(source, target)!;
    const changed = { ...item, ribbon: { ...item.ribbon!, startWidth: 8, endWidth: 35,
      curvature: -0.35, tension: 0.45 } };
    const result = buildRibbonPath(changed, [source, target])!;
    expect(result).not.toEqual(buildRibbonPath(item, [source, target]));
    expect(source.pathData).toBe("M0 0 L100 0 L100 250 L0 250 Z");
  });
  it("fails safely with missing glyphs, zero-length joins and invalid parameters", () => {
    const item = createRibbonLink(source, target)!;
    expect(buildRibbonPath(item, [source])).toBeNull();
    expect(buildRibbonPath({ ...item, ribbon: { ...item.ribbon!, curvature: Infinity } },
      [source, target])).toBeNull();
    expect(buildRibbonPath({ ...item, ribbon: { ...item.ribbon!, startWidth: -2 } },
      [source, target])).toBeNull();
    expect(buildRibbonPath({ ...item, ribbon: { ...item.ribbon!, startAngle: 100 } },
      [source, target])).toBeNull();
    expect(buildRibbonPath({ ...item, ribbon: { ...item.ribbon!, widthEase: NaN } },
      [source, target])).toBeNull();
    expect(createRibbonLink(source, source)).toBeNull();
    const identical = { ...target, x: source.x, y: source.y,
      joinAnchors: { ...source.joinAnchors } };
    expect(createRibbonLink(source, identical, "exit", "exit")).toBeNull();
  });
  it("survives project save/load and exports filled vector path without editor overlays", () => {
    const bridge = createRibbonLink(source, target)!;
    const doc: DocumentState = { artboard: { width: 800, height: 600, unit: "px",
      background: "#ffffff" }, grids: [], objects: [], lettering: [source, target, bridge] };
    const restored = parseProject(serializeProject(doc))!;
    const saved = restored.lettering!;
    expect(saved[2]?.ribbon?.targetGlyphId).toBe("b");
    expect(saved[2]?.kind).toBe("bridge");
    const svg = buildSvgDocument(restored, { background: false });
    expect(svg).toContain(buildRibbonPath(bridge, saved)!);
    expect(svg).not.toContain("data-join-side");
    expect(svg).not.toContain("joinGuide");
  });
  it("remaps endpoints on font re-shape and removes orphan links", () => {
    const bridge = createRibbonLink(source, target)!;
    const newSource = glyph("new-a", 135, 220);
    const newTarget = glyph("new-b", 450, 275);
    const replaced = remapRibbons([source, target, bridge], [bridge, newSource, newTarget], "w1");
    expect(replaced.find((item) => item.id === bridge.id)?.ribbon?.sourceGlyphId).toBe("new-a");
    expect(replaced.find((item) => item.id === bridge.id)?.ribbon?.targetGlyphId).toBe("new-b");
    const missing = remapRibbons([source, target, bridge], [bridge], "w1");
    expect(missing.some((item) => item.kind === "bridge")).toBe(false);
  });
});
