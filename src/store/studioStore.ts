import { create } from "zustand";
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

export type ToolId =
  "select" | "line" | "circle" | "arc" | "pen" | "cell" | "polygon" | "measure" | "pan";

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
    snap: DEFAULT_SNAP_SETTINGS,
    precision: DEFAULT_PRECISION,
    measurement: null,
    cursor: null,

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

    setSelection: (ids) => set({ selection: ids }),
    toggleSelection: (id) =>
      set((s) => ({
        selection: s.selection.includes(id)
          ? s.selection.filter((x) => x !== id)
          : [...s.selection, id],
      })),
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
