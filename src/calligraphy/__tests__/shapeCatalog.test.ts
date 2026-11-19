import { describe, expect, it } from "vitest";
import { buildSvgDocument } from "../../objects/export";
import { parseProject, serializeProject } from "../../objects/project";
import type { DocumentState } from "../../store/studioStore";
import { safePath } from "../model";
import { outlineBounds, outlinePreviewViewBox } from "../catalogGeometry";
import { outlineNodes, parseOutline } from "../pathEditor";
import {
  CATALOG_DRAG_MIME, CATEGORY_LABELS, SHAPE_CATALOG,
  createCatalogShape, filterCatalog, normalizeCatalogSearch,
} from "../shapeCatalog";

describe("built-in Arabic calligraphy shape library", () => {
  it("contains 45 curated and uniquely named local vector forms across all six groups", () => {
    expect(SHAPE_CATALOG).toHaveLength(45);
    expect(new Set(SHAPE_CATALOG.map((shape) => shape.id)).size).toBe(SHAPE_CATALOG.length);
    expect(new Set(SHAPE_CATALOG.map((shape) => shape.category)).size).toBe(6);
    expect(CATEGORY_LABELS.some((cat) => cat.id === "mine")).toBe(true);
    expect(CATALOG_DRAG_MIME).toBe("application/x-logo-studio-calligraphy-shape");
  });

  it("every catalog path is valid closed SVG outline with real editable nodes", () => {
    for (const shape of SHAPE_CATALOG) {
      const parsed = parseOutline(shape.path);
      expect(shape.path, shape.id).toBe(safePath(shape.path));
      expect(parsed, shape.id).not.toBeNull();
      expect(parsed?.[0]?.cmd, shape.id).toBe("M");
      expect(parsed?.some((seg) => seg.cmd === "Z"), shape.id).toBe(true);
      expect(outlineNodes(shape.path).length, shape.id).toBeGreaterThan(2);
      const bounds = outlineBounds(shape.path);
      expect(bounds, shape.id).not.toBeNull();
      expect(bounds!.width, shape.id).toBeGreaterThan(1);
      expect(bounds!.height, shape.id).toBeGreaterThan(1);
      const preview = outlinePreviewViewBox(shape.path).split(" ").map(Number);
      expect(preview.length, shape.id).toBe(4);
      expect(preview.every(Number.isFinite), shape.id).toBe(true);
      expect(preview[2]!, shape.id).toBeGreaterThan(bounds!.width);
      expect(preview[3]!, shape.id).toBeGreaterThan(bounds!.height);
    }
  });

  it("provides Arabic search with normalized diacritics and categories, including favorites", () => {
    expect(normalizeCatalogSearch("إِطَالَة ـ")).toBe("اطاله");
    expect(filterCatalog("نُقْطة", "dots").length).toBeGreaterThan(1);
    expect(filterCatalog("شدة", "harakat").some((shape) => shape.id === "shadda-wide")).toBe(true);
    const favorite = SHAPE_CATALOG[0]!.id;
    expect(filterCatalog("", "favorites", [favorite]).map((shape) => shape.id)).toEqual([favorite]);
    expect(filterCatalog("", "mine")).toEqual([]);
    expect(filterCatalog("غير موجود")).toEqual([]);
  });

  it("inserts a real centered editable outline and survives project save/reopen and SVG export", () => {
    const selected = createCatalogShape("kashida-double", 500, 320, "#e3a25b")!;
    expect(selected.kind).toBe("outline");
    expect(selected.catalogShapeId).toBe("kashida-double");
    expect(selected.pathData).toBeDefined();
    expect(selected.unitsPerEm).toBe(100);
    const bounds = outlineBounds(selected.pathData!)!;
    const scale = selected.size / selected.unitsPerEm!;
    expect(selected.x + bounds.midX * scale).toBeCloseTo(500, 7);
    expect(selected.y - bounds.midY * scale).toBeCloseTo(320, 7);
    const doc: DocumentState = {
      artboard: { width: 1000, height: 800, unit: "px", background: "#ffffff" },
      grids: [], objects: [], lettering: [selected],
    };
    const restored = parseProject(serializeProject(doc))!;
    expect(restored.lettering?.[0]?.pathData).toBe(selected.pathData);
    expect(restored.lettering?.[0]?.catalogShapeId).toBe("kashida-double");
    const svg = buildSvgDocument(restored, { background: false });
    expect(svg).toContain(selected.pathData!);
    expect(svg).toContain('fill="#e3a25b"');
  });


  it("centers asymmetric marks by true quadratic and cubic extrema in font-up coordinates", () => {
    const quadratic = outlineBounds("M0 0 Q50 100 100 0 L100 -10 L0 -10 Z")!;
    expect(quadratic.minX).toBe(0);
    expect(quadratic.maxX).toBe(100);
    expect(quadratic.minY).toBe(-10);
    expect(quadratic.maxY).toBeCloseTo(50, 8);
    const cubic = outlineBounds("M0 0 C0 100 100 100 100 0 L100 -10 L0 -10 Z")!;
    expect(cubic.maxY).toBeCloseTo(75, 8);
    expect(cubic.minY).toBe(-10);
    for (const id of ["dot-slanted", "dot-three-row", "fatha-hook", "drop-flame", "tail-hook"]) {
      const item = createCatalogShape(id, 465, 275, "#e3a25b")!;
      const box = outlineBounds(item.pathData!)!;
      const scale = item.size / item.unitsPerEm!;
      expect(item.x + box.midX * scale, id).toBeCloseTo(465, 7);
      expect(item.y - box.midY * scale, id).toBeCloseTo(275, 7);
    }
    expect(outlineBounds("not-a-path")).toBeNull();
  });

  it("refuses unknown drag identifiers and invalid coordinates/colors", () => {
    expect(createCatalogShape("unknown", 10, 20)).toBeNull();
    expect(createCatalogShape("dot-diamond", Infinity, 20)).toBeNull();
    expect(createCatalogShape("dot-diamond", 12, 10, 'red" onload="evil')).toBeNull();
    expect(createCatalogShape("dot-diamond", 200000, 0)).toBeNull();
  });
});
