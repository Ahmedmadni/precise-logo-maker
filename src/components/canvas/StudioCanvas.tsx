import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fitBounds,
  panBy,
  screenToWorld,
  zoomByWheel,
  type ViewTransform,
} from "../../core/coordinates/view";
import {
  angleOf,
  closestPointOnGeometry,
  dist,
  geometryBounds,
  pt,
  unionBounds,
} from "../../core/geometry/math";
import type { Geometry, Point, VectorObject, PathGeometry } from "../../core/geometry/types";
import { knifeLineParameters, splitShapeAtAngle, angledCutGuide, type SplitResult } from "../../objects/splitShape";
import { resolveSnap, type SnapResult } from "../../core/snapping/snap";
import { constrainPoint } from "../../core/precision/constraints";
import { applyHandle, constrainHandle, handlesOf, pickHandle } from "../../editor/handles";
import {nudgePathNodes} from "../../editor/path-nodes";

import { draftReadout, formatAngle, formatLength, measure } from "../../core/precision/measure";
import { buildGridGeometry } from "../../grids";
import { cellAt, compoundCellAt, paintableGrids, type GridCell } from "../../grids/cells";
import { edgeFieldFromImage, snapToEdge, type EdgeField } from "../../core/tracing/edges";
import { cleanStroke } from "../../core/tracing/simplify";
import { appendBrushSamples, brushPressure, buildBrushStroke, type BrushSample } from "../../core/tracing/vectorBrush";
import { vectorBrushPreviewOutline } from "../../core/tracing/brushPreview";
import { createBrushPreviewScheduler, type BrushPreviewScheduler } from "../../core/tracing/brushPreviewScheduler";
import { geometryToPathData } from "../../objects/render";
import {lassoHits,combineLassoSelection,lassoNodeIndices,combineNodeSelection,type LassoMode} from "../../editor/lassoSelection";
import { createLettering, type LetteringItem } from "../../calligraphy/model";
import {glyphLassoHits,groupMoveIds,translateGlyphSelection} from "../../calligraphy/groupSelection";
import {preciseGlyphBounds} from "../../calligraphy/morph";
import { CATALOG_DRAG_MIME, createCatalogShape } from "../../calligraphy/shapeCatalog";
import { glyphPointToWorld, moveOutlineNodeWithHandles, outlineNodes, worldToGlyphPoint } from "../../calligraphy/pathEditor";
import { moveLinkedCubicControl } from "../../calligraphy/handleCoupling";
import { LetteringGlyph } from "./LetteringGlyph";
import {GlyphGroupTransformControls} from "./GlyphGroupTransformControls";
import { GlyphContourOverlay } from "./GlyphContourOverlay";
import { GlyphJoinOverlay } from "./GlyphJoinOverlay";
import { GlyphJoinDistanceGuide } from "./GlyphJoinDistanceGuide";
import { RibbonEditHandles } from "./RibbonEditHandles";
import { RibbonChainCrossingOverlay } from "./RibbonChainCrossingOverlay";
import { ribbonHandleDragPatch, ribbonHandleGeometry, type RibbonHandleId } from "../../calligraphy/ribbonHandles";
import { moveOutlineContour, positionJoinAnchor, type JoinSide } from "../../calligraphy/contourComposer";
import { CalligraphyGuides } from "./CalligraphyGuides";
import { defaultCalligraphyGuides } from "../../calligraphy/harakaAnchoring";
import { GlyphTransformHandles, glyphTransformHandles } from "./GlyphTransformHandles";
import { touchPair, pinchView, shouldIgnorePalmContact, shouldPrioritizeStylus, type PinchSnapshot } from "./touchGestures";
import { CanvasZoomControls } from "./CanvasZoomControls";
import { GlyphOverlapPicker } from "./GlyphOverlapPicker";
import { chooseOverlappingGlyph, uniqueGlyphStack, visibleBezierNodes, type OverlapTap } from "./glyphSelection";
import { artboardWorldBounds, GUIDE_COLOR, useStudio } from "../../store/studioStore";
import { GridLayer } from "./GridLayer";
import { SnapIndicator } from "./SnapIndicator";

const SNAP_PIXELS = 12;
const HIT_PIXELS = 8;
const HANDLE_PIXELS = 9;
/** Minimum screen-space travel before the pen records another sample. */
const PEN_SAMPLE_PIXELS = 2.5;
/** Default paint for cell polygons traced over grid intersections. */
const CELL_FILL = "#5b8cff";

interface Draft {
  kind: "line" | "circle" | "arc";
  points: Point[];
}

const draftGeometry = (draft: Draft, cursor: Point): Geometry | null => {
  const [p0, p1] = draft.points;
  if (!p0) return null;
  if (draft.kind === "line") return { kind: "line", a: p0, b: cursor };
  if (draft.kind === "circle") return { kind: "circle", center: p0, radius: dist(p0, cursor) };
  if (!p1) return { kind: "circle", center: p0, radius: dist(p0, cursor) };
  return {
    kind: "arc",
    center: p0,
    radius: dist(p0, p1),
    startAngle: angleOf(p0, p1),
    endAngle: angleOf(p0, cursor),
  };
};

export function StudioCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const doc = useStudio((s) => s.doc);
  const view = useStudio((s) => s.view);
  const tool = useStudio((s) => s.tool);
  const snapSettings = useStudio((s) => s.snap);
  const precision = useStudio((s) => s.precision);
  const measurement = useStudio((s) => s.measurement);
  const setMeasurement = useStudio((s) => s.setMeasurement);
  const selection = useStudio((s) => s.selection);
  const pathControlSelection=useStudio(s=>s.pathControlSelection);
  const lassoActive=useStudio(s=>s.lassoActive);
  const lassoEnabled=lassoActive&&tool==="select";
  const glyphLasso=useStudio(s=>s.glyphLassoActive);
  const glyphMultiIds=useStudio(s=>s.glyphMultiIds);
  const glyphMultiDrag=useRef<{source:LetteringItem[];ids:string[];start:Point}|null>(null);
  const [glyphMultiPreview,setGlyphMultiPreview]=useState<{source:LetteringItem[];next:LetteringItem[]}|null>(null);
  const nodeLassoId=useStudio(s=>s.nodeLassoTargetId);
  const nodeSelection=useStudio(s=>s.pathNodeSelection);
  const nodeTarget=lassoEnabled&&nodeLassoId&&selection.length===1&&selection[0]===nodeLassoId?doc.objects.find(o=>o.id===nodeLassoId&&!o.locked&&o.visible&&!o.guide&&o.geometry.kind==="path"&&!o.geometry.holes?.length):undefined;
  const nodePath=nodeTarget?.geometry.kind==="path"?nodeTarget.geometry:null;
  const selectedAnchors=nodeSelection&&nodeSelection.objectId===nodeTarget?.id&&nodeSelection.geometry===nodePath?nodeSelection.indices:[];
  const groupDrag=useRef<{id:string;source:PathGeometry;indices:number[];start:Point}|null>(null);
  const [groupPreview,setGroupPreview]=useState<{id:string;source:PathGeometry;next:PathGeometry}|null>(null);
  const [lassoMode,setLassoMode]=useState<LassoMode>("replace");
  const [lassoTrail,setLassoTrail]=useState<Point[]>([]);
  const [lassoNotice,setLassoNotice]=useState("");
  const lassoDrag=useRef<{points:Point[];mode:LassoMode}|null>(null);
  useEffect(()=>{lassoDrag.current=null;groupDrag.current=null;glyphMultiDrag.current=null;setGlyphMultiPreview(null);setGroupPreview(null);setLassoTrail([]);setLassoNotice("");},[lassoEnabled,nodeLassoId,glyphLasso]);
  const knifeTargetId=useStudio(s=>s.knifeTargetId);
  const knifeTarget=tool==="select"&&selection.length===1&&selection[0]===knifeTargetId&&!doc.objects.find(o=>o.id===knifeTargetId)?.guide
    ?doc.objects.find(o=>o.id===knifeTargetId&&o.visible&&!o.locked&&o.cellKey===undefined&&(o.geometry.kind==="circle"||(o.geometry.kind==="path"&&o.geometry.closed))):undefined;
  const [knifeLine,setKnifeLine]=useState<{source:VectorObject;start:Point;end:Point}|null>(null);
  const knifeDrag=useRef<{source:VectorObject;start:Point}|null>(null);
  const [knifeProposal,setKnifeProposal]=useState<{source:VectorObject;degrees:number;fraction:number;result:SplitResult}|null>(null);
  const [knifeNotice,setKnifeNotice]=useState("");
  useEffect(()=>{knifeDrag.current=null;setKnifeLine(null);setKnifeProposal(null);setKnifeNotice("");},[knifeTarget]);
  const paint = useStudio((s) => s.paint);
  const trace = useStudio((s) => s.trace);
  const brush = useStudio((s) => s.brush);
  const paintCells = useStudio((s) => s.paintCells);
  const showGrids = useStudio((s) => s.showGrids);
  const guideLayer = useStudio((s) => s.guideLayer);
  const setView = useStudio((s) => s.setView);
  const setCursor = useStudio((s) => s.setCursor);
  const addObject = useStudio((s) => s.addObject);
  const setSelection = useStudio((s) => s.setSelection);
  const translateSelection = useStudio((s) => s.translateSelection);
  const toggleSelection = useStudio((s) => s.toggleSelection);
  const setGeometry = useStudio((s) => s.setGeometry);
  const addLettering = useStudio((s) => s.addLettering);
  const selectLettering = useStudio((s) => s.selectLettering);
  const selectedLetteringId = useStudio((s) => s.selectedLetteringId);
  const moveLettering = useStudio((s) => s.moveLettering);
  const updateLettering = useStudio((s) => s.updateLettering);
  const editGlyphNodes = useStudio((s) => s.editGlyphNodes);
  const moveGlyphNodeHandles = useStudio((s) => s.moveGlyphNodeHandles);
  const controlLinkMode = useStudio((s) => s.controlLinkMode);
  const letteringMoveScope = useStudio((s) => s.letteringMoveScope);
  const setSelectedGlyphNodeId = useStudio((s) => s.setSelectedGlyphNodeId);
  const selectedGlyphNodeId = useStudio((s) => s.selectedGlyphNodeId);
  const showAllGlyphNodes = useStudio((s) => s.showAllGlyphNodes);
  const letteringPreview = useStudio((s) => s.letteringPreview);
  const setLetteringPreview = useStudio((s) => s.setLetteringPreview);
  const commitLetteringPreview = useStudio((s) => s.commitLetteringPreview);
  const editGlyphContours = useStudio((s) => s.editGlyphContours);
  const selectedContourIndex = useStudio((s) => s.selectedContourIndex);
  const setSelectedContourIndex = useStudio((s) => s.setSelectedContourIndex);
  const editJoinAnchors = useStudio((s) => s.editJoinAnchors);
  const joinGuide = useStudio((s) => s.joinGuide);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [pen, setPen] = useState<Point[] | null>(null);
  const penActiveRef = useRef(false);
  const [brushTrail, setBrushTrail] = useState<BrushSample[]>([]);
  const brushTrailRef = useRef<BrushSample[] | null>(null);
  // The full-resolution trace remains in brushTrailRef; only the SVG preview
  // state publishes once per display frame, even on 120/240 Hz pens.
  const brushPreviewSchedulerRef = useRef<BrushPreviewScheduler | null>(null);
  useEffect(() => {
    const scheduler = createBrushPreviewScheduler((samples) => setBrushTrail(samples));
    brushPreviewSchedulerRef.current = scheduler;
    return () => {
      scheduler.dispose();
      brushPreviewSchedulerRef.current = null;
    };
  }, []);
  const [cellChain, setCellChain] = useState<Point[]>([]);
  const [hoverCell, setHoverCell] = useState<GridCell | null>(null);
  const [paintPreview, setPaintPreview] = useState<GridCell[]>([]);
  const paintStrokeRef = useRef<Map<string, GridCell> | null>(null);
  const paintEraseRef = useRef(false);
  const [hoverWorld, setHoverWorld] = useState<Point | null>(null);
  const [snap, setSnap] = useState<SnapResult | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);
  const [shiftDown, setShiftDown] = useState(false);
  const [measureStart, setMeasureStart] = useState<Point | null>(null);
  const dragRef = useRef<{ start: Point; last: Point } | null>(null);
  const letterDragRef = useRef<{ id: string; start: Point; scope: "glyph" | "word"; groupId?: string } | null>(null);
  const [letterOffset, setLetterOffset] = useState<Point | null>(null);
  const nodeDragRef = useRef<{ id: string; nodeId: number; startPath: string } | null>(null);
  const contourDragRef = useRef<{
    id: string; index: number; path: string; localStart: Point;
  } | null>(null);
  const joinDragRef = useRef<{ id: string; side: JoinSide } | null>(null);
  const ribbonDragRef = useRef<{
    id: string;
    handle: RibbonHandleId;
    original: NonNullable<LetteringItem["ribbon"]>;
    geometry: NonNullable<ReturnType<typeof ribbonHandleGeometry>>;
  } | null>(null);
  const scaleDragRef = useRef<{
    id: string; start: Point; axis: "scaleX" | "scaleY" | "rotation"; side: number;
    value: number; dimension: number; rotation: number; pivot: Point;
  } | null>(null);
  const [nodePreview, setNodePreview] = useState<{ id: string; path: string } | null>(null);
  const [dragOffset, setDragOffset] = useState<Point | null>(null);
  const [box, setBox] = useState<{ start: Point; end: Point } | null>(null);
  const [handleDrag, setHandleDrag] = useState<{
    objectId: string;
    handleId: string;
    geometry: Geometry;
  } | null>(null);

  const panRef = useRef<{ x: number; y: number } | null>(null);
  // Multi-touch (Android/tablet): two fingers pinch-zoom and pan together.
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<PinchSnapshot | null>(null);
  const activePointerRef = useRef<number | null>(null);
  const activePointerTypeRef = useRef<string | null>(null);
  // After a two-finger gesture, the remaining finger must not resume a stroke.
  const suppressSinglePointerRef = useRef(false);
  const [size, setSize] = useState({ width: 1200, height: 800 });
  const overlapTapRef = useRef<OverlapTap | null>(null);
  const [overlapIds, setOverlapIds] = useState<string[]>([]);

  const cycleOverlap = () => {
    const index = overlapIds.indexOf(useStudio.getState().selectedLetteringId ?? "");
    const nextIndex = (index + 1) % overlapIds.length;
    const id = overlapIds[nextIndex];
    if (!id) return;
    selectLettering(id);
    const previous = overlapTapRef.current;
    if (previous) overlapTapRef.current = { ...previous, index: nextIndex, time: performance.now() };
  };

  /** Grid the cell brush paints on: the explicit choice, else the first paintable one. */
  const paintGrid = useMemo(() => {
    const candidates = paintableGrids(doc.grids);
    const chosen = paint.gridId ? candidates.find((g) => g.id === paint.gridId) : undefined;
    return chosen ?? candidates.find((g) => g.visible) ?? candidates[0] ?? null;
  }, [doc.grids, paint.gridId]);

  /** Every visible grid taking part when pieces are cut by all grids at once. */
  const combinedGrids = useMemo(
    () => paintableGrids(doc.grids).filter((g) => g.visible),
    [doc.grids],
  );

  const cellUnder = useCallback(
    (world: Point): GridCell | null => {
      if (paint.combine && combinedGrids.length > 0)
        return compoundCellAt(combinedGrids, world, { sectors: paint.sectors });
      return paintGrid ? cellAt(paintGrid, world, { sectors: paint.sectors }) : null;
    },
    [paint.combine, combinedGrids, paintGrid, paint.sectors],
  );

  // Edge map of the reference picture, rebuilt only when the picture or its
  // placement changes. It is what makes freehand strokes follow the artwork.
  const reference = doc.reference;
  const [edgeField, setEdgeField] = useState<EdgeField | null>(null);
  useEffect(() => {
    if (!reference || !reference.visible) {
      setEdgeField(null);
      return;
    }
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      setEdgeField(
        edgeFieldFromImage(image, {
          x: reference.x,
          y: reference.y,
          width: reference.width,
          height: reference.height,
        }),
      );
    };
    image.onerror = () => {
      if (!cancelled) setEdgeField(null);
    };
    image.src = reference.src;
    return () => {
      cancelled = true;
    };
  }, [reference]);

  /**
   * Pull a freehand sample onto the nearest picture edge, when asked to. The
   * previous sample biases the search so the stroke keeps following one edge.
   */
  const magnetise = useCallback(
    (p: Point, previous: Point | null = null): Point => {
      if (!edgeField || !trace.magnetic) return p;
      return (
        snapToEdge(edgeField, p, {
          radius: trace.magnetRadius,
          threshold: trace.edgeThreshold,
          bias: previous,
        }) ?? p
      );
    },
    [edgeField, trace.magnetic, trace.magnetRadius, trace.edgeThreshold],
  );

  const gridData = useMemo(() => {
    const points: Point[] = [];
    const geometry: Geometry[] = [];
    if (!showGrids) return { points, geometry };
    for (const g of doc.grids) {
      if (!g.visible || g.locked) continue;
      const built = buildGridGeometry(g);
      points.push(...built.points);
      geometry.push(...built.major);
    }
    return { points, geometry };
  }, [doc.grids, showGrids]);

  const objectGeometry = useMemo(
    () => doc.objects.filter((o) => o.visible).map((o) => o.geometry),
    [doc.objects],
  );

  // Track container size for fit operations.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const next = { width: el.clientWidth, height: el.clientHeight };
      setSize(next);
      useStudio.getState().setViewport(next);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fit to the artboard once we know the viewport size, and keep re-fitting on
  // resize (orientation change / drawer toggle) until the user moves the view.
  const autoFitView = useRef<typeof view | null>(null);
  useEffect(() => {
    if (size.width < 50 || size.height < 50) return;
    const current = useStudio.getState().view;
    if (autoFitView.current && autoFitView.current !== current) return;
    const next = fitBounds(artboardWorldBounds(doc.artboard), size.width, size.height);
    autoFitView.current = next;
    setView(next);
  }, [size, doc.artboard, setView]);

  const toWorld = useCallback(
    (clientX: number, clientY: number): Point => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return pt(0, 0);
      return screenToWorld(pt(clientX - rect.left, clientY - rect.top), view);
    },
    [view],
  );

  // Non-passive wheel listener (React's onWheel is passive → preventDefault is ignored).
  const viewRef = useRef(view);
  viewRef.current = view;
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if(e.target instanceof Element&&e.target.closest("[data-canvas-ui]"))return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      setView(
        zoomByWheel(
          viewRef.current,
          pt(e.clientX - rect.left, e.clientY - rect.top),
          e.deltaY,
          e.deltaMode,
        ),
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [setView]);

  // Space held = temporary pan.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if(e.target instanceof HTMLElement&&(e.target.isContentEditable||["INPUT","TEXTAREA","SELECT","BUTTON"].includes(e.target.tagName)))return;
      if (e.code === "Space") setSpaceDown(true);
      if (e.key === "Shift") setShiftDown(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceDown(false);
      if (e.key === "Shift") setShiftDown(false);
    };
    const reset=()=>{setSpaceDown(false);setShiftDown(false);};
    window.addEventListener("blur",reset);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("blur",reset);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const resolveCursor = useCallback(
    (world: Point): { point: Point; snap: SnapResult | null } => {
      const result = resolveSnap({
        cursor: world,
        tolerance: SNAP_PIXELS / view.zoom,
        gridPoints: gridData.points,
        gridGeometry: gridData.geometry,
        objectGeometry,
        settings: snapSettings,
      });
      return { point: result ? result.point : world, snap: result };
    },
    [gridData, objectGeometry, snapSettings, view.zoom],
  );

  const applyPrecision = useCallback(
    (anchor: Point | null, point: Point, shift: boolean): Point =>
      anchor ? constrainPoint(anchor, point, precision, shift) : point,
    [precision],
  );

  const hitTest = useCallback(
    (world: Point): string | null => {
      const tol = HIT_PIXELS / view.zoom;
      let best: { id: string; d: number } | null = null;
      for (const o of doc.objects) {
        if (!o.visible || o.locked) continue;
        if (o.guide && (guideLayer.locked || guideLayer.hidden)) continue;
        // Guide editing mode grabs guides only, so artwork can't shift by accident.
        if (guideLayer.edit && !o.guide) continue;
        const d = dist(closestPointOnGeometry(o.geometry, world), world);
        if (d <= tol && (!best || d < best.d)) best = { id: o.id, d };
      }
      return best?.id ?? null;
    },
    [doc.objects, view.zoom, guideLayer],
  );

  const cancelActiveInteraction = () => {
    panRef.current = null;
    dragRef.current = null;
    letterDragRef.current = null;
    nodeDragRef.current = null;
    contourDragRef.current = null;
    joinDragRef.current = null;
    ribbonDragRef.current = null;
    scaleDragRef.current = null;
    useStudio.setState({ letteringPreview: null });
    setNodePreview(null);
    setLetterOffset(null);
    setDragOffset(null);
    setBox(null);
    lassoDrag.current=null;groupDrag.current=null;glyphMultiDrag.current=null;setGlyphMultiPreview(null);setGroupPreview(null);setLassoTrail([]);setLassoNotice("");
    setHandleDrag(null);
    knifeDrag.current=null;setKnifeLine(null);setKnifeProposal(null);setKnifeNotice("");
    penActiveRef.current = false;
    setPen(null);
    brushTrailRef.current = null;
    brushPreviewSchedulerRef.current?.clear();
    setBrushTrail([]);
    paintStrokeRef.current = null;
    setPaintPreview([]);
    setSnap(null);
  };

  const beginPinch = () => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pair = touchPair(pointersRef.current, { x: rect.left, y: rect.top });
    if (!pair) return;
    pinchRef.current = { ...pair, view: viewRef.current };
    suppressSinglePointerRef.current = true;
    activePointerRef.current = null;
    activePointerTypeRef.current = null;
    // Cancel rather than commit a pen stroke, brush stroke or glyph edit.
    cancelActiveInteraction();
  };

  /** Turn a traced chain of grid intersections into a real path object. */
  const commitCells = (points: Point[], closed: boolean) => {
    if (points.length >= 2) {
      const id = addObject(
        { kind: "path", points, closed },
        closed ? "Create Cell" : "Create Chain",
        closed ? { fill: CELL_FILL, fillOpacity: 0.35 } : undefined,
      );
      setSelection([id]);
    }
    setCellChain([]);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if(e.button!==0&&e.button!==1)return;
    // Palm touches may arrive *before* the pen on Android tablets.
    // Preserve stylus priority, cancelling an unfinished touch gesture only.
    if (shouldPrioritizeStylus(
      activePointerTypeRef.current, e.pointerType,
      pinchRef.current !== null, pointersRef.current.size,
    )) {
      cancelActiveInteraction();
      pointersRef.current.clear();
      pinchRef.current = null;
      suppressSinglePointerRef.current = false;
      activePointerRef.current = null;
      activePointerTypeRef.current = null;
    }
    // Reject incidental palm contact while the stylus is down.
    // A genuine two-finger touch gesture still works without an active pen.
    if (shouldIgnorePalmContact(activePointerTypeRef.current, e.pointerType)) return;
    // Capture on the stable canvas, not an SVG glyph that can unmount while editing.
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size >= 2) {
      if (!pinchRef.current) beginPinch();
      return;
    }
    if (suppressSinglePointerRef.current) return;
    activePointerRef.current = e.pointerId;
    activePointerTypeRef.current = e.pointerType;
    const isPan = spaceDown || e.button === 1 || tool === "pan";
    if (isPan) {
      panRef.current = { x: e.clientX, y: e.clientY };
      return;
    }
    if (e.button !== 0) return;

    const world = toWorld(e.clientX, e.clientY);

    if(lassoEnabled){
      if(guideLayer.edit){setLassoNotice("اخرج من تحرير الأدلة أولًا.");return;}
      if(glyphLasso&&!e.shiftKey&&!e.altKey&&lassoMode==="replace"){
        const source=doc.lettering;
        const id=(e.target as Element).closest("[data-lettering-id]")?.getAttribute("data-lettering-id");
        if(source&&id&&glyphMultiIds.includes(id)){
          const check=groupMoveIds(source,glyphMultiIds);
          if(!check.ok){setLassoNotice(check.reason==="bridge"?"حدد طرفي الوصلة معًا قبل التحريك.":"أعد تحديد الحروف.");return;}
          glyphMultiDrag.current={source,ids:[...glyphMultiIds],start:world};
          setGlyphMultiPreview({source,next:source});return;
        }
      }
      if(nodeLassoId&&!nodePath){setLassoNotice("حدد مسارًا صالحًا لتحرير النقاط.");return;}
      if(nodeTarget&&nodePath&&!e.shiftKey&&!e.altKey&&selectedAnchors.some(i=>nodePath.points[i]&&dist(nodePath.points[i]!,world)*view.zoom<=10)){
        groupDrag.current={id:nodeTarget.id,source:nodePath,indices:[...selectedAnchors],start:world};
        setGroupPreview({id:nodeTarget.id,source:nodePath,next:nodePath});return;
      }
      lassoDrag.current={points:[world],mode:e.shiftKey?"add":e.altKey?"subtract":lassoMode};
      setLassoTrail([world]);setLassoNotice("");
      return;
    }
    if(knifeTarget&&!guideLayer.edit){
      knifeDrag.current={source:knifeTarget,start:world};
      setKnifeLine({source:knifeTarget,start:world,end:world});setKnifeProposal(null);setKnifeNotice("");
      return;
    }

    // A real pressure-sensitive, closed SVG brush stroke (not the grid-cell brush).
    if (tool === "brush") {
      const first: BrushSample = { ...world, pressure: brushPressure(e.pressure, e.pointerType) };
      brushPreviewSchedulerRef.current?.clear();
      brushTrailRef.current = [first];
      setBrushTrail([first]);
      return;
    }

    // Cell brush: press and drag to fill every cell the cursor crosses.
    if (tool === "cell") {
      const erase = paint.eraser || e.altKey;
      paintEraseRef.current = erase;
      const stroke = new Map<string, GridCell>();
      const hit = cellUnder(world);
      if (hit) stroke.set(hit.key, hit);
      paintStrokeRef.current = stroke;
      setPaintPreview([...stroke.values()]);
      return;
    }

    const { point: snapped } = resolveCursor(world);
    const anchor = draft?.points[draft.points.length - 1] ?? measureStart ?? null;
    const point = applyPrecision(anchor, snapped, e.shiftKey);

    if (tool === "lettering") {
      addLettering(createLettering(point.x, point.y));
      return;
    }

    if (tool === "measure") {
      if (!measureStart) {
        setMeasureStart(point);
        setMeasurement(null);
      } else {
        setMeasurement(measure(measureStart, point));
        setMeasureStart(null);
      }
      return;
    }

    if (tool === "pen") {
      penActiveRef.current = true;
      setPen([magnetise(world)]);
      return;
    }

    if (tool === "polygon") {
      const first = cellChain[0];
      const tol = HIT_PIXELS / view.zoom;
      if (first && cellChain.length >= 3 && dist(point, first) <= tol) {
        commitCells(cellChain, true);
        return;
      }
      const last = cellChain[cellChain.length - 1];
      if (last && dist(last, point) < 1e-6) return;
      setCellChain([...cellChain, point]);
      return;
    }

    if (tool === "select") {
      const target = e.target as Element;
      const hitRibbonHandle = target.closest("[data-ribbon-handle]");
      const selectedBridge = doc.lettering?.find((item) => item.id === selectedLetteringId && item.kind === "bridge");
      const handleId = hitRibbonHandle?.getAttribute("data-ribbon-handle");
      if (selectedBridge?.ribbon && (handleId === "start" || handleId === "end" || handleId === "bend" || handleId === "start-width" || handleId === "end-width")) {
        const geometry = ribbonHandleGeometry(selectedBridge, doc.lettering ?? []);
        if (geometry) {
          ribbonDragRef.current = {
            id: selectedBridge.id, handle: handleId, original: { ...selectedBridge.ribbon }, geometry,
          };
          setOverlapIds([]);
          return;
        }
      }
      const outline = doc.lettering?.find((item) => item.id === selectedLetteringId);
      const clickedContour = editGlyphContours ? target.closest("[data-contour-index]") : null;
      const rawContourIndex = clickedContour?.getAttribute("data-contour-index");
      const contourIndex = rawContourIndex === null || rawContourIndex === undefined ? NaN : Number(rawContourIndex);
      if (outline?.kind === "outline" && outline.pathData && Number.isInteger(contourIndex)) {
        const localStart = worldToGlyphPoint(outline, world.x, world.y);
        if (localStart) {
          setSelectedContourIndex(contourIndex);
          contourDragRef.current = { id: outline.id, index: contourIndex,
            path: outline.pathData, localStart };
          setNodePreview({ id: outline.id, path: outline.pathData });
          return;
        }
      }
      const clickedJoin = editJoinAnchors ? target.closest("[data-join-side]") : null;
      const side = clickedJoin?.getAttribute("data-join-side");
      if (outline?.kind === "outline" && (side === "entry" || side === "exit")) {
        joinDragRef.current = { id: outline.id, side };
        return;
      }
      const resizeNode = !editGlyphNodes && !editGlyphContours && !editJoinAnchors
        ? target.closest("[data-glyph-handle]") : null;
      const edge = resizeNode?.getAttribute("data-glyph-handle");
      const glyph = doc.lettering?.find((item) => item.id === selectedLetteringId);
      if (glyph?.kind === "outline" && edge && glyph.pathData) {
        const marker = glyphTransformHandles(glyph).find((h) => h.edge === edge);
        const points = outlineNodes(glyph.pathData);
        if (marker && points.length) {
          const vals = points.map((p) => marker.axis === "scaleX" ? p.x : p.y);
          const width = Math.max(...vals) - Math.min(...vals);
          const currentScale = marker.axis === "scaleX" ? glyph.scaleX ?? 1 : glyph.scaleY ?? 1;
          const dimension = Math.max(1, width * glyph.size / (glyph.unitsPerEm || 1000) * Math.abs(currentScale));
          scaleDragRef.current = { id: glyph.id, start: world, axis: marker.axis,
            side: marker.side, value: marker.axis === "rotation" ? glyph.rotation : currentScale,
            dimension, rotation: glyph.rotation, pivot: { x: glyph.x, y: glyph.y } };
          return;
        }
      }
      const handle = editGlyphNodes ? (e.target as Element).closest("[data-outline-node]") : null;
      const editItem = doc.lettering?.find((item) => item.id === selectedLetteringId);
      const rawIndex = handle?.getAttribute("data-outline-node");
      const nodeId = rawIndex === null || rawIndex === undefined ? NaN : Number(rawIndex);
      if (editItem?.kind === "outline" && editItem.pathData && Number.isInteger(nodeId)) {
        setSelectedGlyphNodeId(nodeId);
        nodeDragRef.current = { id: editItem.id, nodeId, startPath: editItem.pathData };
        setNodePreview({ id: editItem.id, path: editItem.pathData });
        return;
      }
      const validIds = new Set((doc.lettering ?? []).map((item) => item.id));
      const stack = uniqueGlyphStack(
        document.elementsFromPoint(e.clientX, e.clientY)
          .map((element) => element.closest("[data-lettering-id]")?.getAttribute("data-lettering-id") ?? ""),
        validIds,
      );
      // Repeated taps cycle through true hit-tested SVG glyphs, from top to bottom.
      const tapped = chooseOverlappingGlyph(stack, { x: e.clientX, y: e.clientY },
        performance.now(), overlapTapRef.current);
      overlapTapRef.current = tapped;
      setOverlapIds(stack.length > 1 ? stack : []);
      const letteringId = tapped?.ids[tapped.index] ??
        target.closest("[data-lettering-id]")?.getAttribute("data-lettering-id");
      if (letteringId && validIds.has(letteringId)) {
        selectLettering(letteringId);
        const letter = doc.lettering?.find((item) => item.id === letteringId);
        // Live joining ribbons are edited through their endpoints and
        // inspector, never translated independently of attached glyphs.
        if (letter?.kind !== "bridge") {
          letterDragRef.current = { id: letteringId, start: world, scope: letteringMoveScope,
            ...(letter?.groupId ? { groupId: letter.groupId } : {}) };
          setLetterOffset(pt(0, 0));
        }
        return;
      }
      // Handle editing takes priority over body dragging.
      if (selection.length === 1) {
        const target = doc.objects.find((o) => o.id === selection[0]);
        const guideBlocked =
          !!target?.guide && (guideLayer.locked || guideLayer.hidden);
        if (target && !target.locked && target.visible && !guideBlocked) {
          const edge=pathControlSelection?.objectId===target.id?pathControlSelection.edge:undefined;
          const h = pickHandle(target.geometry, world, HANDLE_PIXELS / view.zoom,edge);
          if (h) {
            setHandleDrag({
              objectId: target.id,
              handleId: h.id,
              geometry: target.geometry,
            });
            return;
          }
        }
      }
      const hit = hitTest(world);

      if (hit) {
        if (e.shiftKey) toggleSelection(hit);
        else if (!selection.includes(hit)) setSelection([hit]);
        dragRef.current = { start: world, last: world };
        setDragOffset(pt(0, 0));
        return;
      }
      if (!e.shiftKey) setSelection([]);
      setBox({ start: world, end: world });
      return;
    }

    if (tool === "line" || tool === "circle" || tool === "arc") {
      const current = draft ?? { kind: tool, points: [] };
      const points = [...current.points, point];
      const needed = tool === "arc" ? 3 : 2;
      if (points.length >= needed) {
        const geom = draftGeometry({ kind: tool, points }, points[points.length - 1] ?? point);
        if (geom) {
          const id = addObject(
            geom,
            tool === "line" ? "Create Line" : tool === "circle" ? "Create Circle" : "Create Arc",
          );
          setSelection([id]);
        }
        setDraft(null);
      } else {
        setDraft({ kind: tool, points });
      }
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    if (pinchRef.current && pointersRef.current.size >= 2) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const pair = touchPair(pointersRef.current, { x: rect.left, y: rect.top });
      if (pair) setView(pinchView(pinchRef.current, pair));
      return;
    }
    if (suppressSinglePointerRef.current) return;
    if (activePointerRef.current !== null && e.pointerId !== activePointerRef.current) return;
    if (panRef.current) {
      const dx = e.clientX - panRef.current.x;
      const dy = e.clientY - panRef.current.y;
      panRef.current = { x: e.clientX, y: e.clientY };
      setView(panBy(viewRef.current, dx, dy));
      return;
    }
    const world = toWorld(e.clientX, e.clientY);
    if(glyphMultiDrag.current){
      const drag=glyphMultiDrag.current;
      if(doc.lettering===drag.source){
        const next=translateGlyphSelection(drag.source,drag.ids,world.x-drag.start.x,world.y-drag.start.y);
        setGlyphMultiPreview({source:drag.source,next:next??drag.source});
      }
      return;
    }
    if(groupDrag.current){
      const drag=groupDrag.current;
      if(nodePath===drag.source)setGroupPreview({id:drag.id,source:drag.source,next:nudgePathNodes(drag.source,drag.indices,world.x-drag.start.x,world.y-drag.start.y)});
      return;
    }
    if(lassoDrag.current){
      const drag=lassoDrag.current;
      if(dist(drag.points.at(-1)!,world)*view.zoom>=3){
        if(drag.points.length>=511)drag.points=drag.points.filter((_,i)=>i%2===0||i===drag.points.length-1);
        drag.points.push(world);setLassoTrail([...drag.points]);
      }
      return;
    }
    if(lassoEnabled)return;
    if(knifeDrag.current){
      const drag=knifeDrag.current;
      setKnifeLine({...drag,end:world});
      return;
    }
    if(knifeTarget&&!guideLayer.edit)return;
    if (contourDragRef.current) {
      const dragging = contourDragRef.current;
      const item = (doc.lettering ?? []).find((entry) => entry.id === dragging.id);
      if (item) {
        const current = worldToGlyphPoint(item, world.x, world.y);
        if (current) {
          const path = moveOutlineContour(dragging.path, dragging.index,
            current.x - dragging.localStart.x, current.y - dragging.localStart.y);
          if (path) setNodePreview({ id: item.id, path });
        }
      }
      return;
    }
    if (ribbonDragRef.current) {
      const dragging = ribbonDragRef.current;
      const patch = ribbonHandleDragPatch(dragging.original, dragging.geometry, dragging.handle, world);
      if (patch) setLetteringPreview(dragging.id, { ribbon: { ...dragging.original, ...patch } });
      return;
    }
    if (joinDragRef.current) {
      const dragging = joinDragRef.current;
      const item = (doc.lettering ?? []).find((entry) => entry.id === dragging.id);
      if (item) {
        const local = positionJoinAnchor(item, world.x, world.y);
        if (local) setLetteringPreview(dragging.id, {
          joinAnchors: { ...item.joinAnchors, [dragging.side]: local },
        });
      }
      return;
    }
    if (scaleDragRef.current) {
      const dragging = scaleDragRef.current;
      const dx = world.x - dragging.start.x;
      const dy = world.y - dragging.start.y;
      if (dragging.axis === "rotation") {
        const a0 = Math.atan2(dragging.start.y - dragging.pivot.y, dragging.start.x - dragging.pivot.x);
        const a1 = Math.atan2(world.y - dragging.pivot.y, world.x - dragging.pivot.x);
        const delta = Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0)) * 180 / Math.PI;
        setLetteringPreview(dragging.id, { rotation: Math.max(-180, Math.min(180, dragging.value + delta)) });
      } else {
        const theta = dragging.rotation * Math.PI / 180;
        const displacement = dragging.axis === "scaleX"
          ? dx * Math.cos(theta) + dy * Math.sin(theta)
          : -dx * Math.sin(theta) + dy * Math.cos(theta);
        const factor = 1 + dragging.side * displacement / dragging.dimension;
        setLetteringPreview(dragging.id, { [dragging.axis]: Math.max(0.35, Math.min(4, dragging.value * factor)) });
      }
      return;
    }
    if (nodeDragRef.current) {
      const item = (doc.lettering ?? []).find((entry) => entry.id === nodeDragRef.current?.id);
      if (item) {
        const point = worldToGlyphPoint(item, world.x, world.y);
        if (point) {
          const drag = nodeDragRef.current;
          const path = controlLinkMode !== "free"
            ? moveLinkedCubicControl(drag.startPath, drag.nodeId, point.x, point.y, controlLinkMode)
              ?? moveOutlineNodeWithHandles(drag.startPath, drag.nodeId, point.x, point.y, moveGlyphNodeHandles)
            : moveOutlineNodeWithHandles(drag.startPath, drag.nodeId, point.x, point.y, moveGlyphNodeHandles);
          if (path) setNodePreview({ id: item.id, path });
        }
      }
      return;
    }
    if (letterDragRef.current) {
      setLetterOffset(pt(world.x - letterDragRef.current.start.x, world.y - letterDragRef.current.start.y));
      return;
    }

    if (brushTrailRef.current) {
      // Some WebViews omit the actual current pointer location from the
      // coalesced batch. Append the dispatched event after the history.
      const events = [...(e.nativeEvent.getCoalescedEvents?.() ?? []), e.nativeEvent];
      const incoming = events.map((event): BrushSample => ({
        ...toWorld(event.clientX, event.clientY),
        pressure: brushPressure(event.pressure, e.pointerType),
      }));
      const trail = appendBrushSamples(brushTrailRef.current, incoming, view.zoom);
      brushTrailRef.current = trail;
      brushPreviewSchedulerRef.current?.enqueue(trail);
      return;
    }

    // The cell brush works off raw grid arithmetic — no snapping pass needed.
    if (tool === "cell") {
      setSnap(null);
      setHoverWorld(world);
      setCursor(world);
      const hit = cellUnder(world);
      setHoverCell(hit);
      const stroke = paintStrokeRef.current;
      if (stroke && hit && !stroke.has(hit.key)) {
        stroke.set(hit.key, hit);
        setPaintPreview([...stroke.values()]);
      }
      return;
    }

    const { point: snapped, snap: s } = resolveCursor(world);
    const anchor = draft?.points[draft.points.length - 1] ?? measureStart ?? null;
    const point = applyPrecision(anchor, snapped, e.shiftKey);
    const raw = tool === "select" || tool === "pen";
    setSnap(tool === "pen" ? null : s);
    setHoverWorld(raw ? world : point);
    setCursor(raw ? world : point);
    if (penActiveRef.current) {
      setPen((prev) => {
        const list = prev ?? [];
        const last = list[list.length - 1];
        if (last && dist(last, world) < PEN_SAMPLE_PIXELS / view.zoom) return list;
        return [...list, magnetise(world, last ?? null)];
      });
      return;
    }
    if (handleDrag) {
      const base = doc.objects.find((o) => o.id === handleDrag.objectId);
      if (base) {
        // Handles ride the smart-snap result; Shift (or a permanent angle lock)
        // additionally pins the angle / radius to the precision steps.
        const locked = e.shiftKey || precision.angleLock;
        const target = locked
          ? constrainHandle(base.geometry, handleDrag.handleId, snapped, {
              angleStep: precision.angleStep,
              lengthStep: precision.lengthStep,
            })
          : snapped;
        setHandleDrag({
          ...handleDrag,
          geometry: applyHandle(base.geometry, handleDrag.handleId, target,pathControlSelection?.objectId===base.id?pathControlSelection.mode:"free"),
        });
      }
      return;
    }
    if (dragRef.current) {
      setDragOffset(pt(point.x - dragRef.current.start.x, point.y - dragRef.current.start.y));
      return;
    }
    if (box) setBox({ ...box, end: world });
  };

  const onPointerUp = (e?: React.PointerEvent<HTMLDivElement>) => {
    if (e) {
      // Ignored palm contacts and stale pointer releases must not finish a stroke.
      if(!pointersRef.current.has(e.pointerId))return;
      pointersRef.current.delete(e.pointerId);
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    }
    if (pinchRef.current || suppressSinglePointerRef.current) {
      if (pointersRef.current.size < 2) pinchRef.current = null;
      if (pointersRef.current.size === 0) {
        activePointerRef.current = null;
        activePointerTypeRef.current = null;
        suppressSinglePointerRef.current = false;
      }
      return;
    }
    if (e && activePointerRef.current !== null && e.pointerId !== activePointerRef.current) return;
    activePointerRef.current = null;
    activePointerTypeRef.current = null;
    panRef.current = null;
    if(glyphMultiDrag.current){
      const drag=glyphMultiDrag.current;glyphMultiDrag.current=null;setGlyphMultiPreview(null);
      if(!e)return;
      const end=toWorld(e.clientX,e.clientY);
      if(dist(end,drag.start)*view.zoom<1)return;
      const ok=useStudio.getState().moveGlyphMulti(drag.source,drag.ids,end.x-drag.start.x,end.y-drag.start.y);
      setLassoNotice(ok?"تم تحريك الحروف وتشكيلاتها.":"تغير التحديد أو توجد وصلة خارج المجموعة.");
      return;
    }
    if(groupDrag.current){
      const drag=groupDrag.current;groupDrag.current=null;setGroupPreview(null);
      if(!e)return;
      const end=toWorld(e.clientX,e.clientY);
      if(dist(end,drag.start)*view.zoom<1)return;
      const ok=useStudio.getState().moveSelectedPathNodes(drag.id,drag.source,drag.indices,end.x-drag.start.x,end.y-drag.start.y);
      setLassoNotice(ok?"تم تحريك النقاط المحددة.":"تغير المسار؛ أعد التحديد.");
      return;
    }
    if(lassoDrag.current){
      const drag=lassoDrag.current;lassoDrag.current=null;setLassoTrail([]);
      const state=useStudio.getState();
      if(!e||!state.lassoActive||state.tool!=="select"||state.guideLayer.edit)return;
      const end=toWorld(e.clientX,e.clientY);
      const points=dist(drag.points.at(-1)!,end)*view.zoom>=1?[...drag.points,end]:drag.points;
      if(points.length<3){setLassoNotice("ارسم مساحة مغلقة حول العناصر.");return;}
      const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
      if((Math.max(...xs)-Math.min(...xs))*view.zoom<6||(Math.max(...ys)-Math.min(...ys))*view.zoom<6){setLassoNotice("مساحة التحديد صغيرة جدًا.");return;}
      if(state.glyphLassoActive){
        const items=state.doc.lettering??[];
        const before=state.glyphMultiIds.filter(id=>items.some(i=>i.id===id&&!i.hidden&&i.kind==="outline"));
        const ids=combineLassoSelection(before,glyphLassoHits(items,points),drag.mode);
        state.setGlyphMultiIds(ids);setLassoNotice(`تم تحديد ${ids.length} حرف متجهي. اختر «جديد» للسحب.`);
        return;
      }
      if(state.nodeLassoTargetId){
        const target=state.doc.objects.find(o=>o.id===state.nodeLassoTargetId);
        if(!target||target.locked||!target.visible||target.guide||target.geometry.kind!=="path"||target.geometry.holes?.length||state.selection.length!==1||state.selection[0]!==target.id)return;
        const current=state.pathNodeSelection;
        const before=current?.objectId===target.id&&current.geometry===target.geometry?current.indices:[];
        const indices=combineNodeSelection(before,lassoNodeIndices(target.geometry.points,points),drag.mode);
        state.setPathNodeSelection({objectId:target.id,geometry:target.geometry,indices});
        setLassoNotice(`تم تحديد ${indices.length} نقطة؛ اسحب إحداها لتحريك المجموعة.`);
        return;
      }
      const hits=lassoHits(state.doc.objects,points);
      const next=combineLassoSelection(state.selection,hits,drag.mode);
      setSelection(next);setLassoNotice(`تم تحديد ${next.length} عنصر`);
      return;
    }
    if(knifeDrag.current){
      const drag=knifeDrag.current;knifeDrag.current=null;
      if(!e||knifeTarget!==drag.source||guideLayer.edit){setKnifeLine(null);return;}
      const end=toWorld(e.clientX,e.clientY);
      if(dist(drag.start,end)*view.zoom<8){setKnifeLine(null);setKnifeNotice("اسحب خطًا أطول عبر الشكل.");return;}
      const params=knifeLineParameters(drag.source.geometry,drag.start,end);
      if(!params){setKnifeLine(null);setKnifeNotice("خط القص خارج حدود الشكل.");return;}
      const result=splitShapeAtAngle(drag.source.geometry,params.degrees,params.fraction);
      setKnifeLine(null);
      setKnifeProposal({source:drag.source,...params,result});
      setKnifeNotice(result.ok?"":result.reason==="empty"?"لا توجد مساحة على جانبي القص.":"تعذر تقسيم الشكل بأمان.");
      return;
    }
    if (contourDragRef.current) {
      const { id, path: original } = contourDragRef.current;
      contourDragRef.current = null;
      const changed = nodePreview?.id === id && nodePreview.path !== original ? nodePreview.path : null;
      setNodePreview(null);
      if (changed) updateLettering(id, { pathData: changed });
      return;
    }
    if (ribbonDragRef.current) {
      ribbonDragRef.current = null;
      commitLetteringPreview();
      return;
    }
    if (joinDragRef.current) {
      joinDragRef.current = null;
      commitLetteringPreview();
      return;
    }
    if (scaleDragRef.current) {
      scaleDragRef.current = null;
      commitLetteringPreview();
      return;
    }
    if (nodeDragRef.current) {
      const id = nodeDragRef.current.id;
      const original = nodeDragRef.current.startPath;
      nodeDragRef.current = null;
      const changed = nodePreview?.id === id && nodePreview.path !== original ? nodePreview.path : null;
      setNodePreview(null);
      if (changed) updateLettering(id, { pathData: changed });
      return;
    }
    if (letterDragRef.current) {
      const { id, scope, groupId } = letterDragRef.current;
      letterDragRef.current = null;
      const offset = letterOffset;
      setLetterOffset(null);
      if (offset && Math.hypot(offset.x, offset.y) * view.zoom > 7) {
        // A drag is not a repeat tap on the same stack.
        overlapTapRef.current = null;
      }
      if (offset) {
        if (scope === "word" && groupId) useStudio.getState().moveLetteringGroup(groupId, offset.x, offset.y);
        else moveLettering(id, offset.x, offset.y);
      }
      return;
    }
    if (paintStrokeRef.current) {
      const cells = [...paintStrokeRef.current.values()];
      paintStrokeRef.current = null;
      setPaintPreview([]);
      if (cells.length > 0) paintCells(cells, paintEraseRef.current);
      return;
    }
    if (brushTrailRef.current) {
      // A fast stroke may not emit a move event for its final few pixels.
      // Pointer-up often reports zero pressure, so retain the last *actual*
      // stylus pressure while capturing the physical release position.
      const recorded = brushTrailRef.current;
      const finalSample = e ? {
        ...toWorld(e.clientX, e.clientY),
        pressure: recorded.at(-1)?.pressure ?? brushPressure(e.pressure, e.pointerType),
      } : null;
      const points = finalSample
        ? appendBrushSamples(recorded, [finalSample], view.zoom, true)
        : recorded;
      brushTrailRef.current = null;
      // A queued preview must never paint over the finished saved vector.
      brushPreviewSchedulerRef.current?.clear();
      setBrushTrail([]);
      // Geometry uses the full final trace, not the last preview frame.
      const shape = buildBrushStroke(points, brush);
      if (shape) {
        const id = addObject(shape, "Calligraphy brush stroke",
          { fill: brush.color, stroke: "none", strokeWidth: 0 });
        setSelection([id]);
      }
      return;
    }
    if (penActiveRef.current) {
      penActiveRef.current = false;
      const stroke = pen ?? [];
      if (stroke.length >= 2) {
        // Straighten the wobble out of the stroke and promote it to a line or
        // arc when that is what the hand was aiming for.
        const cleaned = trace.smoothing
          ? cleanStroke(stroke, {
              tolerance: trace.tolerance,
              smoothing: trace.passes,
              fitShapes: trace.fitShapes,
              cornerAngle: trace.cornerAngle,
            })
          : null;
        const geometry = cleaned ?? { kind: "path" as const, points: stroke, closed: false };
        const id = addObject(
          geometry,
          geometry.kind === "path" ? "Freehand stroke" : `Freehand ${geometry.kind}`,
        );
        setSelection([id]);
      }
      setPen(null);
      return;
    }
    if (handleDrag) {
      const base = doc.objects.find((o) => o.id === handleDrag.objectId);
      if (base && base.geometry !== handleDrag.geometry) {
        setGeometry(handleDrag.objectId, handleDrag.geometry, "Edit handle");
      }
      setHandleDrag(null);
      return;
    }
    if (dragRef.current) {
      const offset = dragOffset;
      dragRef.current = null;
      setDragOffset(null);
      if (offset && (Math.abs(offset.x) > 1e-6 || Math.abs(offset.y) > 1e-6)) {
        translateSelection(offset.x, offset.y);
      }
      return;
    }
    if (box) {
      const minX = Math.min(box.start.x, box.end.x);
      const maxX = Math.max(box.start.x, box.end.x);
      const minY = Math.min(box.start.y, box.end.y);
      const maxY = Math.max(box.start.y, box.end.y);
      if (Math.abs(maxX - minX) > 2 || Math.abs(maxY - minY) > 2) {
        const ids = doc.objects
          .filter((o) => {
            if (!o.visible || o.locked) return false;
            if (o.guide && (guideLayer.locked || guideLayer.hidden)) return false;
            if (guideLayer.edit && !o.guide) return false;
            const b = geometryBounds(o.geometry);
            return b.minX >= minX && b.maxX <= maxX && b.minY >= minY && b.maxY <= maxY;
          })
          .map((o) => o.id);
        setSelection(ids);
      }
      setBox(null);
    }
  };

  const onPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.delete(e.pointerId);
    activePointerRef.current = null;
    activePointerTypeRef.current = null;
    pinchRef.current = null;
    cancelActiveInteraction();
    suppressSinglePointerRef.current = pointersRef.current.size > 0;
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  // What the freehand stroke will become once released.
  const brushPreview = useMemo(
    () => vectorBrushPreviewOutline(brushTrail, brush, view.zoom),
    [brushTrail, brush, view.zoom],
  );
  const brushPreviewPath = useMemo(
    () => brushPreview ? geometryToPathData(brushPreview) : null,
    [brushPreview],
  );
  const penPreview = useMemo(
    () =>
      pen && pen.length >= 2 && trace.smoothing
        ? cleanStroke(pen, {
            tolerance: trace.tolerance,
            smoothing: trace.passes,
            fitShapes: trace.fitShapes,
            cornerAngle: trace.cornerAngle,
          })
        : null,
    [pen, trace.smoothing, trace.tolerance, trace.fitShapes, trace.passes, trace.cornerAngle],
  );

  const preview = draft && hoverWorld ? draftGeometry(draft, hoverWorld) : null;
  const liveMeasure = measureStart && hoverWorld ? measure(measureStart, hoverWorld) : measurement;
  const measureLine = liveMeasure ? { a: liveMeasure.a, b: liveMeasure.b } : null;
  const unit = doc.artboard.unit;
  const readout = !precision.showReadout
    ? null
    : tool === "measure" && liveMeasure
      ? `${formatLength(liveMeasure.length, unit)} · ${formatAngle(liveMeasure.angle)} · dx ${formatLength(liveMeasure.dx, unit)} dy ${formatLength(liveMeasure.dy, unit)}`
      : preview
        ? `${draftReadout(preview, unit)}${shiftDown || precision.angleLock ? ` · locked ${precision.angleStep}°` : ""}`
        : null;
  const editTarget =
    tool === "select" && !knifeTarget && !lassoEnabled && selection.length === 1
      ? doc.objects.find(
          (o) =>
            o.id === selection[0] &&
            o.visible &&
            !o.locked &&
            !(o.guide && (guideLayer.locked || guideLayer.hidden)),
        )
      : undefined;
  const editHandles = editTarget
    ? handlesOf(
        handleDrag && handleDrag.objectId === editTarget.id
          ? handleDrag.geometry
          : editTarget.geometry,
        pathControlSelection?.objectId===editTarget.id?pathControlSelection.edge:undefined,
      )
    : [];
  const selectionBounds =
    selection.length > 0
      ? unionBounds(
          doc.objects
            .filter((o) => selection.includes(o.id))
            .map((o) => geometryBounds(o.geometry)),
        )
      : null;

  // Resolve a temporary set of glyphs for live link-following previews during
  // touches, keyboard adjustments, and Bézier editing. This is never saved.
  const sourceLettering = glyphMultiPreview&&glyphMultiPreview.source===doc.lettering ? glyphMultiPreview.next : doc.lettering ?? [];
  const draggingGlyph = sourceLettering.find((item) => item.id === letterDragRef.current?.id);
  const wordDrag = letterDragRef.current?.scope === "word" && !!draggingGlyph?.groupId;
  const renderedLettering = sourceLettering.map((item) => {
    const previewed = letteringPreview?.id === item.id
      ? { ...item, ...letteringPreview.patch } : item;
    const owner = item.kind === "haraka" && item.attachedToGlyphId
      ? sourceLettering.find((glyph) => glyph.id === item.attachedToGlyphId) : undefined;
    const moving = item.id === letterDragRef.current?.id ||
      (wordDrag && item.groupId === draggingGlyph?.groupId) ||
      (owner && (owner.id === letterDragRef.current?.id ||
        (wordDrag && owner.groupId === draggingGlyph?.groupId)));
    return letterOffset && moving
      ? { ...previewed, x: previewed.x + letterOffset.x, y: previewed.y + letterOffset.y }
      : { ...previewed, ...(nodePreview?.id === item.id ? { pathData: nodePreview.path } : {}) };
  });

  const transform = `translate(${view.pan.x} ${view.pan.y}) rotate(${view.rotation}) scale(${view.zoom})`;
  const cursorStyle =
    spaceDown || tool === "pan" ? "grab" : knifeTarget || lassoEnabled ? "crosshair" : tool === "select" ? "default" : "crosshair";

  return (
    <div
      ref={containerRef}
      dir="ltr"
      className="relative h-full w-full overflow-hidden overscroll-none bg-background select-none"
      style={{ cursor: cursorStyle }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onLostPointerCapture={onPointerCancel}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes(CATALOG_DRAG_MIME)) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.types.includes(CATALOG_DRAG_MIME)) return;
        event.preventDefault();
        const id = event.dataTransfer.getData(CATALOG_DRAG_MIME);
        const droppedAt = toWorld(event.clientX, event.clientY);
        const selected = (doc.lettering ?? []).find((item) => item.id === selectedLetteringId);
        const color = selected?.color && /^#[0-9a-fA-F]{6}$/.test(selected.color)
          ? selected.color : "#d1a95e";
        const added = createCatalogShape(id, droppedAt.x, droppedAt.y, color);
        if (added) addLettering(added);
      }}
      onPointerLeave={(e) => {
        // A captured pointer may leave the canvas while dragging. Keep its
        // gesture active until pointerup or pointercancel, not pointerleave.
        if (pointersRef.current.has(e.pointerId)) return;
        setSnap(null);
        setCursor(null);
        setHoverCell(null);
      }}
      onDoubleClick={() => {
        setDraft(null);
        setMeasureStart(null);
        if (cellChain.length >= 2) commitCells(cellChain, cellChain.length >= 3);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        setDraft(null);
        setMeasureStart(null);
        if (cellChain.length >= 2) commitCells(cellChain, cellChain.length >= 3);
        else setCellChain([]);
      }}
    >
      <svg className="h-full w-full touch-none" role="img" aria-label="Logo construction canvas">
        <g transform={transform}>
          {/* Artboard */}
          <rect
            x={0}
            y={0}
            width={doc.artboard.width}
            height={doc.artboard.height}
            fill={doc.artboard.background}
            stroke="var(--color-border)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          {/* Reference picture: sits under the grids, tracing aid only */}
          {doc.reference?.visible && (
            <image
              href={doc.reference.src}
              x={doc.reference.x}
              y={doc.reference.y}
              width={doc.reference.width}
              height={doc.reference.height}
              opacity={doc.reference.opacity}
              preserveAspectRatio="none"
              pointerEvents="none"
            />
          )}
          {/* Grids: primary first, then secondary */}
          {showGrids &&
            doc.grids
              .filter((g) => g.weight === "primary")
              .map((g) => <GridLayer key={g.id} grid={g} />)}
          {showGrids &&
            doc.grids
              .filter((g) => g.weight === "secondary")
              .map((g) => <GridLayer key={g.id} grid={g} />)}
          {/* Calligraphy baselines stay in the editor, never in exported SVG. */}
          <CalligraphyGuides settings={doc.calligraphyGuides ?? defaultCalligraphyGuides(doc.artboard.height)} width={doc.artboard.width} />
          {/* Shapes */}
          <g>
            {doc.objects.map((o) =>
              o.visible &&
              (!o.guide || (!guideLayer.hidden && (showGrids || guideLayer.edit))) ? (
                <path
                  key={o.id}
                  transform={
                    dragOffset && selection.includes(o.id) && !o.locked
                      ? `translate(${dragOffset.x} ${dragOffset.y})`
                      : undefined
                  }
                  d={geometryToPathData(
                    groupPreview?.id===o.id&&groupPreview.source===o.geometry?groupPreview.next:handleDrag && handleDrag.objectId === o.id ? handleDrag.geometry : o.geometry,
                  )}

                  fillRule={o.geometry.kind==="path"&&o.geometry.holes?.length?"evenodd":"nonzero"}
                  fill={o.guide ? "none" : o.style.fill}
                  fillOpacity={o.style.fillOpacity ?? 1}
                  opacity={o.guide ? 0.6 : (o.style.opacity ?? 1)}
                  stroke={selection.includes(o.id) ? "var(--color-primary)" : o.style.stroke}
                  strokeWidth={o.style.strokeWidth}
                  strokeDasharray={
                    o.guide
                      ? "5 4"
                      : o.style.dash && o.style.dash > 0
                        ? `${o.style.dash} ${o.style.dash}`
                        : undefined
                  }
                  strokeLinecap={o.style.cap ?? "round"}
                  strokeLinejoin={o.style.join ?? "round"}
                  vectorEffect="non-scaling-stroke"
                />
              ) : null,
            )}
          </g>
          {/* Editable Arabic lettering and independently movable vector diacritics */}
          <g>
            {[...sourceLettering.filter((item) => item.kind === "bridge" && !item.hidden),
              ...sourceLettering.filter((item) => item.kind !== "bridge" && !item.hidden)].map((item) => {
              const draggedId = letterDragRef.current?.id;
              const dragging = draggedId ? doc.lettering?.find((glyph) => glyph.id === draggedId) : undefined;
              const isWordDragged = letterDragRef.current?.scope === "word" && !!dragging?.groupId;
              const linkedToDragged = item.kind === "haraka" && item.attachedToGlyphId &&
                (item.attachedToGlyphId === draggedId ||
                 (isWordDragged && !!doc.lettering?.find((glyph) =>
                   glyph.id === item.attachedToGlyphId && glyph.groupId === dragging.groupId)));
              const moved = item.id === selectedLetteringId ||
                (isWordDragged && item.groupId === dragging?.groupId) || linkedToDragged;
              return <LetteringGlyph key={item.id}
                item={letteringPreview?.id === item.id ? { ...item, ...letteringPreview.patch } : item}
                allItems={renderedLettering}
                selected={item.id === selectedLetteringId||(glyphLasso&&glyphMultiIds.includes(item.id))}
                offset={letterOffset && moved ? letterOffset : null}
                overridePath={nodePreview?.id === item.id ? nodePreview.path : null} />;
            })}
          </g>
          {/* Live ribbon controls: direct touch editing only while selected. Not exported. */}
          {tool === "select" && (doc.lettering ?? [])
            .filter((item) => item.id === selectedLetteringId && item.kind === "bridge" && !item.hidden)
            .map((item) => <g key={item.id}>
              <RibbonEditHandles
                item={letteringPreview?.id === item.id ? { ...item, ...letteringPreview.patch } : item}
                glyphs={renderedLettering} zoom={view.zoom} />
              <RibbonChainCrossingOverlay ribbonId={item.id}
                items={renderedLettering} zoom={view.zoom} />
            </g>)}
          {/* Live join measurement and target anchors are editor-only overlays. */}
          {editJoinAnchors && joinGuide && selectedLetteringId === joinGuide.sourceId && (() => {
            const items = doc.lettering ?? [];
            const lookup = (id: string) => {
              const item = items.find((g) => g.id === id);
              return item && letteringPreview?.id === item.id
                ? { ...item, ...letteringPreview.patch } : item;
            };
            const source = lookup(joinGuide.sourceId);
            const target = lookup(joinGuide.targetId);
            return source && target ? <GlyphJoinDistanceGuide
              source={source} target={target} sides={joinGuide} zoom={view.zoom} /> : null;
          })()}
          {/* Named editable contours and join anchors are not part of exported SVG. */}
          {editGlyphContours && tool === "select" && (doc.lettering ?? [])
            .filter((item) => item.id === selectedLetteringId && item.kind === "outline")
            .map((item) => <GlyphContourOverlay key={`contours-${item.id}`}
              item={item} index={selectedContourIndex} zoom={view.zoom}
              overridePath={nodePreview?.id === item.id ? nodePreview.path : undefined} />)}
          {editJoinAnchors && tool === "select" && (doc.lettering ?? [])
            .filter((item) => item.id === selectedLetteringId && item.kind === "outline")
            .map((item) => <GlyphJoinOverlay key={`join-${item.id}`}
              item={letteringPreview?.id === item.id ? { ...item, ...letteringPreview.patch } : item}
              zoom={view.zoom} />)}
          {/* Touch-accessible stretch and rotation handles; not exported. */}
          {!editGlyphNodes && !editGlyphContours && !editJoinAnchors && tool === "select" && (doc.lettering ?? [])
            .filter((item) => item.id === selectedLetteringId && item.kind === "outline")
            .map((item) => <GlyphTransformHandles key={`resize-${item.id}`}
              item={letteringPreview?.id === item.id ? { ...item, ...letteringPreview.patch } : item}
              zoom={view.zoom} />)}
          {/* Editable font-outline anchor and Bézier handles. Kept out of SVG exports. */}
          {editGlyphNodes && tool === "select" && (doc.lettering ?? []).filter((item) => item.id === selectedLetteringId && item.kind === "outline").map((item) =>
            <g key={`handles-${item.id}`}>
              {visibleBezierNodes(outlineNodes(nodePreview?.id === item.id ? nodePreview.path : item.pathData ?? "").slice(0, 350),
                selectedGlyphNodeId, item, view.zoom, showAllGlyphNodes).map((n) => {
                const worldPoint = glyphPointToWorld(item, n.x, n.y);
                return <g key={n.id} data-outline-node={n.id}
                  className="cursor-crosshair" aria-label={n.role === "anchor" ? "نقطة تثبيت الحرف" : "مقبض منحنى Bézier"}>
                  <circle cx={worldPoint.x} cy={worldPoint.y}
                    r={18 / view.zoom} fill="transparent" stroke="none" pointerEvents="all" />
                  <circle cx={worldPoint.x} cy={worldPoint.y}
                    r={(n.id === selectedGlyphNodeId ? 8 : 6) / view.zoom}
                    fill={n.role === "anchor" ? "var(--color-primary)" : "#45c5d5"}
                    stroke="#171717" strokeWidth={1.5 / view.zoom} pointerEvents="none" />
                </g>;
              })}
            </g>
          )}
          {/* Draft preview */}
          {preview && (
            <path
              d={geometryToPathData(preview)}
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth={1.5}
              strokeDasharray="6 4"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {/* Freehand pen stroke in progress: raw trail plus the cleaned result */}
          {pen && pen.length > 1 && (
            <path
              d={geometryToPathData({ kind: "path", points: pen, closed: false })}
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth={penPreview ? 1 : 2}
              strokeOpacity={penPreview ? 0.4 : 1}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {penPreview && (
            <path
              d={geometryToPathData(penPreview)}
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {/* The live stroke uses the exact vector outline committed on release. */}
          {brushPreviewPath && (
            <path
              d={brushPreviewPath}
              fill={brush.color}
              opacity={0.85}
              stroke="none"
              pointerEvents="none"
            />
          )}
          {/* Cell brush: hovered cell + cells collected in the current stroke */}
          {tool === "cell" && (
            <g pointerEvents="none">
              {paintPreview.map((c) => (
                <path
                  key={c.key}
                  d={geometryToPathData({ kind: "path", points: c.points, closed: true })}
                  fill={paintEraseRef.current ? "var(--color-destructive)" : paint.color}
                  fillOpacity={paintEraseRef.current ? 0.25 : paint.opacity * 0.75}
                  stroke={paintEraseRef.current ? "var(--color-destructive)" : paint.color}
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {hoverCell && !paintStrokeRef.current && (
                <path
                  d={geometryToPathData({ kind: "path", points: hoverCell.points, closed: true })}
                  fill={paint.eraser ? "none" : paint.color}
                  fillOpacity={paint.opacity * 0.35}
                  stroke={paint.eraser ? "var(--color-destructive)" : "var(--color-primary)"}
                  strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </g>
          )}
          {/* Cell chain in progress */}
          {cellChain.length > 0 && (
            <g>
              <path
                d={geometryToPathData({
                  kind: "path",
                  points: hoverWorld && tool === "polygon" ? [...cellChain, hoverWorld] : cellChain,
                  closed: false,
                })}
                fill={CELL_FILL}
                fillOpacity={0.18}
                stroke="var(--color-primary)"
                strokeWidth={1.5}
                strokeDasharray="5 3"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
              {cellChain.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={3.5 / view.zoom} fill="var(--color-primary)" />
              ))}
            </g>
          )}
          {/* Edit handles for a single selected object */}
          {editHandles.filter(h=>h.role==="control"&&h.anchor).map(h=><line key={"link-"+h.id} x1={h.anchor!.x} y1={h.anchor!.y} x2={h.point.x} y2={h.point.y} stroke="var(--color-primary)" strokeDasharray="4 3" strokeOpacity=".7" vectorEffect="non-scaling-stroke" pointerEvents="none"/>)}
          {editHandles.map((h) => {
            // Guide handles are drawn larger (touch-friendly) and in guide blue.
            const guideHandle = !!editTarget?.guide;
            const half = (guideHandle ? 5.5 : 4) / view.zoom;
            const accent = guideHandle ? GUIDE_COLOR : "var(--color-primary)";
            return (
            <rect
              key={h.id}
              x={h.point.x - half}
              y={h.point.y - half}
              width={half * 2}
              height={half * 2}
              rx={h.role === "center" || h.role==="control" ? half : 1 / view.zoom}
              fill={handleDrag?.handleId === h.id ? accent : "var(--color-background)"}
              stroke={accent}
              strokeWidth={1.25}
              vectorEffect="non-scaling-stroke"
            >
              <title>{h.label}</title>
            </rect>
            );
          })}
          {/* Selection bounds */}

          {selectionBounds && Number.isFinite(selectionBounds.minX) && (
            <rect
              x={selectionBounds.minX}
              y={selectionBounds.minY}
              width={selectionBounds.maxX - selectionBounds.minX}
              height={selectionBounds.maxY - selectionBounds.minY}
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth={1}
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {glyphLasso&&<g pointerEvents="none">{sourceLettering.filter(i=>i.kind==="outline"&&!i.hidden&&glyphMultiIds.includes(i.id)).map(i=>{const b=preciseGlyphBounds(i);return b?<rect key={i.id} x={b.x} y={b.y} width={b.width} height={b.height} fill="none" stroke="var(--color-primary)" strokeDasharray="4 3" strokeWidth="1" vectorEffect="non-scaling-stroke"/>:null;})}</g>}
          {nodeTarget&&nodePath&&<g pointerEvents="none">
            {(groupPreview?.id===nodeTarget.id&&groupPreview.source===nodePath?groupPreview.next:nodePath).points.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r={(selectedAnchors.includes(i)?5:3)/view.zoom} fill={selectedAnchors.includes(i)?"var(--color-primary)":"var(--color-background)"} stroke="var(--color-primary)" strokeWidth="1.2" vectorEffect="non-scaling-stroke"/>)}
          </g>}
          {lassoEnabled&&lassoTrail.length>1&&<polygon points={lassoTrail.map(p=>`${p.x},${p.y}`).join(" ")} fill="var(--color-primary)" fillOpacity=".1" fillRule="evenodd" stroke="var(--color-primary)" strokeDasharray="5 3" strokeWidth="1.5" vectorEffect="non-scaling-stroke" pointerEvents="none"/>}
          {/* Box selection */}
          {box && (
            <rect
              x={Math.min(box.start.x, box.end.x)}
              y={Math.min(box.start.y, box.end.y)}
              width={Math.abs(box.end.x - box.start.x)}
              height={Math.abs(box.end.y - box.start.y)}
              fill="var(--color-primary)"
              fillOpacity={0.08}
              stroke="var(--color-primary)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          )}
          {/* Measurement */}
          {measureLine && (
            <g>
              <line
                x1={measureLine.a.x}
                y1={measureLine.a.y}
                x2={measureLine.b.x}
                y2={measureLine.b.y}
                stroke="var(--color-accent-foreground)"
                strokeWidth={1}
                strokeDasharray="5 3"
                vectorEffect="non-scaling-stroke"
              />
              {[measureLine.a, measureLine.b].map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={3 / view.zoom}
                  fill="var(--color-accent-foreground)"
                />
              ))}
            </g>
          )}
          {knifeTarget&&knifeProposal?.source===knifeTarget&&knifeProposal.result.ok&&<g pointerEvents="none">
            {knifeProposal.result.parts.map((g,i)=><path key={i} d={geometryToPathData(g)} fill={i<(knifeProposal.result.ok?knifeProposal.result.firstCount:0)?"#0ea5e9":"#f59e0b"} fillOpacity=".35" fillRule="evenodd" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke"/>)}
          </g>}
          {knifeTarget&&knifeLine?.source===knifeTarget&&<line x1={knifeLine.start.x} y1={knifeLine.start.y} x2={knifeLine.end.x} y2={knifeLine.end.y} stroke="#ef4444" strokeWidth="2" strokeDasharray="5 3" vectorEffect="non-scaling-stroke" pointerEvents="none"/>}
          {knifeTarget&&knifeProposal?.source===knifeTarget&&(()=>{const g=angledCutGuide(knifeTarget.geometry,knifeProposal.degrees,knifeProposal.fraction);return g?<line x1={g.start.x} y1={g.start.y} x2={g.end.x} y2={g.end.y} stroke="#ef4444" strokeWidth="2" strokeDasharray="5 3" vectorEffect="non-scaling-stroke" pointerEvents="none"/>:null;})()}
          {/* Snap indicator */}
          {snap && tool !== "select" && <SnapIndicator snap={snap} zoom={view.zoom} />}
        </g>
      </svg>
      <CanvasZoomControls />
      {lassoEnabled&&<div data-canvas-ui dir="rtl" className="absolute left-1/2 top-3 z-20 w-max max-w-[min(92%,24rem)] max-h-[calc(100%-1.5rem)] -translate-x-1/2 overflow-y-auto overscroll-contain touch-pan-y rounded-xl border border-border bg-card p-2 shadow-md" onPointerDown={e=>e.stopPropagation()} onPointerMove={e=>e.stopPropagation()} onPointerUp={e=>e.stopPropagation()} onPointerCancel={e=>e.stopPropagation()} onDoubleClick={e=>e.stopPropagation()}>
        <p className="px-1 py-1 text-xs">{guideLayer.edit?"اخرج من تحرير الأدلة أولًا.":lassoNotice||(glyphLasso?"حدد مراكز الحروف ثم اسحب حرفًا محددًا.":nodeLassoId?"حدد النقاط بالرسم حولها، ثم اسحب نقطة محددة.":"التحديد الحر: ارسم حول الأشكال")}</p>
        <div className="flex flex-wrap gap-1">
          {([{id:"replace",label:"جديد"},{id:"add",label:"إضافة"},{id:"subtract",label:"استبعاد"}] as const).map(m=><button key={m.id} type="button" aria-pressed={lassoMode===m.id} className={`min-h-10 rounded border px-2 text-xs ${lassoMode===m.id?"border-primary bg-primary/10":"border-border"}`} onClick={()=>{setLassoMode(m.id);setLassoNotice("");}}>{m.label}</button>)}
          <button type="button" className="min-h-10 rounded border border-border px-2 text-xs" onClick={()=>{const s=useStudio.getState();if(glyphLasso)s.setGlyphLassoActive(false);else if(nodeLassoId)s.setNodeLassoTarget(null);else s.setLassoActive(false);}}>إنهاء</button>
        </div>
        {glyphLasso&&<GlyphGroupTransformControls/>}
      </div>}
      {knifeTarget&&<div data-canvas-ui dir="rtl" className="absolute left-1/2 top-3 z-20 w-max max-w-[90%] -translate-x-1/2 rounded-xl border border-border bg-card p-2 shadow-md" onPointerDown={e=>e.stopPropagation()} onPointerMove={e=>e.stopPropagation()} onPointerUp={e=>e.stopPropagation()}>
        <p className="px-2 py-1 text-xs">{guideLayer.edit?"اخرج من تحرير الأدلة أولًا.":knifeNotice|| (knifeProposal?.source===knifeTarget&&knifeProposal.result.ok?`معاينة: ${knifeProposal.result.parts.length} أجزاء`:"أداة السكين: اسحب خط القص عبر الشكل")}</p>
        <div className="flex gap-1">
          {knifeProposal?.source===knifeTarget&&knifeProposal.result.ok&&!guideLayer.edit&&<button type="button" className="min-h-11 flex-1 rounded bg-primary px-3 text-xs text-primary-foreground" onClick={()=>{const s=useStudio.getState();if(s.knifeTargetId!==knifeTarget.id||s.selection.length!==1||s.selection[0]!==knifeTarget.id||s.doc.objects.find(o=>o.id===knifeTarget.id)!==knifeTarget){setKnifeProposal(null);setKnifeNotice("تغير الشكل؛ أعد القص.");return;}const r=s.splitSelectedShape("angle",knifeProposal.fraction,knifeProposal.degrees);setKnifeProposal(null);if(!r.ok)setKnifeNotice("تعذر اعتماد القص.");}}>اعتماد القص</button>}
          <button type="button" className="min-h-11 flex-1 rounded border border-border px-3 text-xs" onClick={()=>{knifeDrag.current=null;setKnifeLine(null);setKnifeProposal(null);useStudio.getState().setKnifeTargetId(null);}}>إلغاء</button>
        </div>
      </div>}
      {tool === "select" && !lassoEnabled && !knifeTarget && overlapIds.length > 1 && !editGlyphNodes && !editGlyphContours && !editJoinAnchors && (
        <GlyphOverlapPicker
          items={overlapIds.map((id) => (doc.lettering ?? []).find((item) => item.id === id)).filter(
            (item): item is NonNullable<typeof item> => !!item)}
          currentId={selectedLetteringId}
          onNext={cycleOverlap}
          onDismiss={() => { setOverlapIds([]); overlapTapRef.current = null; }}
        />
      )}
      {readout && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-md border border-border bg-card/90 px-3 py-1 font-mono text-[11px] text-foreground shadow-sm">
          {readout}
        </div>
      )}
    </div>
  );
}
