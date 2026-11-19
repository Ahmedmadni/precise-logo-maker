import { describe, expect, it } from "vitest";
import { createLettering, letteringSvg, type LetteringItem } from "../model";
import { buildRibbonPath, createRibbonLink, remapRibbons, sampleRibbon } from "../ribbonJoin";
import { ribbonHandleDragPatch, ribbonHandleGeometry, isRibbonWidthRisk } from "../ribbonHandles";
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

describe("direct ribbon canvas handles", () => {
  it("tracks the actual exported centerline for the bend handle and both end caps", () => {
    const bridge = createRibbonLink(source, target)!;
    const geo = ribbonHandleGeometry(bridge, [source, target])!;
    const samples = sampleRibbon(bridge, [source, target], 16)!;
    expect(geo.bend.x).toBeCloseTo(samples[8]!.center.x, 7);
    expect(geo.bend.y).toBeCloseTo(samples[8]!.center.y, 7);
    expect(geo.startCap).toEqual(samples[0]!.center);
    expect(geo.endCap).toEqual(samples[16]!.center);
  });
  it("changes outgoing and incoming tangent angles by dragging each handle", () => {
    const bridge = createRibbonLink(source, target)!;
    const geo = ribbonHandleGeometry(bridge, [source, target])!;
    const start = ribbonHandleDragPatch(bridge.ribbon!, geo, "start", geo.start)!;
    const end = ribbonHandleDragPatch(bridge.ribbon!, geo, "end", geo.end)!;
    expect(start.startAngle).toBeCloseTo(0, 7);
    expect(end.endAngle).toBeCloseTo(0, 7);
    const point = (cap: {x:number;y:number}, theta: number, flip = 1) => ({
      x: cap.x + Math.cos(geo.chordAngle + theta) * 45 * flip,
      y: cap.y + Math.sin(geo.chordAngle + theta) * 45 * flip,
    });
    const left = ribbonHandleDragPatch(bridge.ribbon!, geo, "start", point(geo.startCap, Math.PI / 6))!;
    const right = ribbonHandleDragPatch(bridge.ribbon!, geo, "end", point(geo.endCap, -Math.PI / 4, -1))!;
    expect(left.startAngle).toBeCloseTo(30, 5);
    expect(right.endAngle).toBeCloseTo(-45, 5);
    const altered = { ...bridge, ribbon: { ...bridge.ribbon!, ...left, ...right } };
    expect(buildRibbonPath(altered, [source, target])).not.toBe(buildRibbonPath(bridge, [source, target]));
  });
  it("maps a dragged bend point onto the signed curvature normal and respects limits", () => {
    const bridge = createRibbonLink(source, target)!;
    const geo = ribbonHandleGeometry(bridge, [source, target])!;
    const pointer = {
      x: geo.bend.x + geo.normal.x * geo.capDistance * 0.2,
      y: geo.bend.y + geo.normal.y * geo.capDistance * 0.2,
    };
    const patch = ribbonHandleDragPatch(bridge.ribbon!, geo, "bend", pointer)!;
    expect(patch.curvature).toBeCloseTo(0.2, 4);
    const changed = { ...bridge, ribbon: { ...bridge.ribbon!, ...patch } };
    const next = ribbonHandleGeometry(changed, [source, target])!;
    expect(next.bend.x).toBeCloseTo(pointer.x, 2);
    expect(next.bend.y).toBeCloseTo(pointer.y, 2);
    const far = ribbonHandleDragPatch(bridge.ribbon!, geo, "bend", {
      x: geo.bend.x + geo.normal.x * 1e5, y: geo.bend.y + geo.normal.y * 1e5,
    });
    expect(far?.curvature).toBe(0.5);
  });
  it("shows a warning for overly thick short bridges without destroying original artwork", () => {
    const bridge = createRibbonLink(source, target)!;
    const geo = ribbonHandleGeometry(bridge, [source, target])!;
    expect(isRibbonWidthRisk(bridge.ribbon!, geo)).toBe(false);
    expect(isRibbonWidthRisk({ ...bridge.ribbon!, startWidth: geo.anchorDistance }, geo)).toBe(true);
    expect(ribbonHandleDragPatch(bridge.ribbon!, geo, "start", { x: Infinity, y: 0 })).toBeNull();
    expect(ribbonHandleGeometry(bridge, [source])).toBeNull();
  });
});

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
  it("simulates a broad nib only in the middle, keeping cap widths exact", () => {
    const base = createRibbonLink(source, target)!;
    const spec = { ...base.ribbon!,
      startWidth: 9, endWidth: 36,
      startAngle: 48, endAngle: -33, curvature: 0.3,
      nibAngle: 22, nibContrast: 0.7 };
    const withNib = { ...base, ribbon: spec };
    const withoutNib = { ...base, ribbon: { ...spec, nibContrast: 0 } };
    const textured = sampleRibbon(withNib, [source, target], 64)!;
    const plain = sampleRibbon(withoutNib, [source, target], 64)!;
    expect(textured[0]!.width).toBeCloseTo(9, 9);
    expect(textured[64]!.width).toBeCloseTo(36, 9);
    const differences = textured.slice(1, -1).map((s, i) =>
      Math.abs(s.width - plain[i + 1]!.width));
    expect(Math.max(...differences)).toBeGreaterThan(0.02);
    expect(textured.every((s) => Number.isFinite(s.width) && s.width > 0)).toBe(true);
  });
  it("extends caps behind source/target without relocating their original outlines", () => {
    const base = createRibbonLink(source, target)!;
    const overlapped = { ...base, ribbon: { ...base.ribbon!,
      startOverlap: 15, endOverlap: 24 } };
    const original = sampleRibbon(base, [source, target])!;
    const extended = sampleRibbon(overlapped, [source, target])!;
    const originalLength = Math.hypot(
      original[0]!.center.x - original.at(-1)!.center.x,
      original[0]!.center.y - original.at(-1)!.center.y);
    const extendedLength = Math.hypot(
      extended[0]!.center.x - extended.at(-1)!.center.x,
      extended[0]!.center.y - extended.at(-1)!.center.y);
    expect(extendedLength).toBeGreaterThan(originalLength + 15);
    expect(extended[0]!.width).toBe(base.ribbon!.startWidth);
    expect(extended.at(-1)!.width).toBe(base.ribbon!.endWidth);
    expect(source.pathData).toBe("M0 0 L100 0 L100 250 L0 250 Z");
    expect(target.pathData).toBe("M0 0 L100 0 L100 250 L0 250 Z");
    expect(buildRibbonPath(overlapped, [source, target])).toContain(" C ");
  });
  it("round-trips the nib settings and overlap through .logo and SVG export", () => {
    const base = createRibbonLink(source, target)!;
    const bridge = { ...base, ribbon: { ...base.ribbon!,
      nibAngle: -45, nibContrast: 0.55, startOverlap: 12, endOverlap: 18 } };
    const doc: DocumentState = { artboard: { width: 800, height: 600,
      unit: "px", background: "#ffffff" }, grids: [], objects: [],
      lettering: [source, target, bridge] };
    const loaded = parseProject(serializeProject(doc))!;
    const spec = loaded.lettering![2]!.ribbon!;
    expect(spec.nibAngle).toBe(-45);
    expect(spec.nibContrast).toBe(0.55);
    expect(spec.startOverlap).toBe(12);
    expect(spec.endOverlap).toBe(18);
    expect(buildSvgDocument(loaded, { background: false })).toContain(
      buildRibbonPath(bridge, loaded.lettering!)!);
  });
  it("defaults legacy nib and overlap fields to a neutral profile", () => {
    const base = createRibbonLink(source, target)!;
    const spec = { ...base.ribbon! };
    delete spec.nibContrast;
    delete spec.nibAngle;
    delete spec.startOverlap;
    delete spec.endOverlap;
    const legacy = { ...base, ribbon: spec };
    const explicit = { ...base, ribbon: { ...spec,
      nibContrast: 0, nibAngle: 35, startOverlap: 0, endOverlap: 0 } };
    expect(buildRibbonPath(legacy, [source, target])).toBe(
      buildRibbonPath(explicit, [source, target]));
    expect(buildRibbonPath(legacy, [source, target])).not.toBeNull();
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
    expect(buildRibbonPath({ ...item, ribbon: { ...item.ribbon!, nibContrast: 2 } },
      [source, target])).toBeNull();
    expect(buildRibbonPath({ ...item, ribbon: { ...item.ribbon!, startOverlap: -1 } },
      [source, target])).toBeNull();
    expect(buildRibbonPath({ ...item, ribbon: { ...item.ribbon!, nibAngle: Infinity } },
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
