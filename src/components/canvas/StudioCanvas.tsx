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
import { applyHandle, handlesOf, pickHandle } from "../../editor/handles";

import { draftReadout, formatAngle, formatLength, measure } from "../../core/precision/measure";
import { buildGridGeometry } from "../../grids";
import { geometryToPathData } from "../../objects/render";
import { artboardWorldBounds, useStudio } from "../../store/studioStore";
import { GridLayer } from "./GridLayer";
import { SnapIndicator } from "./SnapIndicator";

const SNAP_PIXELS = 12;
const HIT_PIXELS = 8;

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
  const setView = useStudio((s) => s.setView);
  const setCursor = useStudio((s) => s.setCursor);
  const addObject = useStudio((s) => s.addObject);
  const setSelection = useStudio((s) => s.setSelection);
  const translateSelection = useStudio((s) => s.translateSelection);
  const toggleSelection = useStudio((s) => s.toggleSelection);
  const setGeometry = useStudio((s) => s.setGeometry);


  const [draft, setDraft] = useState<Draft | null>(null);
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
  const [size, setSize] = useState({ width: 1200, height: 800 });

  const gridData = useMemo(() => {
    const points: Point[] = [];
    const geometry: Geometry[] = [];
    for (const g of doc.grids) {
      if (!g.visible || g.locked) continue;
      const built = buildGridGeometry(g);
      points.push(...built.points);
      geometry.push(...built.major);
    }
    return { points, geometry };
  }, [doc.grids]);

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

  // Initial fit to the artboard once we know the viewport size.
  const didFit = useRef(false);
  useEffect(() => {
    if (didFit.current || size.width < 50) return;
    didFit.current = true;
    setView(fitBounds(artboardWorldBounds(doc.artboard), size.width, size.height));
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
        const d = dist(closestPointOnGeometry(o.geometry, world), world);
        if (d <= tol && (!best || d < best.d)) best = { id: o.id, d };
      }
      return best?.id ?? null;
    },
    [doc.objects, view.zoom],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const isPan = spaceDown || e.button === 1 || tool === "pan";
    if (isPan) {
      panRef.current = { x: e.clientX, y: e.clientY };
      return;
    }
    if (e.button !== 0) return;

    const world = toWorld(e.clientX, e.clientY);
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

    if (tool === "select") {
      // Handle editing takes priority over body dragging.
      if (selection.length === 1) {
        const target = doc.objects.find((o) => o.id === selection[0]);
        if (target && !target.locked && target.visible) {
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
    if (panRef.current) {
      const dx = e.clientX - panRef.current.x;
      const dy = e.clientY - panRef.current.y;
      panRef.current = { x: e.clientX, y: e.clientY };
      setView(panBy(viewRef.current, dx, dy));
      return;
    }
    const world = toWorld(e.clientX, e.clientY);
    const { point: snapped, snap: s } = resolveCursor(world);
    const anchor = draft?.points[draft.points.length - 1] ?? measureStart ?? null;
    const point = applyPrecision(anchor, snapped, e.shiftKey);
    setSnap(s);
    setHoverWorld(tool === "select" ? world : point);
    setCursor(tool === "select" ? world : point);
    if (dragRef.current) {
      setDragOffset(pt(point.x - dragRef.current.start.x, point.y - dragRef.current.start.y));
      return;
    }
    if (box) setBox({ ...box, end: world });
  };

  const onPointerUp = () => {
    panRef.current = null;
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
            const b = geometryBounds(o.geometry);
            return b.minX >= minX && b.maxX <= maxX && b.minY >= minY && b.maxY <= maxY;
          })
          .map((o) => o.id);
        setSelection(ids);
      }
      setBox(null);
    }
  };

  const preview = draft && hoverWorld ? draftGeometry(draft, hoverWorld) : null;
  const liveMeasure =
    measureStart && hoverWorld ? measure(measureStart, hoverWorld) : measurement;
  const measureLine = liveMeasure ? { a: liveMeasure.a, b: liveMeasure.b } : null;
  const unit = doc.artboard.unit;
  const readout = !precision.showReadout
    ? null
    : tool === "measure" && liveMeasure
      ? `${formatLength(liveMeasure.length, unit)} · ${formatAngle(liveMeasure.angle)} · dx ${formatLength(liveMeasure.dx, unit)} dy ${formatLength(liveMeasure.dy, unit)}`
      : preview
        ? `${draftReadout(preview, unit)}${shiftDown || precision.angleLock ? ` · locked ${precision.angleStep}°` : ""}`
        : null;
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
      className="relative h-full w-full touch-none overflow-hidden bg-background select-none"
      style={{ cursor: cursorStyle }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => {
        panRef.current = null;
        setSnap(null);
        setCursor(null);
      }}
      onDoubleClick={() => {
        setDraft(null);
        setMeasureStart(null);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        setDraft(null);
        setMeasureStart(null);
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
          {/* Grids: primary first, then secondary */}
          {doc.grids
            .filter((g) => g.weight === "primary")
            .map((g) => (
              <GridLayer key={g.id} grid={g} />
            ))}
          {doc.grids
            .filter((g) => g.weight === "secondary")
            .map((g) => (
              <GridLayer key={g.id} grid={g} />
            ))}
          {/* Shapes */}
          <g>
            {doc.objects.map((o) =>
              o.visible ? (
                <path
                  key={o.id}
                  transform={
                    dragOffset && selection.includes(o.id) && !o.locked
                      ? `translate(${dragOffset.x} ${dragOffset.y})`
                      : undefined
                  }
                  d={geometryToPathData(o.geometry)}
                  fill={o.style.fill}
                  stroke={selection.includes(o.id) ? "var(--color-primary)" : o.style.stroke}
                  strokeWidth={o.style.strokeWidth}
                  strokeLinecap="round"
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
