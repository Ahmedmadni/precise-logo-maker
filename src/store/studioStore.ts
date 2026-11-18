import { create } from "zustand";
import type { LetteringItem } from "../calligraphy/model";
import type { JoinGuideSelection } from "../calligraphy/joinAssistant";
import { remapRibbons } from "../calligraphy/ribbonJoin";
import { DEFAULT_BRUSH, type BrushSettings } from "../core/tracing/vectorBrush";
import { bakeRibbonAsOutline } from "../calligraphy/bakeUnion";
import { defaultCalligraphyGuides, relayoutHarakat, remapMarksAfterRecomposition, snapGlyphToBaseline, type CalligraphyGuideSettings } from "../calligraphy/harakaAnchoring";
import type { Unit } from "../core/coordinates/units";
import { toPx } from "../core/coordinates/units";
import type { ViewTransform } from "../core/coordinates/view";
import { pt } from "../core/geometry/math";
import { DEFAULT_SNAP_SETTINGS, type SnapSettings, type SnapType } from "../core/snapping/snap";
import {
  DEFAULT_STYLE,
  IDENTITY_TRANSFORM,
  type Geometry,
  type Point,
  type Style,
  type VectorObject,
} from "../core/geometry/types";
import { DEFAULT_PRECISION, type PrecisionSettings } from "../core/precision/constraints";
import type { Measurement } from "../core/precision/measure";
import { mirrorGeometry, rotateGeometry, translateGeometry } from "../objects/transform";
import {
  alignOffsets,
  distributeOffsets,
  type AlignMode,
  type DistributeAxis,
} from "../objects/align";

import { geometryBounds, unionBounds } from "../core/geometry/math";
import { createConcentricGrid, createGrid, createSquareGrid, type Grid } from "../grids";
import { cleanStroke } from "../core/tracing/simplify";
import type { GridCell } from "../grids/cells";
import type { ReferenceImage } from "../objects/reference";
import { booleanGeometry, type BooleanOp } from "../objects/boolean";

export type ToolId =
  "select" | "line" | "circle" | "arc" | "pen" | "brush" | "cell" | "polygon" | "measure" | "pan" | "lettering";

export interface Artboard {
  width: number;
  height: number;
  unit: Unit;
  background: string;
}

export interface DocumentState {
  artboard: Artboard;
  grids: Grid[];
  objects: VectorObject[];
  /** Editable lettering and independently positioned vector harakat. */
  lettering?: LetteringItem[];
  /** Optional calligraphy guidelines, never included in SVG/PNG exports. */
  calligraphyGuides?: CalligraphyGuideSettings;
  /** Optional licensed user-supplied font, persisted with the .logo project. */
  customThuluthFont?: string;
  /** Optional raster picture pinned under the grids for tracing. Never exported. */
  reference?: ReferenceImage | null;
}

/** Settings of the cell-painting tool. */
export interface PaintSettings {
  color: string;
  /** 0–1 fill opacity applied to newly painted cells. */
  opacity: number;
  /** Paint removes cells instead of filling them. */
  eraser: boolean;
  /** Grid whose cells are painted; null follows the first paintable grid. */
  gridId: string | null;
  /** Angular divisions used when painting concentric (polar) grids. */
  sectors: number;
  /** Paint the piece cut by ALL overlapping grids instead of one grid's cell. */
  combine: boolean;
}

/** Layer-wide behaviour of hand-drawn construction guides. */
export interface GuideLayerSettings {
  /** Guides cannot be picked, dragged or handle-edited. */
  locked: boolean;
  /** Guides are not drawn at all. */
  hidden: boolean;
  /**
   * Guide editing mode: guides stay visible even with grids off and are the
   * only objects the select tool can grab, so artwork never moves by mistake.
   */
  edit: boolean;
}

export const DEFAULT_GUIDE_LAYER: GuideLayerSettings = {
  locked: false,
  hidden: false,
  edit: false,
};

export const DEFAULT_PAINT: PaintSettings = {
  color: "#5b8cff",
  opacity: 1,
  eraser: false,
  gridId: null,
  sectors: 12,
  combine: true,
};

/** Assistance applied to freehand strokes drawn over the reference picture. */
export interface TraceSettings {
  /** Clean up shaky strokes: average, simplify, and fit lines / arcs. */
  smoothing: boolean;
  /** Deviation allowed while simplifying, in world units. */
  tolerance: number;
  /** Promote a cleaned stroke to a line, arc or circle when it fits. */
  fitShapes: boolean;
  /** Pull strokes onto the edges found in the reference picture. */
  magnetic: boolean;
  /** How far the magnet reaches, in world units. */
  magnetRadius: number;
  /** Minimum edge strength (0–1) worth snapping to. */
  edgeThreshold: number;
  /** Averaging passes applied to a stroke before simplifying. */
  passes: number;
  /** Turns sharper than this angle (degrees) stay sharp while smoothing. */
  cornerAngle: number;
}

export const DEFAULT_TRACE: TraceSettings = {
  smoothing: true,
  tolerance: 2.5,
  fitShapes: true,
  magnetic: true,
  magnetRadius: 14,
  edgeThreshold: 0.18,
  passes: 2,
  cornerAngle: 40,
};

export interface HistoryEntry {
  label: string;
  state: DocumentState;
}

export interface StudioState {
  doc: DocumentState;
  past: HistoryEntry[];
  future: HistoryEntry[];
  historyLog: string[];
  view: ViewTransform;
  tool: ToolId;
  selection: string[];
  selectedLetteringId: string | null;
  letteringMoveScope: "glyph" | "word";
  setLetteringMoveScope: (scope: "glyph" | "word") => void;
  selectedGlyphNodeId: number | null;
  setSelectedGlyphNodeId: (id: number | null) => void;
  letteringPreview: { id: string; patch: Partial<LetteringItem> } | null;
  setLetteringPreview: (id: string, patch: Partial<LetteringItem>) => void;
  commitLetteringPreview: () => void;
  editGlyphNodes: boolean;
  setEditGlyphNodes: (editing: boolean) => void;
  showAllGlyphNodes: boolean;
  setShowAllGlyphNodes: (show: boolean) => void;
  editGlyphContours: boolean;
  setEditGlyphContours: (editing: boolean) => void;
  selectedContourIndex: number | null;
  setSelectedContourIndex: (index: number | null) => void;
  editJoinAnchors: boolean;
  setEditJoinAnchors: (editing: boolean) => void;
  /** Editor-only join-gap guide. Never saved to .logo or exported. */
  joinGuide: JoinGuideSelection | null;
  setJoinGuide: (guide: JoinGuideSelection | null) => void;
  workspaceSection: "text" | "ornaments" | "edit" | "layers" | "draw" | "advanced";
  setWorkspaceSection: (section: "text" | "ornaments" | "edit" | "layers" | "draw" | "advanced") => void;
  letteringMode: "words" | "marks" | "layers";
  setLetteringMode: (mode: "words" | "marks" | "layers") => void;
  selectLettering: (id: string | null) => void;
  addLettering: (item: LetteringItem) => void;
  addLetteringBatch: (items: LetteringItem[]) => void;
  replaceLetteringGroup: (groupId: string, items: LetteringItem[]) => void;
  moveLetteringGroup: (groupId: string, dx: number, dy: number) => void;
  duplicateLettering: (id: string) => void;
  reorderLettering: (id: string, direction: -1 | 1) => void;
  updateLettering: (id: string, patch: Partial<LetteringItem>) => void;
  moveLettering: (id: string, dx: number, dy: number) => void;
  deleteLettering: (id: string) => void;
  /** Creates a separate flattened compound outline; the three source layers remain recoverable. */
  bakeLetteringJoin: (id: string) => { ok: boolean; reason?: string };
  setLetteringHidden: (id: string, hidden: boolean) => void;
  toggleBakedVersion: (id: string) => void;
  setCustomThuluthFont: (fontDataUrl: string) => void;
  setCalligraphyGuides: (patch: Partial<CalligraphyGuideSettings>) => void;
  setLetteringBaselineOffset: (id: string, offset: number) => void;
  snap: SnapSettings;
  precision: PrecisionSettings;
  measurement: Measurement | null;
  cursor: Point | null;
  viewport: { width: number; height: number };
  setViewport: (size: { width: number; height: number }) => void;

  paint: PaintSettings;
  setPaint: (patch: Partial<PaintSettings>) => void;
  /** Master switch for grid rendering — turn it off to preview the bare logo. */
  showGrids: boolean;
  setShowGrids: (visible: boolean) => void;
  /** Draw construction guides instead of logo artwork. */
  guideDraw: boolean;
  setGuideDraw: (on: boolean) => void;
  /** Layer-level controls for every hand-drawn guide. */
  guideLayer: GuideLayerSettings;
  setGuideLayer: (patch: Partial<GuideLayerSettings>) => void;
  /** Select every guide object (ignored while guides are locked or hidden). */
  selectAllGuides: () => void;
  /** Flip the selected objects between artwork and construction guide. */
  toggleSelectionGuide: (guide?: boolean) => void;
  paintCells: (cells: GridCell[], erase: boolean) => void;
  clearPaintedCells: () => void;
  setReference: (next: ReferenceImage | null) => void;
  updateReference: (patch: Partial<ReferenceImage>) => void;

  trace: TraceSettings;
  setTrace: (patch: Partial<TraceSettings>) => void;
  brush: BrushSettings;
  setBrush: (patch: Partial<BrushSettings>) => void;
  /** Re-runs the stroke cleanup over every selected freehand path. */
  smoothSelection: () => void;

  setView: (view: ViewTransform) => void;
  setTool: (tool: ToolId) => void;
  setCursor: (p: Point | null) => void;

  setArtboard: (patch: Partial<Artboard>) => void;
  addObject: (geometry: Geometry, label: string, style?: Partial<Style>) => string;
  updateObject: (id: string, patch: Partial<VectorObject>, label: string) => void;
  deleteSelection: () => void;

  addGrid: (kind: Grid["kind"]) => void;
  /** Inserts a suggested construction (grids + shapes) as one undoable step. */
  applyConstruction: (
    grids: Grid[],
    shapes: { geometry: Geometry; guide: boolean; style?: Partial<Style> | undefined }[],
    replace: boolean,
  ) => void;
  updateGrid: (id: string, patch: Partial<Grid>) => void;
  removeGrid: (id: string) => void;

  setSelection: (ids: string[]) => void;
  toggleSelection: (id: string) => void;
  clearSelection: () => void;

  translateSelection: (dx: number, dy: number) => void;
  rotateSelection: (angle: number) => void;
  mirrorSelection: (axis: "x" | "y") => void;
  duplicateSelection: () => void;
  radialRepeat: (count: number) => void;
  reorderObject: (id: string, direction: -1 | 1) => void;
  renameObject: (id: string, name: string) => void;
  setGeometry: (id: string, geometry: Geometry, label: string) => void;
  alignSelection: (mode: AlignMode) => void;
  distributeSelection: (axis: DistributeAxis) => void;

  setPrecision: (patch: Partial<PrecisionSettings>) => void;
  setMeasurement: (m: Measurement | null) => void;
  scaleSelection: (factor: number) => void;
  setSelectionStyle: (patch: Partial<Style>, label?: string) => void;
  /** Pathfinder: combine the selected shapes into one outline. */
  booleanSelection: (op: BooleanOp) => void;

  setSnapEnabled: (enabled: boolean) => void;
  toggleSnapType: (type: SnapType) => void;

  loadDocument: (doc: DocumentState, label?: string) => void;
  newDocument: () => void;

  undo: () => void;
  redo: () => void;
  jumpTo: (index: number) => void;
}

const DEFAULT_ARTBOARD: Artboard = {
  width: 1024,
  height: 1024,
  unit: "px",
  background: "#0f1115",
};

const artboardCenter = (a: Artboard): Point => pt(a.width / 2, a.height / 2);

const initialDoc = (): DocumentState => {
  const artboard = DEFAULT_ARTBOARD;
  const center = artboardCenter(artboard);
  return {
    artboard,
    grids: [createSquareGrid(center, artboard.width), createConcentricGrid(center, artboard.width)],
    objects: [],
    lettering: [],
    calligraphyGuides: defaultCalligraphyGuides(artboard.height),
    reference: null,
  };
};

let objectCounter = 0;
const nextObjectId = (): string => {
  objectCounter += 1;
  return `obj-${objectCounter}-${Math.floor(performance.now() % 100000)}`;
};

const HISTORY_LIMIT = 100;

/** Stroke colour shared by hand-drawn construction guides. */
export const GUIDE_COLOR = "#5b7bb5";

const selectionCenter = (doc: DocumentState, ids: string[]): Point | null => {
  const list = doc.objects.filter((o) => ids.includes(o.id));
  if (list.length === 0) return null;
  const b = unionBounds(list.map((o) => geometryBounds(o.geometry)));
  if (!Number.isFinite(b.minX)) return null;
  return pt((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2);
};

const geometryLabel: Record<Geometry["kind"], string> = {
  circle: "Circle",
  line: "Line",
  arc: "Arc",
  path: "Path",
};

export const useStudio = create<StudioState>()((set, get) => {
  const commit = (label: string, mutate: (doc: DocumentState) => DocumentState) => {
    const { doc, past, historyLog } = get();
    const next = mutate(doc);
    set({
      doc: next,
      past: [...past, { label, state: doc }].slice(-HISTORY_LIMIT),
      future: [],
      historyLog: [...historyLog, label].slice(-HISTORY_LIMIT),
    });
  };

  return {
    doc: initialDoc(),
    past: [],
    future: [],
    historyLog: ["New document"],
    view: { pan: pt(0, 0), zoom: 1, rotation: 0 },
    tool: "select",
    selection: [],
    selectedLetteringId: null,
    letteringMoveScope: "glyph",
    setLetteringMoveScope: (letteringMoveScope) => set({ letteringMoveScope }),
    selectedGlyphNodeId: null,
    setSelectedGlyphNodeId: (selectedGlyphNodeId) => set({ selectedGlyphNodeId }),
    letteringPreview: null,
    setLetteringPreview: (id, patch) => set({ letteringPreview: { id, patch } }),
    commitLetteringPreview: () => {
      const preview = get().letteringPreview;
      if (!preview) return;
      set({ letteringPreview: null });
      const item = get().doc.lettering?.find((entry) => entry.id === preview.id);
      if (!item) return;
      const changed = Object.entries(preview.patch).some(([key, val]) => item[key as keyof LetteringItem] !== val);
      if (!changed) return;
      commit("Adjust Arabic glyph", (doc) => ({
        ...doc,
        lettering: relayoutHarakat(doc.lettering ?? [], (doc.lettering ?? []).map((entry) => entry.id === preview.id ? { ...entry, ...preview.patch, ...(entry.kind === "haraka" && (preview.patch.x !== undefined || preview.patch.y !== undefined) ? { anchorMode: "manual" as const } : {}) } : entry)),
      }));
    },
    editGlyphNodes: false,
    showAllGlyphNodes: false,
    setShowAllGlyphNodes: (showAllGlyphNodes) => set({ showAllGlyphNodes }),
    setEditGlyphNodes: (editGlyphNodes) => set({
      editGlyphNodes, editGlyphContours: false, editJoinAnchors: false, selectedContourIndex: null, tool: "select",
    }),
    editGlyphContours: false,
    setEditGlyphContours: (editGlyphContours) => set({
      editGlyphContours, editGlyphNodes: false, editJoinAnchors: false, selectedGlyphNodeId: null, tool: "select",
    }),
    selectedContourIndex: null,
    setSelectedContourIndex: (selectedContourIndex) => set({ selectedContourIndex }),
    editJoinAnchors: false,
    joinGuide: null,
    setJoinGuide: (joinGuide) => set({ joinGuide }),
    setEditJoinAnchors: (editJoinAnchors) => set({
      editJoinAnchors, editGlyphNodes: false, editGlyphContours: false, tool: "select",
      ...(!editJoinAnchors ? { joinGuide: null } : {}),
    }),
    workspaceSection: "text",
    setWorkspaceSection: (workspaceSection) => {
      if (get().workspaceSection === workspaceSection) return;
      get().commitLetteringPreview();
      set({
        workspaceSection, editGlyphNodes: false, editGlyphContours: false,
        editJoinAnchors: false, joinGuide: null,
        selectedGlyphNodeId: null, selectedContourIndex: null,
      });
    },
    letteringMode: "words",
    setLetteringMode: (letteringMode) => set({ letteringMode }),
    selectLettering: (id) => {
      if (get().selectedLetteringId !== id) get().commitLetteringPreview();
      set({
        selectedLetteringId: id, selection: [], selectedGlyphNodeId: null,
        selectedContourIndex: null, letteringPreview: null,
        editGlyphNodes: false, editGlyphContours: false, editJoinAnchors: false,
        joinGuide: null,
        ...(id ? { workspaceSection: "edit" as const } : {}),
      });
    },
    addLettering: (item) => {
      commit("Add Arabic lettering", (doc) => ({ ...doc, lettering: relayoutHarakat(doc.lettering ?? [], [...(doc.lettering ?? []), item]) }));
      set({ selectedLetteringId: item.id, selection: [], tool: "select", workspaceSection: "edit" });
    },
    addLetteringBatch: (items) => {
      if (!items.length) return;
      commit(`Compose Arabic word (${items.length} glyphs)`, (doc) => ({
        ...doc, lettering: relayoutHarakat(doc.lettering ?? [], [...(doc.lettering ?? []), ...items]),
      }));
      set({ selectedLetteringId: items[0]!.id, selection: [], tool: "select", workspaceSection: "edit" });
    },
    replaceLetteringGroup: (groupId, items) => {
      if (!items.length) return;
      commit("Recompose Arabic word", (doc) => ({ ...doc,
        lettering: remapRibbons(doc.lettering ?? [],
          remapMarksAfterRecomposition(doc.lettering ?? [], items, groupId), groupId),
      }));
      set({ selectedLetteringId: items[0]!.id, letteringPreview: null, selectedGlyphNodeId: null });
    },
    moveLetteringGroup: (groupId, dx, dy) => {
      if (!groupId || (dx === 0 && dy === 0)) return;
      commit("Move calligraphy word", (doc) => {
        const moved = (doc.lettering ?? []).map((item) =>
          item.groupId === groupId ? { ...item, x: item.x + dx, y: item.y + dy } : item);
        const anchors = moved.filter((item) => item.kind === "outline" && item.groupId === groupId);
        const baseline = doc.calligraphyGuides?.baselineY ?? 0;
        const anchor = anchors.length ? anchors.reduce((best, item) =>
          Math.abs(item.y - baseline) < Math.abs(best.y - baseline) ? item : best) : undefined;
        const snap = anchor ? snapGlyphToBaseline(anchor, doc.calligraphyGuides) : undefined;
        const correction = snap && anchor ? snap.y - anchor.y : 0;
        const output = correction ? moved.map((item) =>
          item.groupId === groupId ? {
            ...item, y: item.y + correction,
            ...(item.id === anchor?.id ? { baselineOffset: snap!.baselineOffset } : {}),
          } : item) : moved;
        return { ...doc, lettering: relayoutHarakat(doc.lettering ?? [], output) };
      });
    },
    duplicateLettering: (id) => {
      const item = (get().doc.lettering ?? []).find((x) => x.id === id);
      if (!item) return;
      const copy = { ...item, id: `copy-${crypto.randomUUID()}`, groupId: undefined, x: item.x + 24, y: item.y + 24, ...(item.kind === "haraka" ? { anchorMode: "manual" as const } : {}) };
      commit("Duplicate calligraphy element", (doc) => ({ ...doc, lettering: [...(doc.lettering ?? []), copy] }));
      set({ selectedLetteringId: copy.id });
    },
    reorderLettering: (id, direction) => {
      commit("Reorder lettering", (doc) => {
        const lettering = [...(doc.lettering ?? [])];
        const index = lettering.findIndex((entry) => entry.id === id);
        const next = index + direction;
        if (index < 0 || next < 0 || next >= lettering.length) return doc;
        [lettering[index], lettering[next]] = [lettering[next]!, lettering[index]!];
        return { ...doc, lettering };
      });
    },
    updateLettering: (id, patch) =>
      commit("Edit Arabic lettering", (doc) => ({
        ...doc,
        lettering: relayoutHarakat(doc.lettering ?? [], (doc.lettering ?? []).map((item) => item.id === id ? { ...item, ...patch, id: item.id, kind: item.kind,
          ...(item.kind === "haraka" && (patch.x !== undefined || patch.y !== undefined) && patch.anchorMode === undefined ? { anchorMode: "manual" as const } : {}) } : item)),
      })),
    moveLettering: (id, dx, dy) => {
      if (dx === 0 && dy === 0) return;
      commit("Move Arabic lettering", (doc) => ({
        ...doc,
        lettering: relayoutHarakat(doc.lettering ?? [], (doc.lettering ?? []).map((item) => item.id === id
          ? snapGlyphToBaseline({ ...item, x: item.x + dx, y: item.y + dy,
              ...(item.kind === "haraka" ? { anchorMode: "manual" as const } : {}) }, doc.calligraphyGuides)
          : item)),
      }));
    },
    deleteLettering: (id) => {
      commit("Delete Arabic lettering", (doc) => ({
        ...doc,
        lettering: relayoutHarakat(doc.lettering ?? [], (doc.lettering ?? []).filter((item) =>
          item.id !== id &&
          (item.kind !== "bridge" || (item.ribbon?.sourceGlyphId !== id &&
            item.ribbon?.targetGlyphId !== id)))),
      }));
      if (get().selectedLetteringId === id) set({ selectedLetteringId: null });
    },
    bakeLetteringJoin: (id) => {
      get().commitLetteringPreview();
      const result = bakeRibbonAsOutline(get().doc.lettering ?? [], id);
      if (!result.ok) return { ok: false, reason: result.reason };
      commit("Bake unified Arabic outline (sources retained)", (doc) => ({
        ...doc, lettering: [
          ...(doc.lettering ?? []).map((item) => {
            if (result.sourceIds.includes(item.id)) return { ...item, hidden: true };
            if (item.kind === "haraka" && item.attachedToGlyphId &&
              result.sourceIds.slice(0, 2).includes(item.attachedToGlyphId)) {
              return {
                ...item, attachedToGlyphId: result.outline.id, anchorMode: "manual" as const,
                bakedOriginalAttachment: {
                  glyphId: item.attachedToGlyphId,
                  anchorMode: item.anchorMode ?? "auto" as const,
                },
              };
            }
            return item;
          }),
          result.outline,
        ],
      }));
      set({ selectedLetteringId: result.outline.id, tool: "select", workspaceSection: "edit" });
      return { ok: true };
    },
    setLetteringHidden: (id, hidden) => commit(hidden ? "Hide lettering layer" : "Show lettering layer",
      (doc) => ({ ...doc, lettering: (doc.lettering ?? []).map((item) =>
        item.id === id ? { ...item, hidden } : item) })),
    toggleBakedVersion: (id) => {
      const baked = (get().doc.lettering ?? []).find((item) => item.id === id);
      if (!baked?.bakedSourceIds?.length) return;
      const showSources = !baked.hidden;
      const relevant = new Set(baked.bakedSourceIds);
      commit(showSources ? "Restore original Arabic curves" : "Show unified vector version",
        (doc) => ({ ...doc, lettering: (doc.lettering ?? []).map((item) => {
          if (item.id === baked.id) return { ...item, hidden: showSources };
          if (relevant.has(item.id)) return { ...item, hidden: !showSources };
          if (item.kind === "haraka" && item.bakedOriginalAttachment &&
            relevant.has(item.bakedOriginalAttachment.glyphId)) {
            const origin = item.bakedOriginalAttachment;
            return {
              ...item, attachedToGlyphId: showSources ? origin.glyphId : baked.id,
              anchorMode: showSources ? origin.anchorMode : "manual" as const,
            };
          }
          return item;
        }) }));
      set({ selectedLetteringId: showSources ? baked.bakedSourceIds[0] ?? null : id });
    },
    setCustomThuluthFont: (fontDataUrl) => commit("Import licensed Arabic font", (doc) => ({ ...doc, customThuluthFont: fontDataUrl })),
    setCalligraphyGuides: (patch) => commit("Update calligraphy guides", (doc) => ({
      ...doc, calligraphyGuides: { ...(doc.calligraphyGuides ?? defaultCalligraphyGuides(doc.artboard.height)), ...patch },
    })),
    setLetteringBaselineOffset: (id, offset) => {
      if (!Number.isFinite(offset) || Math.abs(offset) > 10000) return;
      commit("Raise / lower Arabic glyph", (doc) => {
        const previous = doc.lettering ?? [];
        return { ...doc, lettering: relayoutHarakat(previous, previous.map((item) => item.id === id ? {
          ...item, y: item.y + offset - (item.baselineOffset ?? 0), baselineOffset: offset,
        } : item)) };
      });
    },
    snap: DEFAULT_SNAP_SETTINGS,
    precision: DEFAULT_PRECISION,
    measurement: null,
    cursor: null,

    brush: DEFAULT_BRUSH,
    setBrush: (patch) => set((s) => ({ brush: { ...s.brush, ...patch } })),
    setView: (view) => set({ view }),
    setTool: (tool) => set({ tool }),
    setCursor: (cursor) => set({ cursor }),
    viewport: { width: 1200, height: 800 },
    setViewport: (viewport) => set({ viewport }),

    setArtboard: (patch) =>
      commit("Change artboard", (doc) => ({
        ...doc,
        artboard: { ...doc.artboard, ...patch },
      })),

    addObject: (geometry, label, style) => {
      const id = nextObjectId();
      const guide = get().guideDraw;
      commit(label, (doc) => ({
        ...doc,
        objects: [
          ...doc.objects,
          {
            id,
            name: `${guide ? "Guide " : ""}${geometryLabel[geometry.kind]} ${doc.objects.length + 1}`,
            type: geometry.kind,
            geometry,
            transform: IDENTITY_TRANSFORM,
            style: guide
              ? { ...DEFAULT_STYLE, stroke: GUIDE_COLOR, fill: "none", strokeWidth: 1 }
              : { ...DEFAULT_STYLE, ...style },
            layerId: "shapes",
            visible: true,
            locked: false,
            guide,
          },
        ],
      }));
      return id;
    },

    updateObject: (id, patch, label) =>
      commit(label, (doc) => ({
        ...doc,
        objects: doc.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)),
      })),

    deleteSelection: () => {
      const ids = get().selection;
      if (ids.length === 0) return;
      commit(`Delete ${ids.length} object${ids.length > 1 ? "s" : ""}`, (doc) => ({
        ...doc,
        objects: doc.objects.filter((o) => !ids.includes(o.id)),
      }));
      set({ selection: [] });
    },

    paint: DEFAULT_PAINT,
    setPaint: (patch) => set((s) => ({ paint: { ...s.paint, ...patch } })),
    showGrids: true,
    setShowGrids: (showGrids) => set({ showGrids }),
    guideDraw: false,
    setGuideDraw: (guideDraw) => set({ guideDraw }),
    guideLayer: DEFAULT_GUIDE_LAYER,
    setGuideLayer: (patch) =>
      set((s) => {
        const guideLayer = { ...s.guideLayer, ...patch };
        // Editing guides implies they are reachable: unhide and unlock them.
        if (patch.edit) {
          guideLayer.hidden = false;
          guideLayer.locked = false;
        }
        const blocked = guideLayer.hidden || guideLayer.locked;
        const selection = blocked
          ? s.selection.filter((id) => !s.doc.objects.find((o) => o.id === id)?.guide)
          : s.selection;
        return { guideLayer, selection };
      }),
    selectAllGuides: () => {
      const { guideLayer, doc } = get();
      if (guideLayer.hidden || guideLayer.locked) return;
      set({ selection: doc.objects.filter((o) => o.guide).map((o) => o.id) });
    },
    toggleSelectionGuide: (guide) => {
      const ids = get().selection;
      if (ids.length === 0) return;
      const objects = get().doc.objects;
      const next = guide ?? !objects.filter((o) => ids.includes(o.id)).every((o) => o.guide);
      commit(next ? "Convert to guide" : "Convert to artwork", (doc) => ({
        ...doc,
        objects: doc.objects.map((o) =>
          ids.includes(o.id)
            ? {
                ...o,
                guide: next,
                style: next
                  ? { ...o.style, stroke: GUIDE_COLOR, fill: "none", strokeWidth: 1 }
                  : { ...o.style, stroke: DEFAULT_STYLE.stroke, strokeWidth: DEFAULT_STYLE.strokeWidth },
              }
            : o,
        ),
      }));
    },

    paintCells: (cells, erase) => {
      if (cells.length === 0) return;
      const label = erase
        ? `Erase ${cells.length} cell${cells.length > 1 ? "s" : ""}`
        : `Paint ${cells.length} cell${cells.length > 1 ? "s" : ""}`;
      const { color, opacity } = get().paint;
      commit(label, (doc) => {
        if (erase) {
          const keys = new Set(cells.map((c) => c.key));
          return {
            ...doc,
            objects: doc.objects.filter((o) => !(o.cellKey && keys.has(o.cellKey))),
          };
        }
        const objects = [...doc.objects];
        const indexByKey = new Map<string, number>();
        objects.forEach((o, i) => {
          if (o.cellKey) indexByKey.set(o.cellKey, i);
        });
        let painted = 0;
        for (const c of cells) {
          const geometry: Geometry = { kind: "path", points: c.points, closed: true };
          // A same-coloured hairline stroke hides the antialiasing seam between
          // neighbouring cells so a painted area reads as one solid shape.
          const style: Style = {
            ...DEFAULT_STYLE,
            fill: color,
            fillOpacity: opacity,
            stroke: color,
            strokeWidth: 1,
          };
          const existing = indexByKey.get(c.key);
          if (existing !== undefined) {
            // Repainting a cell recolours it; its geometry stays where the user
            // may have nudged it.
            const prev = objects[existing]!;
            objects[existing] = { ...prev, style: { ...prev.style, ...style } };
            continue;
          }
          painted += 1;
          indexByKey.set(c.key, objects.length);
          objects.push({
            id: nextObjectId(),
            name: `Cell ${doc.objects.length + painted}`,
            type: "path",
            geometry,
            transform: IDENTITY_TRANSFORM,
            style,
            layerId: "cells",
            visible: true,
            locked: false,
            cellKey: c.key,
          });
        }
        return { ...doc, objects };
      });
    },

    clearPaintedCells: () => {
      const has = get().doc.objects.some((o) => o.cellKey);
      if (!has) return;
      commit("Clear painted cells", (doc) => ({
        ...doc,
        objects: doc.objects.filter((o) => !o.cellKey),
      }));
      set({ selection: [] });
    },

    trace: DEFAULT_TRACE,
    setTrace: (patch) => set((s) => ({ trace: { ...s.trace, ...patch } })),

    smoothSelection: () => {
      const ids = get().selection;
      const { tolerance, fitShapes, passes, cornerAngle } = get().trace;
      if (ids.length === 0) return;
      const targets = get().doc.objects.filter(
        (o) => ids.includes(o.id) && !o.locked && o.geometry.kind === "path",
      );
      if (targets.length === 0) return;
      commit(`Smooth ${targets.length} path${targets.length > 1 ? "s" : ""}`, (doc) => ({
        ...doc,
        objects: doc.objects.map((o) => {
          if (!targets.some((t) => t.id === o.id) || o.geometry.kind !== "path") return o;
          const cleaned = cleanStroke(
            o.geometry.points,
            { tolerance, smoothing: passes, fitShapes, cornerAngle },
            o.geometry.closed,
          );
          return cleaned ? { ...o, geometry: cleaned, type: cleaned.kind } : o;
        }),
      }));
    },

    setReference: (next) =>
      commit(next === null ? "Remove reference image" : "Place reference image", (doc) => ({
        ...doc,
        reference: next,
      })),

    updateReference: (patch) =>
      commit("Adjust reference image", (doc) => ({
        ...doc,
        reference: doc.reference ? { ...doc.reference, ...patch } : null,
      })),

    addGrid: (kind) =>
      commit(`Add ${kind} grid`, (doc) => {
        const center = artboardCenter(doc.artboard);
        const size = Math.max(doc.artboard.width, doc.artboard.height);
        return { ...doc, grids: [...doc.grids, createGrid(kind, center, size)] };
      }),

    applyConstruction: (grids, shapes, replace) => {
      const ids: string[] = [];
      commit("AI construction", (doc) => {
        const made: VectorObject[] = shapes.map((s, i) => {
          const id = nextObjectId();
          ids.push(id);
          return {
            id,
            name: `${s.guide ? "Guide " : "AI "}${geometryLabel[s.geometry.kind]} ${doc.objects.length + i + 1}`,
            type: s.geometry.kind,
            geometry: s.geometry,
            transform: IDENTITY_TRANSFORM,
            style: s.guide
              ? { ...DEFAULT_STYLE, stroke: GUIDE_COLOR, fill: "none", strokeWidth: 1 }
              : { ...DEFAULT_STYLE, ...s.style },
            layerId: "shapes",
            visible: true,
            locked: false,
            guide: s.guide,
          };
        });
        return {
          ...doc,
          grids: replace ? grids : [...doc.grids, ...grids],
          objects: replace ? made : [...doc.objects, ...made],
        };
      });
      set({ selection: ids });
    },

    updateGrid: (id, patch) =>
      commit("Update grid", (doc) => ({
        ...doc,
        grids: doc.grids.map((g) => (g.id === id ? ({ ...g, ...patch } as Grid) : g)),
      })),

    removeGrid: (id) =>
      commit("Remove grid", (doc) => ({
        ...doc,
        grids: doc.grids.filter((g) => g.id !== id),
      })),

    setSelection: (ids) => {
      get().commitLetteringPreview();
      set({
        selection: ids, selectedLetteringId: null, selectedGlyphNodeId: null,
        selectedContourIndex: null, editGlyphNodes: false,
        editGlyphContours: false, editJoinAnchors: false,
      });
    },
    toggleSelection: (id) => {
      get().commitLetteringPreview();
      set((s) => ({
        selectedLetteringId: null, selectedGlyphNodeId: null,
        selectedContourIndex: null, editGlyphNodes: false,
        editGlyphContours: false, editJoinAnchors: false,
        selection: s.selection.includes(id)
          ? s.selection.filter((x) => x !== id)
          : [...s.selection, id],
      }));
    },
    clearSelection: () => set({ selection: [] }),

    translateSelection: (dx, dy) => {
      const ids = get().selection;
      if (ids.length === 0 || (dx === 0 && dy === 0)) return;
      commit("Move selection", (doc) => ({
        ...doc,
        objects: doc.objects.map((o) =>
          ids.includes(o.id) && !o.locked
            ? { ...o, geometry: translateGeometry(o.geometry, dx, dy) }
            : o,
        ),
      }));
    },

    rotateSelection: (angle) => {
      const ids = get().selection;
      if (ids.length === 0 || angle === 0) return;
      const origin = selectionCenter(get().doc, ids);
      if (!origin) return;
      commit(`Rotate ${angle}°`, (doc) => ({
        ...doc,
        objects: doc.objects.map((o) =>
          ids.includes(o.id) && !o.locked
            ? { ...o, geometry: rotateGeometry(o.geometry, angle, origin) }
            : o,
        ),
      }));
    },

    mirrorSelection: (axis) => {
      const ids = get().selection;
      if (ids.length === 0) return;
      const origin = selectionCenter(get().doc, ids);
      if (!origin) return;
      commit(axis === "x" ? "Mirror horizontally" : "Mirror vertically", (doc) => ({
        ...doc,
        objects: doc.objects.map((o) =>
          ids.includes(o.id) && !o.locked
            ? { ...o, geometry: mirrorGeometry(o.geometry, axis, origin) }
            : o,
        ),
      }));
    },

    duplicateSelection: () => {
      const ids = get().selection;
      if (ids.length === 0) return;
      const newIds: string[] = [];
      commit("Duplicate selection", (doc) => {
        const copies = doc.objects
          .filter((o) => ids.includes(o.id))
          .map((o) => {
            const id = nextObjectId();
            newIds.push(id);
            // A copy is no longer tied to the grid cell it came from.
            return {
              ...o,
              id,
              name: `${o.name} copy`,
              geometry: { ...o.geometry },
              cellKey: undefined,
            };
          });
        return { ...doc, objects: [...doc.objects, ...copies] };
      });
      set({ selection: newIds });
    },

    radialRepeat: (count) => {
      const ids = get().selection;
      if (ids.length === 0 || count < 2) return;
      const origin = artboardCenter(get().doc.artboard);
      commit(`Radial repeat ×${count}`, (doc) => {
        const sources = doc.objects.filter((o) => ids.includes(o.id));
        const clones: VectorObject[] = [];
        for (let i = 1; i < count; i += 1) {
          const angle = (360 / count) * i;
          for (const o of sources) {
            clones.push({
              ...o,
              id: nextObjectId(),
              name: `${o.name} ${i + 1}`,
              geometry: rotateGeometry(o.geometry, angle, origin),
              cellKey: undefined,
            });
          }
        }
        return { ...doc, objects: [...doc.objects, ...clones] };
      });
    },

    reorderObject: (id, direction) =>
      commit("Reorder object", (doc) => {
        const index = doc.objects.findIndex((o) => o.id === id);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= doc.objects.length) return doc;
        const objects = [...doc.objects];
        const [moved] = objects.splice(index, 1);
        if (moved) objects.splice(target, 0, moved);
        return { ...doc, objects };
      }),

    renameObject: (id, name) =>
      commit("Rename object", (doc) => ({
        ...doc,
        objects: doc.objects.map((o) => (o.id === id ? { ...o, name } : o)),
      })),

    setGeometry: (id, geometry, label) =>
      commit(label, (doc) => ({
        ...doc,
        objects: doc.objects.map((o) => (o.id === id ? { ...o, geometry } : o)),
      })),

    alignSelection: (mode) => {
      const ids = get().selection;
      if (ids.length === 0) return;
      commit(`Align ${mode}`, (doc) => {
        const targets = doc.objects.filter((o) => ids.includes(o.id) && !o.locked);
        if (targets.length === 0) return doc;
        const boundsList = targets.map((o) => geometryBounds(o.geometry));
        const target =
          targets.length > 1 ? unionBounds(boundsList) : artboardWorldBounds(doc.artboard);
        const offsets = alignOffsets(boundsList, mode, target);
        const byId = new Map(targets.map((o, i) => [o.id, offsets[i]]));
        return {
          ...doc,
          objects: doc.objects.map((o) => {
            const d = byId.get(o.id);
            return d ? { ...o, geometry: translateGeometry(o.geometry, d.x, d.y) } : o;
          }),
        };
      });
    },

    distributeSelection: (axis) => {
      const ids = get().selection;
      if (ids.length < 3) return;
      commit(`Distribute ${axis === "x" ? "horizontally" : "vertically"}`, (doc) => {
        const targets = doc.objects.filter((o) => ids.includes(o.id) && !o.locked);
        if (targets.length < 3) return doc;
        const offsets = distributeOffsets(
          targets.map((o) => geometryBounds(o.geometry)),
          axis,
        );
        const byId = new Map(targets.map((o, i) => [o.id, offsets[i]]));
        return {
          ...doc,
          objects: doc.objects.map((o) => {
            const d = byId.get(o.id);
            return d ? { ...o, geometry: translateGeometry(o.geometry, d.x, d.y) } : o;
          }),
        };
      });
    },

    setPrecision: (patch) => set((s) => ({ precision: { ...s.precision, ...patch } })),
    setMeasurement: (measurement) => set({ measurement }),

    scaleSelection: (factor) => {
      const ids = get().selection;
      if (ids.length === 0 || factor <= 0) return;
      commit(`Scale ×${factor.toFixed(3)}`, (doc) => ({
        ...doc,
        objects: doc.objects.map((o) => {
          if (!ids.includes(o.id) || o.locked) return o;
          const g = o.geometry;
          if (g.kind === "line") {
            const cx = (g.a.x + g.b.x) / 2;
            const cy = (g.a.y + g.b.y) / 2;
            return {
              ...o,
              geometry: {
                ...g,
                a: pt(cx + (g.a.x - cx) * factor, cy + (g.a.y - cy) * factor),
                b: pt(cx + (g.b.x - cx) * factor, cy + (g.b.y - cy) * factor),
              },
            };
          }
          if (g.kind === "path") {
            const c = g.points.reduce((acc, p) => pt(acc.x + p.x, acc.y + p.y), pt(0, 0));
            const n = g.points.length || 1;
            const cx = c.x / n;
            const cy = c.y / n;
            return {
              ...o,
              geometry: {
                ...g,
                points: g.points.map((p) => pt(cx + (p.x - cx) * factor, cy + (p.y - cy) * factor)),
              },
            };
          }
          return { ...o, geometry: { ...g, radius: g.radius * factor } };
        }),
      }));
    },

    booleanSelection: (op) => {
      const ids = get().selection;
      const doc = get().doc;
      const sources = doc.objects.filter((o) => ids.includes(o.id) && !o.locked);
      if (sources.length < 2) return;
      const parts = booleanGeometry(
        sources.map((o) => o.geometry),
        op,
      );
      if (parts.length === 0) return;
      const base = sources[0]!;
      const newIds: string[] = [];
      const labels: Record<BooleanOp, string> = {
        union: "Merge shapes",
        subtract: "Subtract shapes",
        intersect: "Intersect shapes",
        exclude: "Exclude shapes",
      };
      commit(labels[op], (d) => {
        const made = parts.map((geometry, i) => {
          const id = nextObjectId();
          newIds.push(id);
          return {
            ...base,
            id,
            name: `${labels[op]} ${i + 1}`,
            type: "path" as const,
            geometry,
            cellKey: undefined,
          };
        });
        return { ...d, objects: [...d.objects.filter((o) => !ids.includes(o.id)), ...made] };
      });
      set({ selection: newIds });
    },

    setSelectionStyle: (patch, label = "Change style") => {
      const ids = get().selection;
      if (ids.length === 0) return;
      commit(label, (doc) => ({
        ...doc,
        objects: doc.objects.map((o) =>
          ids.includes(o.id) ? { ...o, style: { ...o.style, ...patch } } : o,
        ),
      }));
    },

    setSnapEnabled: (enabled) => set((s) => ({ snap: { ...s.snap, enabled } })),
    toggleSnapType: (type) =>
      set((s) => ({
        snap: { ...s.snap, types: { ...s.snap.types, [type]: !s.snap.types[type] } },
      })),

    loadDocument: (next, label = "Open project") => {
      const { doc, past, historyLog } = get();
      set({
        doc: next,
        past: [...past, { label, state: doc }].slice(-HISTORY_LIMIT),
        future: [],
        historyLog: [...historyLog, label].slice(-HISTORY_LIMIT),
        selection: [],
        selectedLetteringId: null,
        selectedGlyphNodeId: null,
        selectedContourIndex: null,
        editGlyphContours: false,
        editJoinAnchors: false,
        letteringPreview: null,
        measurement: null,
      });
    },

    newDocument: () => get().loadDocument(initialDoc(), "New document"),

    undo: () => {
      const { past, doc, future, historyLog } = get();
      const prev = past[past.length - 1];
      if (!prev) return;
      set({
        doc: prev.state,
        past: past.slice(0, -1),
        future: [{ label: prev.label, state: doc }, ...future],
        historyLog: historyLog.slice(0, -1),
      });
    },

    redo: () => {
      const { past, doc, future, historyLog } = get();
      const next = future[0];
      if (!next) return;
      set({
        doc: next.state,
        past: [...past, { label: next.label, state: doc }],
        future: future.slice(1),
        historyLog: [...historyLog, next.label],
      });
    },

    jumpTo: (index) => {
      const { past, doc } = get();
      if (index < 0 || index >= past.length) return;
      const target = past[index];
      if (!target) return;
      set({
        doc: target.state,
        past: past.slice(0, index),
        future: [
          ...past.slice(index).map((e, i, arr) => ({
            label: e.label,
            state: arr[i + 1]?.state ?? doc,
          })),
        ],
        historyLog: get().historyLog.slice(0, index + 1),
      });
    },
  };
});

export const artboardWorldBounds = (a: Artboard) => ({
  minX: 0,
  minY: 0,
  maxX: a.width,
  maxY: a.height,
});

export const artboardSizeInUnit = (a: Artboard): { width: number; height: number } => ({
  width: a.width,
  height: a.height,
});

export const artboardFromUnit = (value: number, unit: Unit): number => toPx(value, unit);
