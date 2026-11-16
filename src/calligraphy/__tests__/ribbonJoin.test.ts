import { describe, expect, it } from "vitest";
import { createLettering, letteringSvg, type LetteringItem } from "../model";
import { buildRibbonPath, createRibbonLink, remapRibbons } from "../ribbonJoin";
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
    expect(path.match(/ C /g)).toHaveLength(2);
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
