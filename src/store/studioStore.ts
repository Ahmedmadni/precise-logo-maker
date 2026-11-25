import { create } from "zustand";
import {trimUndo,jumpHistory} from "./historyBudget";
import type { ControlLinkMode } from "../calligraphy/handleCoupling";
import type { LetteringItem } from "../calligraphy/model";
import {
  combineGlyphLibrary, makeGlyphLibraryEntry, makeStandaloneLibraryGlyph,
  canReplaceWithLibraryEntry, type GlyphLibraryEntry,
} from "../calligraphy/glyphLibrary";
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
  type PathGeometry,
  type Point,
  type Style,
  type VectorObject,
} from "../core/geometry/types";
import { DEFAULT_PRECISION, type PrecisionSettings } from "../core/precision/constraints";
import type { Measurement } from "../core/precision/measure";
import { mirrorGeometry, rotateGeometry, scaleGeometry, translateGeometry } from "../objects/transform";
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
import { booleanGeometryChecked, type BooleanOp } from "../objects/boolean";
import { splitShapeAtAngle, splitShapeCurved, type SplitAxis } from "../objects/splitShape";
import { cutOpenPath } from "../editor/scissors";
import {composeGlyphTiers,type TierOptions} from "../calligraphy/tieredComposition";
import {suggestDecorationPositions,arrangeDecorations,type DecorationBatchScope} from "../calligraphy/decorationPlacement";
import { nudgePathNodes } from "../editor/path-nodes";
import {translateGlyphSelection,transformGlyphSelection,arrangeGlyphSelection,spaceGlyphSelection,type GlyphGroupTransform,type GlyphArrangeAxis,type GlyphArrangeMode} from "../calligraphy/groupSelection";
import { eligibleJoinObject,joinOpenPaths,type PathEnd,type JoinMode } from "../editor/joinPaths";

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
  /** Reusable user-curated vector glyphs, embedded in .logo without fonts or remote DB. */
  glyphLibrary?: GlyphLibraryEntry[];
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

/** Ephemeral editor workspace; deliberately excluded from .logo serialization. */
export type GlyphInspectorTab = "basic" | "paths" | "joins" | "composition" | "alternates";

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
  /** Keep the editor's current workflow when another glyph is selected. */
  glyphInspectorTab: GlyphInspectorTab;
  setGlyphInspectorTab: (tab: GlyphInspectorTab) => void;
  setLetteringMoveScope: (scope: "glyph" | "word") => void;
  selectedGlyphNodeId: number | null;
  setSelectedGlyphNodeId: (id: number | null) => void;
  letteringPreview: { id: string; patch: Partial<LetteringItem> } | null;
  setLetteringPreview: (id: string, patch: Partial<LetteringItem>) => void;
  commitLetteringPreview: () => void;
  glyphLassoActive:boolean;
  glyphMultiIds:string[];
  setGlyphLassoActive:(active:boolean)=>void;
  setGlyphMultiIds:(ids:string[])=>void;
  arrangeDecorationBatch:(source:DocumentState,id:string,scope:DecorationBatchScope,includeManual:boolean,clearance:number)=>boolean;
  placeDecorationAtSuggestion:(source:DocumentState,id:string,x:number,y:number,clearance:number)=>boolean;
  composeGlyphMultiTiers:(source:LetteringItem[],ids:string[],options:TierOptions)=>boolean;
  spaceGlyphMulti:(source:LetteringItem[],ids:string[],axis:GlyphArrangeAxis,gap:number)=>boolean;
  arrangeGlyphMulti:(source:LetteringItem[],ids:string[],axis:GlyphArrangeAxis,mode:GlyphArrangeMode)=>boolean;
  transformGlyphMulti:(source:LetteringItem[],ids:string[],options:GlyphGroupTransform)=>boolean;
  moveGlyphMulti:(source:LetteringItem[],ids:string[],dx:number,dy:number)=>boolean;
  nodeLassoTargetId:string|null;
  pathNodeSelection:{objectId:string;geometry:PathGeometry;indices:number[]}|null;
  setNodeLassoTarget:(id:string|null)=>void;
  setPathNodeSelection:(value:StudioState["pathNodeSelection"])=>void;
  moveSelectedPathNodes:(objectId:string,source:PathGeometry,indices:number[],dx:number,dy:number)=>boolean;
  lassoActive:boolean;
  setLassoActive:(active:boolean)=>void;
  knifeTargetId:string|null;
  setKnifeTargetId:(id:string|null)=>void;
  pathControlSelection: {objectId:string;edge:number;mode:"free"|"aligned"|"symmetric"} | null;
  setPathControlSelection: (value:StudioState["pathControlSelection"])=>void;
  editGlyphNodes: boolean;
  setEditGlyphNodes: (editing: boolean) => void;
  showAllGlyphNodes: boolean;
  setShowAllGlyphNodes: (show: boolean) => void;
  /** Move connected Bézier handles with an anchor to preserve local tangents. */
  moveGlyphNodeHandles: boolean;
  setMoveGlyphNodeHandles: (preserve: boolean) => void;
  /** Lock opposite cubic tangent during a handle drag (editor-only, not saved). */
  controlLinkMode: ControlLinkMode;
  setControlLinkMode: (mode: ControlLinkMode) => void;
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
  saveGlyphVariant: (glyphId: string, name: string) => { ok: boolean; reason?: string };
  applyGlyphVariant: (variantId: string, glyphId: string) => { ok: boolean; reason?: string };
  insertGlyphVariant: (variantId: string) => { ok: boolean; reason?: string };
  importGlyphVariants: (entries: GlyphLibraryEntry[]) => { ok: boolean; reason?: string };
  removeGlyphVariant: (variantId: string) => void;
  moveLetteringGroup: (groupId: string, dx: number, dy: number) => void;
  duplicateLettering: (id: string) => void;
  reorderLettering: (id: string, direction: -1 | 1) => void;
  updateLettering: (id: string, patch: Partial<LetteringItem>) => void;
  updateLetteringMany: (entries: { id: string; patch: Partial<LetteringItem> }[], label: string, preserveMarkPositions?: boolean) => void;
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
  joinSelectedPaths:(aId:string,bId:string,aEnd:PathEnd,bEnd:PathEnd,mode:JoinMode)=>{ok:true}|{ok:false;reason:"selection"|"protected"|"invalid"};
  cutSelectedOpenPath:(edge:number,t:number)=>{ok:true;count:number}|{ok:false;reason:"selection"|"protected"|"invalid"};
  splitSelectedShape: (axis:SplitAxis|"angle"|"curve",fraction:number,degrees?:number,bend?:number)=>{ok:true;count:number}|{ok:false;reason:"selection"|"protected"|"invalid"|"empty"|"complexity"};
  booleanSelection: (op: BooleanOp) => {ok:true;count:number}|{ok:false;reason:"selection"|"invalid"|"holes"|"empty"|"complexity"|"protected"};

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
    glyphLibrary: [],
    calligraphyGuides: defaultCalligraphyGuides(artboard.height),
    reference: null,
  };
};

let objectCounter = 0;
const nextObjectId = (): string => {
  objectCounter += 1;
  return `obj-${objectCounter}-${Math.floor(performance.now() % 100000)}`;
};

const resetHistoryInteraction = () => ({selection:[],selectedLetteringId:null,selectedGlyphNodeId:null,selectedContourIndex:null,letteringPreview:null,editGlyphNodes:false,editGlyphContours:false,editJoinAnchors:false,joinGuide:null,glyphLassoActive:false,glyphMultiIds:[],lassoActive:false,nodeLassoTargetId:null,pathNodeSelection:null,knifeTargetId:null,pathControlSelection:null,measurement:null});

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
    if(next===doc)return;
    const retained=trimUndo([...past,{label,state:doc}],next);
    set({
      doc: next,
      past: retained,
      future: [],
      historyLog: [...historyLog,label].slice(-(retained.length+1)),
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
    glyphLassoActive:false,
    glyphMultiIds:[],
    setGlyphLassoActive:(active)=>{
      get().commitLetteringPreview();
      set({glyphLassoActive:active,glyphMultiIds:[],lassoActive:active,nodeLassoTargetId:null,pathNodeSelection:null,knifeTargetId:null,pathControlSelection:null,tool:"select",selection:[],selectedLetteringId:null,selectedGlyphNodeId:null,selectedContourIndex:null,editGlyphNodes:false,editGlyphContours:false,editJoinAnchors:false,joinGuide:null});
    },
    setGlyphMultiIds:(ids)=>set({glyphMultiIds:[...new Set(ids)]}),
    arrangeDecorationBatch:(source,id,scope,includeManual,clearance)=>{
      const s=get();
      if(s.doc!==source||s.selectedLetteringId!==id||s.letteringPreview||s.guideLayer.edit)return false;
      const obstacles=source.objects.filter(o=>o.visible&&!o.guide).map(o=>{
        const b=geometryBounds(o.geometry),p=Math.max(0,o.style.strokeWidth)/2;
        return {minX:b.minX-p,minY:b.minY-p,maxX:b.maxX+p,maxY:b.maxY+p};
      });
      const result=arrangeDecorations(source.lettering??[],id,source.artboard,scope,includeManual,clearance,obstacles);
      if(!result.ok||!result.moved)return false;
      commit("Arrange calligraphy decorations",d=>({...d,lettering:result.items}));
      return true;
    },
    placeDecorationAtSuggestion:(source,id,x,y,clearance)=>{
      const s=get();
      if(s.doc!==source||s.selectedLetteringId!==id||s.letteringPreview||s.guideLayer.edit)return false;
      const items=source.lettering??[];
      const obstacles=source.objects.filter(o=>o.visible&&!o.guide).map(o=>{
        const b=geometryBounds(o.geometry),p=Math.max(0,o.style.strokeWidth)/2;
        return {minX:b.minX-p,minY:b.minY-p,maxX:b.maxX+p,maxY:b.maxY+p};
      });
      const result=suggestDecorationPositions(items,id,source.artboard,clearance,obstacles);
      if(!result.ok||!result.options.some(p=>p.x===x&&p.y===y))return false;
      commit("Place calligraphy decoration",d=>({...d,lettering:items.map(i=>i.id===id?{...i,x,y,...(i.kind==="haraka"?{anchorMode:"manual" as const}:{})}:i)}));
      return true;
    },
    composeGlyphMultiTiers:(source,ids,options)=>{
      const s=get();
      if(!s.glyphLassoActive||s.guideLayer.edit||s.doc.lettering!==source||JSON.stringify(s.glyphMultiIds)!==JSON.stringify(ids))return false;
      const result=composeGlyphTiers(source,ids,options);
      if(!result.ok||!result.changed)return false;
      commit("Compose tiered Arabic lettering",d=>({...d,lettering:result.items}));
      return true;
    },
    spaceGlyphMulti:(source,ids,axis,gap)=>{
      const s=get();
      if(!s.glyphLassoActive||s.guideLayer.edit||s.doc.lettering!==source||JSON.stringify(s.glyphMultiIds)!==JSON.stringify(ids))return false;
      const result=spaceGlyphSelection(source,ids,axis,gap);
      if(!result.ok||!result.changed)return false;
      commit("Space selected Arabic glyphs",d=>({...d,lettering:result.items}));
      return true;
    },
    arrangeGlyphMulti:(source,ids,axis,mode)=>{
      const s=get();
      if(!s.glyphLassoActive||s.guideLayer.edit||s.doc.lettering!==source||JSON.stringify(s.glyphMultiIds)!==JSON.stringify(ids))return false;
      const result=arrangeGlyphSelection(source,ids,axis,mode);
      if(!result.ok||!result.changed)return false;
      commit("Arrange selected Arabic glyphs",d=>({...d,lettering:result.items}));
      return true;
    },
    transformGlyphMulti:(source,ids,options)=>{
      const s=get();
      if(!s.glyphLassoActive||s.guideLayer.edit||s.doc.lettering!==source||JSON.stringify(s.glyphMultiIds)!==JSON.stringify(ids))return false;
      if(options.scale===1&&options.degrees===0)return false;
      const next=transformGlyphSelection(source,ids,options);
      if(!next)return false;
      commit("Transform selected Arabic glyphs",d=>({...d,lettering:next}));
      return true;
    },
    moveGlyphMulti:(source,ids,dx,dy)=>{
      const s=get();
      if(!s.glyphLassoActive||s.guideLayer.edit||s.doc.lettering!==source||JSON.stringify(s.glyphMultiIds)!==JSON.stringify(ids))return false;
      const next=translateGlyphSelection(source,ids,dx,dy);
      if(!next)return false;
      commit("Move selected Arabic glyphs",d=>({...d,lettering:next}));
      return true;
    },
    nodeLassoTargetId:null,
    pathNodeSelection:null,
    setNodeLassoTarget:(nodeLassoTargetId)=>set({nodeLassoTargetId,glyphLassoActive:false,glyphMultiIds:[],lassoActive:!!nodeLassoTargetId,tool:"select",knifeTargetId:null,pathControlSelection:null}),
    setPathNodeSelection:(pathNodeSelection)=>set({pathNodeSelection}),
    moveSelectedPathNodes:(objectId,source,indices,dx,dy)=>{
      const s=get(),o=s.doc.objects.find(o=>o.id===objectId);
      if(!o||o.geometry!==source||s.selection.length!==1||s.selection[0]!==objectId||o.locked||!o.visible||o.guide||source.holes?.length||s.nodeLassoTargetId!==objectId||s.guideLayer.edit)return false;
      const next=nudgePathNodes(source,indices,dx,dy);
      if(next===source)return false;
      commit("Move path nodes",d=>({...d,objects:d.objects.map(o=>o.id===objectId?{...o,geometry:next}:o)}));
      set({pathNodeSelection:{objectId,geometry:next,indices}});
      return true;
    },
    lassoActive:false,
    setLassoActive:(lassoActive)=>set({lassoActive,glyphLassoActive:false,glyphMultiIds:[],nodeLassoTargetId:null,pathNodeSelection:null,tool:"select",knifeTargetId:null,pathControlSelection:null}),
    knifeTargetId:null,
    setKnifeTargetId:(knifeTargetId)=>set({knifeTargetId,tool:"select",glyphLassoActive:false,glyphMultiIds:[],lassoActive:false,nodeLassoTargetId:null,pathNodeSelection:null,pathControlSelection:null}),
    pathControlSelection:null,
    setPathControlSelection:(pathControlSelection)=>set({pathControlSelection}),
    letteringMoveScope: "glyph",
    glyphInspectorTab: "basic",
    setGlyphInspectorTab: (glyphInspectorTab) => {
      if (get().glyphInspectorTab === glyphInspectorTab) return;
      get().commitLetteringPreview();
      set({
        glyphInspectorTab,
        editGlyphNodes: false,
        editGlyphContours: false,
        editJoinAnchors: glyphInspectorTab === "joins",
        selectedGlyphNodeId: null,
        selectedContourIndex: null,
        joinGuide: null,
        tool: "select",
      });
    },
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
    moveGlyphNodeHandles: true,
    setMoveGlyphNodeHandles: (moveGlyphNodeHandles) => set({ moveGlyphNodeHandles }),
    controlLinkMode: "free",
    setControlLinkMode: (controlLinkMode) => set({ controlLinkMode }),
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
        selectedLetteringId: id, selection: [], glyphLassoActive:false,glyphMultiIds:[],lassoActive:false,nodeLassoTargetId:null,pathNodeSelection:null,knifeTargetId:null, selectedGlyphNodeId: null,
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
    saveGlyphVariant: (glyphId, name) => {
      get().commitLetteringPreview();
      const doc = get().doc;
      const selected = (doc.lettering ?? []).find((item) => item.id === glyphId);
      if (!selected) return { ok: false, reason: "حدد حرف فيكتور أولاً." };
      const entry = makeGlyphLibraryEntry(selected, name);
      if (!entry) return { ok: false, reason: "تعذر حفظ هذا الحرف؛ راجع الاسم وصحة مسارات الفيكتور." };
      const merged = combineGlyphLibrary(doc.glyphLibrary ?? [], [entry]);
      if (!merged) return { ok: false, reason: "المكتبة ممتلئة أو تتجاوز الحد المسموح." };
      if (merged.length === (doc.glyphLibrary ?? []).length)
        return { ok: false, reason: "هذا الشكل محفوظ بالفعل في المكتبة." };
      commit("Save custom calligraphy glyph", (previous) => ({ ...previous, glyphLibrary: merged }));
      return { ok: true };
    },
    applyGlyphVariant: (variantId, glyphId) => {
      get().commitLetteringPreview();
      const doc = get().doc;
      const entry = (doc.glyphLibrary ?? []).find((item) => item.id === variantId);
      const selected = (doc.lettering ?? []).find((item) => item.id === glyphId);
      if (!entry || !canReplaceWithLibraryEntry(selected, entry)) return {
        ok: false,
        reason: "يمكن استبدال الجزء فقط عند تطابق الكلمة ورقم موضعه؛ أضف الشكل كعنصر مستقل خلاف ذلك.",
      };
      get().updateLettering(glyphId, {
        pathData: entry.pathData,
        unitsPerEm: entry.unitsPerEm,
        fillRule: entry.fillRule ?? "nonzero",
        ...(entry.joinAnchors ? { joinAnchors: {
          ...(entry.joinAnchors.entry ? { entry: { ...entry.joinAnchors.entry } } : {}),
          ...(entry.joinAnchors.exit ? { exit: { ...entry.joinAnchors.exit } } : {}),
        } } : {}),
        ...(entry.contourRoles ? { contourRoles: { ...entry.contourRoles } } : {}),
        fontGlyphId: undefined,
        alternateFeature: "user-library",
      });
      return { ok: true };
    },
    insertGlyphVariant: (variantId) => {
      const doc = get().doc;
      const entry = (doc.glyphLibrary ?? []).find((item) => item.id === variantId);
      if (!entry) return { ok: false, reason: "لم نعثر على هذا الشكل في المكتبة." };
      const selected = (doc.lettering ?? []).find((item) => item.id === get().selectedLetteringId);
      const shape = makeStandaloneLibraryGlyph(entry,
        selected ? selected.x + 26 : doc.artboard.width / 2,
        selected ? selected.y + 26 : doc.artboard.height / 2,
        selected?.size ?? entry.savedSize,
        selected?.color ?? "#d1a95e");
      if (!shape) return { ok: false, reason: "الشكل المخزن غير صالح للإضافة." };
      get().addLettering(shape);
      return { ok: true };
    },
    importGlyphVariants: (entries) => {
      const doc = get().doc;
      const merged = combineGlyphLibrary(doc.glyphLibrary ?? [], entries);
      if (!merged) return { ok: false, reason: "ملف المكتبة غير صالح أو يتجاوز حد الحجم والعناصر." };
      if (merged.length === (doc.glyphLibrary ?? []).length)
        return { ok: false, reason: "كل الأشكال المستوردة موجودة بالفعل." };
      commit("Import custom glyph library", (previous) => ({ ...previous, glyphLibrary: merged }));
      return { ok: true };
    },
    removeGlyphVariant: (variantId) => {
      if (!(get().doc.glyphLibrary ?? []).some((item) => item.id === variantId)) return;
      commit("Remove custom glyph preset", (doc) => ({
        ...doc, glyphLibrary: (doc.glyphLibrary ?? []).filter((item) => item.id !== variantId),
      }));
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
    updateLetteringMany: (entries, label, preserveMarkPositions) => {
      const patches = new Map(entries.map(({ id, patch }) => [id, patch]));
      if (!patches.size || !(get().doc.lettering ?? []).some(item => patches.has(item.id))) return;
      commit(label, (doc) => {
        const previous = doc.lettering ?? [];
        return { ...doc, lettering: relayoutHarakat(previous, previous.map(item => {
          const patch = patches.get(item.id);
          if (!patch) return item;
          return { ...item, ...patch, id: item.id, kind: item.kind,
            ...(item.kind === "haraka" && (patch.x !== undefined || patch.y !== undefined) && patch.anchorMode === undefined ? { anchorMode: "manual" as const } : {}) };
        }), preserveMarkPositions ? new Set(entries.filter(({patch}) => patch.anchorMode !== undefined && patch.x !== undefined && patch.y !== undefined).map(({id}) => id)) : undefined) };
      });
    },
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
              result.sourceIds.includes(item.attachedToGlyphId)) {
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
    setTool: (tool) => set((s)=>({ tool, glyphLassoActive:false,glyphMultiIds:[],lassoActive:false,nodeLassoTargetId:null,pathNodeSelection:null,knifeTargetId:null, pathControlSelection:tool==="select"?s.pathControlSelection:null })),
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
        (o) => ids.includes(o.id) && !o.locked && o.geometry.kind === "path" && !o.geometry.holes?.length && !o.geometry.cubicSegments?.some(Boolean),
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
        selection: ids, glyphLassoActive:false,glyphMultiIds:[],nodeLassoTargetId:null,pathNodeSelection:null,knifeTargetId:null,pathControlSelection:null, selectedLetteringId: null, selectedGlyphNodeId: null,
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
    clearSelection: () => set({ selection: [],nodeLassoTargetId:null,pathNodeSelection:null,knifeTargetId:null,pathControlSelection:null }),

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
              geometry: scaleGeometry(g, factor, pt(cx, cy)),
            };
          }
          return { ...o, geometry: { ...g, radius: g.radius * factor } };
        }),
      }));
    },

    joinSelectedPaths:(aId,bId,aEnd,bEnd,mode)=>{
      const {selection,doc}=get();
      if(aId===bId||selection.length!==2||!selection.includes(aId)||!selection.includes(bId))return {ok:false,reason:"selection"};
      const a=doc.objects.find(o=>o.id===aId),b=doc.objects.find(o=>o.id===bId);
      if(!a||!b)return {ok:false,reason:"selection"};
      if(!eligibleJoinObject(a)||!eligibleJoinObject(b))return {ok:false,reason:"protected"};
      const geometry=joinOpenPaths(a.geometry,b.geometry,aEnd,bEnd,mode);
      if(!geometry)return {ok:false,reason:"invalid"};
      const made:VectorObject={...a,id:nextObjectId(),name:`${a.name} + ${b.name}`,type:"path",geometry,cellKey:undefined};
      commit("Join open paths",d=>({...d,objects:d.objects.flatMap(o=>o.id===a.id?[made]:o.id===b.id?[]:[o])}));
      set({selection:[made.id],knifeTargetId:null,pathControlSelection:null});
      return {ok:true};
    },

    cutSelectedOpenPath:(edge,t)=>{
      const {selection,doc}=get();
      if(selection.length!==1)return {ok:false,reason:"selection"};
      const source=doc.objects.find(o=>o.id===selection[0]);
      if(!source)return {ok:false,reason:"selection"};
      if(source.locked||!source.visible||source.guide||source.cellKey!==undefined)return {ok:false,reason:"protected"};
      // Splitting an implicitly filled open SVG path changes its filled area.
      if(source.geometry.kind!=="path"||source.geometry.closed||source.style.fill!=="none")return {ok:false,reason:"invalid"};
      const parts=cutOpenPath(source.geometry,edge,t);
      if(!parts)return {ok:false,reason:"invalid"};
      const made=parts.map((geometry,i):VectorObject=>({...source,id:nextObjectId(),name:`${source.name} · ${i+1}`,geometry,type:"path",cellKey:undefined}));
      commit("Cut open path",d=>({...d,objects:d.objects.flatMap(o=>o.id===source.id?made:[o])}));
      set({selection:made.map(o=>o.id),knifeTargetId:null,pathControlSelection:null});
      return {ok:true,count:made.length};
    },

    splitSelectedShape:(axis,fraction,degrees,bend)=>{
      const {selection,doc}=get();
      if(selection.length!==1)return {ok:false,reason:"selection"};
      const source=doc.objects.find(o=>o.id===selection[0]);
      if(!source)return {ok:false,reason:"selection"};
      if(source.locked||!source.visible||source.guide||source.cellKey!==undefined)return {ok:false,reason:"protected"};
      const result=axis==="curve"?splitShapeCurved(source.geometry,degrees??NaN,fraction,bend??NaN):splitShapeAtAngle(source.geometry,axis==="x"?0:axis==="y"?90:degrees??NaN,fraction);
      if(!result.ok)return result;
      const made=result.parts.map((geometry,i):VectorObject=>({...source,id:nextObjectId(),name:`${source.name} · ${i+1}`,type:"path",geometry,cellKey:undefined}));
      commit("Split shape",d=>({...d,objects:d.objects.flatMap(o=>o.id===source.id?made:[o])}));
      set({selection:made.map(o=>o.id),knifeTargetId:null,pathControlSelection:null});
      return {ok:true,count:made.length};
    },

    booleanSelection: (op) => {
      const ids = get().selection;
      const doc = get().doc;
      const sources = doc.objects.filter((o) => ids.includes(o.id));
      if (sources.length < 2) return {ok:false,reason:"selection"};
      if(sources.some(o=>o.locked||!o.visible||o.guide||o.cellKey!==undefined))return {ok:false,reason:"protected"};
      const result=booleanGeometryChecked(sources.map(o=>o.geometry),op);
      if(!result.ok)return result;
      const parts=result.parts;
      const sourceIds=new Set(sources.map(o=>o.id));
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
        return { ...d, objects: [...d.objects.filter((o) => !sourceIds.has(o.id)), ...made] };
      });
      set({ selection: newIds,pathControlSelection:null });
      return {ok:true,count:parts.length};
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
      const retained=trimUndo([...past,{label,state:doc}],next);
      set({
        ...resetHistoryInteraction(),
        doc: next,
        past: retained,
        future: [],
        historyLog: [...historyLog,label].slice(-(retained.length+1)),
        selection: [],
        selectedLetteringId: null,
        selectedGlyphNodeId: null,
        selectedContourIndex: null,
        glyphInspectorTab: "basic",
        controlLinkMode: "free",
        editGlyphNodes: false,
        editGlyphContours: false,
        editJoinAnchors: false,
        joinGuide: null,
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
        ...resetHistoryInteraction(),
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
      const retained=trimUndo([...past,{label:next.label,state:doc}],next.state);
      set({
        ...resetHistoryInteraction(),
        doc: next.state,
        past: retained,
        future: future.slice(1),
        historyLog: [...historyLog,next.label].slice(-(retained.length+1)),
      });
    },

    jumpTo: (index) => {
      const {past,doc,future,historyLog}=get();
      const result=jumpHistory(past,future,doc,index);
      if(!result)return;
      set({...resetHistoryInteraction(),doc:result.state,past:result.past,future:result.future,historyLog:historyLog.slice(0,index+1)});
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
