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
import type { Geometry, Point } from "../../core/geometry/types";
import { resolveSnap, type SnapResult } from "../../core/snapping/snap";
import { constrainPoint } from "../../core/precision/constraints";
import { applyHandle, constrainHandle, handlesOf, pickHandle } from "../../editor/handles";

import { draftReadout, formatAngle, formatLength, measure } from "../../core/precision/measure";
import { buildGridGeometry } from "../../grids";
import { cellAt, compoundCellAt, paintableGrids, type GridCell } from "../../grids/cells";
import { edgeFieldFromImage, snapToEdge, type EdgeField } from "../../core/tracing/edges";
import { cleanStroke } from "../../core/tracing/simplify";
import { geometryToPathData } from "../../objects/render";
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
  const paint = useStudio((s) => s.paint);
  const trace = useStudio((s) => s.trace);
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

  const [draft, setDraft] = useState<Draft | null>(null);
  const [pen, setPen] = useState<Point[] | null>(null);
  const penActiveRef = useRef(false);
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
  const pinchRef = useRef<{
    dist: number;
    mid: { x: number; y: number };
    view: ViewTransform;
  } | null>(null);
  const [size, setSize] = useState({ width: 1200, height: 800 });

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
      if (e.code === "Space") setSpaceDown(true);
      if (e.key === "Shift") setShiftDown(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceDown(false);
      if (e.key === "Shift") setShiftDown(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
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

  const beginPinch = () => {
    const pts = [...pointersRef.current.values()];
    const [a, b] = pts;
    if (!a || !b) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    pinchRef.current = {
      dist: Math.hypot(b.x - a.x, b.y - a.y) || 1,
      mid: { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top },
      view: viewRef.current,
    };
    // Cancel any in-progress single-finger interaction.
    panRef.current = null;
    dragRef.current = null;
    setDragOffset(null);
    setBox(null);
    setHandleDrag(null);
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
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size >= 2) {
      beginPinch();
      return;
    }
    const isPan = spaceDown || e.button === 1 || tool === "pan";
    if (isPan) {
      panRef.current = { x: e.clientX, y: e.clientY };
      return;
    }
    if (e.button !== 0) return;

    const world = toWorld(e.clientX, e.clientY);

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
      // Handle editing takes priority over body dragging.
      if (selection.length === 1) {
        const target = doc.objects.find((o) => o.id === selection[0]);
        const guideBlocked =
          !!target?.guide && (guideLayer.locked || guideLayer.hidden);
        if (target && !target.locked && target.visible && !guideBlocked) {
          const h = pickHandle(target.geometry, world, HANDLE_PIXELS / view.zoom);
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
      const [a, b] = [...pointersRef.current.values()];
      const rect = containerRef.current?.getBoundingClientRect();
      if (!a || !b || !rect) return;
      const start = pinchRef.current;
      const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const mid = { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top };
      const zoom = Math.min(64, Math.max(0.02, start.view.zoom * (d / start.dist)));
      const world = screenToWorld(pt(start.mid.x, start.mid.y), start.view);
      setView({
        ...start.view,
        zoom,
        pan: { x: mid.x - world.x * zoom, y: mid.y - world.y * zoom },
      });
      return;
    }
    if (panRef.current) {
      const dx = e.clientX - panRef.current.x;
      const dy = e.clientY - panRef.current.y;
      panRef.current = { x: e.clientX, y: e.clientY };
      setView(panBy(viewRef.current, dx, dy));
      return;
    }
    const world = toWorld(e.clientX, e.clientY);

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
          geometry: applyHandle(base.geometry, handleDrag.handleId, target),
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
    if (e) pointersRef.current.delete(e.pointerId);
    if (pinchRef.current) {
      if (pointersRef.current.size < 2) pinchRef.current = null;
      return;
    }
    panRef.current = null;
    if (paintStrokeRef.current) {
      const cells = [...paintStrokeRef.current.values()];
      paintStrokeRef.current = null;
      setPaintPreview([]);
      if (cells.length > 0) paintCells(cells, paintEraseRef.current);
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

  // What the freehand stroke will become once released.
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
    tool === "select" && selection.length === 1
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

  const transform = `translate(${view.pan.x} ${view.pan.y}) rotate(${view.rotation}) scale(${view.zoom})`;
  const cursorStyle =
    spaceDown || tool === "pan" ? "grab" : tool === "select" ? "default" : "crosshair";

  return (
    <div
      ref={containerRef}
      dir="ltr"
      className="relative h-full w-full touch-none overflow-hidden overscroll-none bg-background select-none"
      style={{ cursor: cursorStyle }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={(e) => {
        pointersRef.current.delete(e.pointerId);
        if (pointersRef.current.size < 2) pinchRef.current = null;
        panRef.current = null;
        setSnap(null);
        setCursor(null);
        setHoverCell(null);
        // Don't lose a brush stroke when the pointer slips off the canvas.
        if (paintStrokeRef.current) {
          const cells = [...paintStrokeRef.current.values()];
          paintStrokeRef.current = null;
          setPaintPreview([]);
          if (cells.length > 0) paintCells(cells, paintEraseRef.current);
        }
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
      <svg className="h-full w-full" role="img" aria-label="Logo construction canvas">
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
                    handleDrag && handleDrag.objectId === o.id ? handleDrag.geometry : o.geometry,
                  )}

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
              rx={h.role === "center" ? half : 1 / view.zoom}
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
          {/* Snap indicator */}
          {snap && tool !== "select" && <SnapIndicator snap={snap} zoom={view.zoom} />}
        </g>
      </svg>
      {readout && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-md border border-border bg-card/90 px-3 py-1 font-mono text-[11px] text-foreground shadow-sm">
          {readout}
        </div>
      )}
    </div>
  );
}
