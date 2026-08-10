import { create } from "zustand";
import type { Unit } from "../core/coordinates/units";
import { toPx } from "../core/coordinates/units";
import type { ViewTransform } from "../core/coordinates/view";
import { pt } from "../core/geometry/math";
import {
  DEFAULT_SNAP_SETTINGS,
  type SnapSettings,
  type SnapType,
} from "../core/snapping/snap";
import {
  DEFAULT_STYLE,
  IDENTITY_TRANSFORM,
  type Geometry,
  type Point,
  type VectorObject,
} from "../core/geometry/types";
import {
  DEFAULT_PRECISION,
  type PrecisionSettings,
} from "../core/precision/constraints";
import type { Measurement } from "../core/precision/measure";
import {
  mirrorGeometry,
  rotateGeometry,
  translateGeometry,
} from "../objects/transform";
import { geometryBounds, unionBounds } from "../core/geometry/math";
import {
  createConcentricGrid,
  createGrid,
  createSquareGrid,
  type Grid,
} from "../grids";

export type ToolId = "select" | "line" | "circle" | "arc" | "measure" | "pan";

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
}

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


  setView: (view: ViewTransform) => void;
  setTool: (tool: ToolId) => void;
  setCursor: (p: Point | null) => void;

  setArtboard: (patch: Partial<Artboard>) => void;
  addObject: (geometry: Geometry, label: string) => string;
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

  setPrecision: (patch: Partial<PrecisionSettings>) => void;
  setMeasurement: (m: Measurement | null) => void;
  scaleSelection: (factor: number) => void;

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
    grids: [
      createSquareGrid(center, artboard.width),
      createConcentricGrid(center, artboard.width),
    ],
    objects: [],
  };
};

let objectCounter = 0;
const nextObjectId = (): string => {
  objectCounter += 1;
  return `obj-${objectCounter}-${Math.floor(performance.now() % 100000)}`;
};

const HISTORY_LIMIT = 100;

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

    addObject: (geometry, label) => {
      const id = nextObjectId();
      commit(label, (doc) => ({
        ...doc,
        objects: [
          ...doc.objects,
          {
            id,
            name: `${geometryLabel[geometry.kind]} ${doc.objects.length + 1}`,
            type: geometry.kind,
            geometry,
            transform: IDENTITY_TRANSFORM,
            style: { ...DEFAULT_STYLE },
            layerId: "shapes",
            visible: true,
            locked: false,
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
            return { ...o, id, name: `${o.name} copy`, geometry: { ...o.geometry } };
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
          return { ...o, geometry: { ...g, radius: g.radius * factor } };
        }),
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
