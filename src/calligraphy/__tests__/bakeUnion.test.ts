import { describe, expect, it } from "vitest";
import { createHaraka, createLettering, type LetteringItem } from "../model";
import { createRibbonLink } from "../ribbonJoin";
import { bakeRibbonAsOutline } from "../bakeUnion";
import { outlineContours } from "../contourComposer";
import { buildSvgDocument } from "../../objects/export";
import { parseProject, serializeProject } from "../../objects/project";
import { useStudio, type DocumentState } from "../../store/studioStore";

const sourcePath = [
  "M0 0 L40 0 L40 30 L0 30 Z",
  // This is a counter/negative-winding hole inside the outer ring.
  "M10 10 L10 20 L20 20 L20 10 Z",
].join(" ");
const targetPath = "M0 0 L40 0 L40 30 L0 30 Z";
const glyph = (id: string, x: number, pathData: string, side: "source" | "target"): LetteringItem => ({
  ...createLettering(x, 0), id, kind: "outline", color: "#18232b",
  size: 1000, unitsPerEm: 1000, rotation: 0, pathData,
  joinAnchors: side === "source"
    ? { exit: { x: 35, y: 15 }, entry: { x: 40, y: 15 } }
    : { entry: { x: 5, y: 15 }, exit: { x: 0, y: 15 } },
});
const source = glyph("source", 0, sourcePath, "source");
const target = glyph("target", 75, targetPath, "target");
const bridge = () => {
  const made = createRibbonLink(source, target, "exit", "entry")!;
  return { ...made, ribbon: { ...made.ribbon!, startOverlap: 10, endOverlap: 10,
    startWidth: 12, endWidth: 12 } };
};
const doc = (letters: LetteringItem[]): DocumentState => ({
  artboard: { width: 400, height: 400, unit: "px", background: "#ffffff" },
  grids: [], objects: [], lettering: letters,
});

describe("non-destructive geometric Arabic outline merge", () => {
  it("unites two original glyphs with a connected broad-nib ribbon", () => {
    const ribbon = bridge();
    const result = bakeRibbonAsOutline([source, target, ribbon], ribbon.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sourceIds).toEqual(["source", "target", ribbon.id]);
    const baked = result.outline;
    expect(baked.kind).toBe("outline");
    expect(baked.fillRule).toBe("evenodd");
    expect(baked.pathData).toMatch(/^M /);
    expect(baked.pathData).not.toContain("NaN");
    expect(baked.size).toBe(1000);
    expect(baked.x).toBe(0);
    expect(baked.y).toBe(0);
    expect(baked.bakedSourceIds).toEqual(result.sourceIds);
    expect(source.pathData).toBe(sourcePath);
    expect(target.pathData).toBe(targetPath);
  });

  it("preserves a glyph counter rather than filling Arabic interior holes", () => {
    const ribbon = bridge();
    const result = bakeRibbonAsOutline([source, target, ribbon], ribbon.id);
    if (!result.ok) throw new Error(result.reason);
    const contours = outlineContours(result.outline.pathData!);
    const hole = contours.find((c) =>
      c.bounds.minX >= 9.8 && c.bounds.maxX <= 20.2 &&
      c.bounds.minY >= 9.8 && c.bounds.maxY <= 20.2);
    expect(hole).toBeDefined();
    expect(contours.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps original glyphs in a .logo file but omits hidden layers from SVG export", () => {
    const ribbon = bridge();
    const result = bakeRibbonAsOutline([source, target, ribbon], ribbon.id);
    if (!result.ok) throw new Error(result.reason);
    const letters: LetteringItem[] = [source, target, ribbon].map((item) => ({ ...item, hidden: true }));
    letters.push(result.outline);
    const restored = parseProject(serializeProject(doc(letters)))!;
    expect(restored.lettering).toHaveLength(4);
    expect(restored.lettering?.filter((x) => x.hidden)).toHaveLength(3);
    expect(restored.lettering?.[3]?.bakedSourceIds).toEqual(result.sourceIds);
    const svg = buildSvgDocument(restored, { background: false });
    expect(svg).toContain('fill-rule="evenodd"');
    expect((svg.match(/<path /g) ?? [])).toHaveLength(1);
  });

  it("keeps attached harakat following the new baked glyph and restores the old anchor", () => {
    const state = useStudio.getState();
    const ribbon = bridge();
    const mark = { ...createHaraka("shadda", 20, -44), id: "attached-mark",
      attachedToGlyphId: source.id, anchorMode: "auto" as const };
    try {
      useStudio.setState({ doc: doc([source, target, ribbon, mark]), past: [], future: [],
        selectedLetteringId: ribbon.id, letteringPreview: null });
      const result = useStudio.getState().bakeLetteringJoin(ribbon.id);
      expect(result.ok).toBe(true);
      let items = useStudio.getState().doc.lettering!;
      const baked = items.find((x) => x.kind === "outline" && x.bakedSourceIds)!;
      const attached = items.find((x) => x.id === mark.id)!;
      expect(attached.attachedToGlyphId).toBe(baked.id);
      expect(attached.anchorMode).toBe("manual");
      expect(attached.bakedOriginalAttachment?.glyphId).toBe(source.id);
      expect(items.filter((x) => x.hidden)).toHaveLength(3);
      const markX = attached.x;
      useStudio.getState().moveLettering(baked.id, 12, 4);
      items = useStudio.getState().doc.lettering!;
      expect(items.find((x) => x.id === mark.id)?.x).toBe(markX + 12);
      useStudio.getState().toggleBakedVersion(baked.id);
      items = useStudio.getState().doc.lettering!;
      const restored = items.find((x) => x.id === mark.id)!;
      expect(restored.attachedToGlyphId).toBe(source.id);
      expect(restored.anchorMode).toBe("auto");
      expect(items.find((x) => x.id === baked.id)?.hidden).toBe(true);
      expect(items.find((x) => x.id === source.id)?.hidden).toBe(false);
      useStudio.getState().toggleBakedVersion(baked.id);
      items = useStudio.getState().doc.lettering!;
      expect(items.find((x) => x.id === mark.id)?.attachedToGlyphId).toBe(baked.id);
    } finally {
      useStudio.setState({ doc: state.doc, past: state.past, future: state.future,
        selectedLetteringId: state.selectedLetteringId, letteringPreview: state.letteringPreview });
    }
  });

  it("does not merge different colors or an outlined glyph with extra stroke", () => {
    const ribbon = bridge();
    const diffColor = { ...target, color: "#ffffff" };
    const weighted = { ...target, weight: 3 };
    const colorResult = bakeRibbonAsOutline([source, diffColor, ribbon], ribbon.id);
    const strokeResult = bakeRibbonAsOutline([source, weighted, ribbon], ribbon.id);
    expect(colorResult.ok).toBe(false);
    expect(strokeResult.ok).toBe(false);
  });

  it("refuses disconnected ribbons and shared glyph links instead of erasing artwork", () => {
    const ribbon = { ...bridge(), ribbon: { ...bridge().ribbon!,
      startOverlap: 0, endOverlap: 0 } };
    const disconnected = { ...target, pathData: targetPath,
      joinAnchors: { entry: { x: -30, y: 15 } } };
    const failure = bakeRibbonAsOutline([source, disconnected, ribbon], ribbon.id);
    expect(failure.ok).toBe(false);

    const connected = bridge();
    const duplicate = { ...connected, id: "another-link" };
    const shared = bakeRibbonAsOutline([source, target, connected, duplicate], connected.id);
    expect(shared.ok).toBe(false);
  });
});
