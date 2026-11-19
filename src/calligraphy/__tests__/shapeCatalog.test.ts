import { describe, expect, it } from "vitest";
import { buildSvgDocument } from "../../objects/export";
import { parseProject, serializeProject } from "../../objects/project";
import type { DocumentState } from "../../store/studioStore";
import { safePath } from "../model";
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
    expect(selected.x + selected.size / 2).toBe(500);
    expect(selected.y - selected.size / 2).toBe(320);
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

  it("refuses unknown drag identifiers and invalid coordinates/colors", () => {
    expect(createCatalogShape("unknown", 10, 20)).toBeNull();
    expect(createCatalogShape("dot-diamond", Infinity, 20)).toBeNull();
    expect(createCatalogShape("dot-diamond", 12, 10, 'red" onload="evil')).toBeNull();
    expect(createCatalogShape("dot-diamond", 200000, 0)).toBeNull();
  });
});
