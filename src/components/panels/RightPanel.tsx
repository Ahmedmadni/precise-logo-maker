import { useRef, useState } from "react";
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndVertical,
  AlignLeft,
  AlignRight,
  AlignStartVertical,
  ArrowDown,
  ArrowUp,
  Copy,
  Eraser,
  FlipHorizontal,
  FlipVertical,
  ImagePlus,
  Magnet,
  PaintBucket,
  PenTool,
  RotateCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { AlignMode } from "../../objects/align";

import type { Unit } from "../../core/coordinates/units";
import { fromPx, toPx } from "../../core/coordinates/units";
import type { Geometry } from "../../core/geometry/types";
import { SNAP_LABEL, type SnapType } from "../../core/snapping/snap";
import { ANGLE_STEPS, RATIOS } from "../../core/precision/constraints";
import { describeGeometry, formatAngle, formatLength } from "../../core/precision/measure";
import type { Grid, GuideShapeKind } from "../../grids";
import { gridSupportsCells } from "../../grids/cells";
import { fitToArtboard, readReferenceImage } from "../../objects/reference";
import { cn } from "../../lib/utils";
import { useStudio } from "../../store/studioStore";
import { useT } from "../../i18n";

const TABS = ["Properties", "Cells", "Objects", "Grids", "Snap", "Precision", "History"] as const;
type Tab = (typeof TABS)[number];

const fieldCls =
  "w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const labelCls = "text-[11px] uppercase tracking-wide text-muted-foreground";

function NumberField({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className={labelCls}>{label}</span>
      <input
        type="number"
        className={fieldCls}
        value={Number.isFinite(value) ? Number(value.toFixed(4)) : 0}
        step={step}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
      />
    </label>
  );
}

function ArtboardSection() {
  const t = useT();
  const artboard = useStudio((s) => s.doc.artboard);
  const setArtboard = useStudio((s) => s.setArtboard);
  const unit = artboard.unit;

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold text-foreground">{t("Artboard")}</h2>
      <div className="flex flex-wrap gap-1.5">
        {[512, 1024, 2048].map((s) => (
          <button
            key={s}
            type="button"
            className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            onClick={() => setArtboard({ width: s, height: s })}
          >
            {s}²
          </button>
        ))}
        <button
          type="button"
          className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          onClick={() => setArtboard({ width: artboard.height, height: artboard.width })}
        >
          {t("Swap orientation")}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label={`${t("Width")} (${unit})`}
          value={fromPx(artboard.width, unit)}
          onChange={(v) => setArtboard({ width: toPx(v, unit) })}
        />
        <NumberField
          label={`${t("Height")} (${unit})`}
          value={fromPx(artboard.height, unit)}
          onChange={(v) => setArtboard({ height: toPx(v, unit) })}
        />
        <label className="flex flex-col gap-1">
          <span className={labelCls}>{t("Unit")}</span>
          <select
            className={fieldCls}
            value={unit}
            onChange={(e) => setArtboard({ unit: e.target.value as Unit })}
          >
            {(["px", "mm", "cm", "in"] as Unit[]).map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelCls}>{t("Background")}</span>
          <input
            type="color"
            className="h-[26px] w-full rounded-md border border-border bg-background"
            value={artboard.background}
            onChange={(e) => setArtboard({ background: e.target.value })}
          />
        </label>
      </div>
    </section>
  );
}

const SWATCHES = [
  "#e8eaf0",
  "#0f1115",
  "#5b8cff",
  "#f4b942",
  "#ef5f6b",
  "#3ec9a7",
  "#a97bff",
  "#8c93a5",
];

/** Colour and paint controls applied to every selected object. */
function PaintSection() {
  const t = useT();
  const selection = useStudio((s) => s.selection);
  const objects = useStudio((s) => s.doc.objects);
  const setSelectionStyle = useStudio((s) => s.setSelectionStyle);
  const first = objects.find((o) => selection.includes(o.id));

  if (!first) {
    return (
      <section className="space-y-2">
        <h2 className="text-xs font-semibold text-foreground">{t("Paint")}</h2>
        <p className="text-xs text-muted-foreground">{t("Select objects to paint them.")}</p>
      </section>
    );
  }

  const style = first.style;
  const filled = style.fill !== "none";

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold text-foreground">{t("Paint")}</h2>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className={labelCls}>{t("Stroke")}</span>
          <input
            type="color"
            className="h-[26px] w-full rounded-md border border-border bg-background"
            value={style.stroke}
            onChange={(e) => setSelectionStyle({ stroke: e.target.value }, "Change stroke color")}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelCls}>{t("Fill")}</span>
          <input
            type="color"
            className="h-[26px] w-full rounded-md border border-border bg-background"
            value={filled ? style.fill : "#5b8cff"}
            onChange={(e) => setSelectionStyle({ fill: e.target.value }, "Change fill color")}
          />
        </label>
        <NumberField
          label={t("Stroke width")}
          value={style.strokeWidth}
          step={0.5}
          onChange={(v) =>
            setSelectionStyle({ strokeWidth: Math.max(0.1, v) }, "Change stroke width")
          }
        />
        <NumberField
          label={t("Dash")}
          value={style.dash ?? 0}
          step={1}
          onChange={(v) => setSelectionStyle({ dash: Math.max(0, v) }, "Change dash")}
        />
      </div>

      <button
        type="button"
        className={cn(
          "rounded-md border border-border px-2 py-1 text-[11px]",
          filled ? "text-muted-foreground hover:bg-accent" : "bg-accent text-accent-foreground",
        )}
        onClick={() => setSelectionStyle({ fill: filled ? "none" : "#5b8cff" }, "Toggle fill")}
      >
        {t("No fill")}
      </button>

      <div className="space-y-1">
        <span className={labelCls}>{t("Swatches")}</span>
        <div className="flex flex-wrap gap-1.5">
          {SWATCHES.map((c) => (
            <div key={c} className="flex flex-col gap-1">
              <button
                type="button"
                aria-label={`Stroke ${c}`}
                className="h-5 w-5 rounded-full border border-border"
                style={{ background: c }}
                onClick={() => setSelectionStyle({ stroke: c }, "Change stroke color")}
              />
              <button
                type="button"
                aria-label={`Fill ${c}`}
                className="h-2.5 w-5 rounded-sm border border-border"
                style={{ background: c }}
                onClick={() => setSelectionStyle({ fill: c }, "Change fill color")}
              />
            </div>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1">
        <span className={labelCls}>
          {t("Fill opacity")} — {Math.round((style.fillOpacity ?? 1) * 100)}%
        </span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={style.fillOpacity ?? 1}
          onChange={(e) =>
            setSelectionStyle({ fillOpacity: Number(e.target.value) }, "Change fill opacity")
          }
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className={labelCls}>
          {t("Opacity")} — {Math.round((style.opacity ?? 1) * 100)}%
        </span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={style.opacity ?? 1}
          onChange={(e) => setSelectionStyle({ opacity: Number(e.target.value) }, "Change opacity")}
        />
      </label>

      <p className="text-[11px] text-muted-foreground">{t("Applies to every selected object.")}</p>
      <p className="text-[11px] text-muted-foreground">
        {t(
          "Pen (P) draws freehand. Paint cells (B) fills grid cells. Cell shape (N) links grid intersections into one outline — double-click or right-click to finish.",
        )}
      </p>
    </section>
  );
}

function ObjectSection() {
  const t = useT();
  const selection = useStudio((s) => s.selection);
  const objects = useStudio((s) => s.doc.objects);
  const updateObject = useStudio((s) => s.updateObject);
  const deleteSelection = useStudio((s) => s.deleteSelection);
  const selected = objects.find((o) => o.id === selection[0]);

  if (!selected) {
    return (
      <p className="text-xs text-muted-foreground">
        {t("Select an object to edit its geometry numerically.")}
      </p>
    );
  }

  const g = selected.geometry;
  const patchGeometry = (next: Geometry) =>
    updateObject(selected.id, { geometry: next }, `Edit ${selected.name}`);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-foreground">{selected.name}</h2>
        <button
          type="button"
          onClick={deleteSelection}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
        >
          <Trash2 className="h-3 w-3" aria-hidden /> {t("Delete")}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {g.kind === "line" && (
          <>
            <NumberField
              label={t("X1")}
              value={g.a.x}
              onChange={(v) => patchGeometry({ ...g, a: { ...g.a, x: v } })}
            />
            <NumberField
              label={t("Y1")}
              value={g.a.y}
              onChange={(v) => patchGeometry({ ...g, a: { ...g.a, y: v } })}
            />
            <NumberField
              label={t("X2")}
              value={g.b.x}
              onChange={(v) => patchGeometry({ ...g, b: { ...g.b, x: v } })}
            />
            <NumberField
              label={t("Y2")}
              value={g.b.y}
              onChange={(v) => patchGeometry({ ...g, b: { ...g.b, y: v } })}
            />
          </>
        )}
        {g.kind === "circle" && (
          <>
            <NumberField
              label={t("Center X")}
              value={g.center.x}
              onChange={(v) => patchGeometry({ ...g, center: { ...g.center, x: v } })}
            />
            <NumberField
              label={t("Center Y")}
              value={g.center.y}
              onChange={(v) => patchGeometry({ ...g, center: { ...g.center, y: v } })}
            />
            <NumberField
              label={t("Radius")}
              value={g.radius}
              onChange={(v) => patchGeometry({ ...g, radius: Math.max(0, v) })}
            />
            <NumberField
              label={t("Diameter")}
              value={g.radius * 2}
              onChange={(v) => patchGeometry({ ...g, radius: Math.max(0, v / 2) })}
            />
          </>
        )}
        {g.kind === "arc" && (
          <>
            <NumberField
              label={t("Center X")}
              value={g.center.x}
              onChange={(v) => patchGeometry({ ...g, center: { ...g.center, x: v } })}
            />
            <NumberField
              label={t("Center Y")}
              value={g.center.y}
              onChange={(v) => patchGeometry({ ...g, center: { ...g.center, y: v } })}
            />
            <NumberField
              label={t("Radius")}
              value={g.radius}
              onChange={(v) => patchGeometry({ ...g, radius: Math.max(0, v) })}
            />
            <NumberField
              label={t("Start °")}
              value={g.startAngle}
              onChange={(v) => patchGeometry({ ...g, startAngle: v })}
            />
            <NumberField
              label={t("End °")}
              value={g.endAngle}
              onChange={(v) => patchGeometry({ ...g, endAngle: v })}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label={t("Stroke width")}
          value={selected.style.strokeWidth}
          step={0.5}
          onChange={(v) =>
            updateObject(
              selected.id,
              { style: { ...selected.style, strokeWidth: Math.max(0.1, v) } },
              "Change stroke width",
            )
          }
        />
        <label className="flex flex-col gap-1">
          <span className={labelCls}>{t("Stroke")}</span>
          <input
            type="color"
            className="h-[26px] w-full rounded-md border border-border bg-background"
            value={selected.style.stroke}
            onChange={(e) =>
              updateObject(
                selected.id,
                { style: { ...selected.style, stroke: e.target.value } },
                "Change stroke color",
              )
            }
          />
        </label>
      </div>
    </section>
  );
}

function TransformSection() {
  const t = useT();
  const selection = useStudio((s) => s.selection);
  const rotateSelection = useStudio((s) => s.rotateSelection);
  const mirrorSelection = useStudio((s) => s.mirrorSelection);
  const duplicateSelection = useStudio((s) => s.duplicateSelection);
  const radialRepeat = useStudio((s) => s.radialRepeat);
  const translateSelection = useStudio((s) => s.translateSelection);
  const toggleSelectionGuide = useStudio((s) => s.toggleSelectionGuide);
  const allGuides = useStudio(
    (s) =>
      s.selection.length > 0 &&
      s.doc.objects.filter((o) => s.selection.includes(o.id)).every((o) => o.guide),
  );
  const [angle, setAngle] = useState(15);
  const [count, setCount] = useState(6);
  const disabled = selection.length === 0;
  const btn =
    "inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-40";

  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold text-foreground">{t("Transform")}</h2>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" className={btn} disabled={disabled} onClick={duplicateSelection}>
          <Copy className="h-3 w-3" aria-hidden /> {t("Duplicate")}
        </button>
        <button
          type="button"
          className={btn}
          disabled={disabled}
          onClick={() => mirrorSelection("x")}
        >
          <FlipHorizontal className="h-3 w-3" aria-hidden /> {t("Mirror H")}
        </button>
        <button
          type="button"
          className={btn}
          disabled={disabled}
          onClick={() => mirrorSelection("y")}
        >
          <FlipVertical className="h-3 w-3" aria-hidden /> {t("Mirror V")}
        </button>
        <button
          type="button"
          className={btn}
          disabled={disabled}
          onClick={() => toggleSelectionGuide()}
        >
          <Compass className="h-3 w-3" aria-hidden />{" "}
          {allGuides ? t("Convert to artwork") : t("Convert to guide")}
        </button>
      </div>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <NumberField label={t("Rotate °")} value={angle} onChange={setAngle} />
        </div>
        <button
          type="button"
          className={btn}
          disabled={disabled}
          onClick={() => rotateSelection(angle)}
        >
          <RotateCw className="h-3 w-3" aria-hidden /> {t("Apply")}
        </button>
      </div>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <NumberField
            label={t("Radial repeat")}
            value={count}
            onChange={(v) => setCount(Math.max(2, Math.round(v)))}
          />
        </div>
        <button
          type="button"
          className={btn}
          disabled={disabled}
          onClick={() => radialRepeat(count)}
        >
          Repeat
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["← 10", -10, 0],
            ["→ 10", 10, 0],
            ["↑ 10", 0, -10],
            ["↓ 10", 0, 10],
          ] as const
        ).map(([label, dx, dy]) => (
          <button
            key={label}
            type="button"
            className={btn}
            disabled={disabled}
            onClick={() => translateSelection(dx, dy)}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        {t(
          "Arrow keys nudge by 1 (Shift = 10). Ctrl/Cmd+D duplicates. Drag with the Select tool to move.",
        )}
      </p>
    </section>
  );
}

function AlignSection() {
  const t = useT();
  const selection = useStudio((s) => s.selection);
  const alignSelection = useStudio((s) => s.alignSelection);
  const distributeSelection = useStudio((s) => s.distributeSelection);
  const disabled = selection.length === 0;
  const btn =
    "inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-40";

  const modes: Array<[string, AlignMode, typeof AlignLeft]> = [
    ["Left", "left", AlignLeft],
    ["Center H", "centerX", AlignCenterHorizontal],
    ["Right", "right", AlignRight],
    ["Top", "top", AlignStartVertical],
    ["Center V", "middleY", AlignCenterVertical],
    ["Bottom", "bottom", AlignEndVertical],
  ];

  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold text-foreground">{t("Align & distribute")}</h2>
      <div className="flex flex-wrap gap-1.5">
        {modes.map(([label, mode, Icon]) => (
          <button
            key={mode}
            type="button"
            className={btn}
            disabled={disabled}
            title={`Align ${label.toLowerCase()}`}
            onClick={() => alignSelection(mode)}
          >
            <Icon className="h-3 w-3" aria-hidden /> {t(label)}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          className={btn}
          disabled={selection.length < 3}
          onClick={() => distributeSelection("x")}
        >
          {t("Distribute H")}
        </button>
        <button
          type="button"
          className={btn}
          disabled={selection.length < 3}
          onClick={() => distributeSelection("y")}
        >
          {t("Distribute V")}
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {t(
          "One object aligns to the artboard; several align to their shared bounds. Distribute needs 3+.",
        )}
      </p>
    </section>
  );
}

/** Cell brush: pick a colour, pick the grid, then drag across the canvas. */
function CellPaintSection() {
  const t = useT();
  const paint = useStudio((s) => s.paint);
  const setPaint = useStudio((s) => s.setPaint);
  const setTool = useStudio((s) => s.setTool);
  const tool = useStudio((s) => s.tool);
  const grids = useStudio((s) => s.doc.grids);
  const showGrids = useStudio((s) => s.showGrids);
  const setShowGrids = useStudio((s) => s.setShowGrids);
  const clearPaintedCells = useStudio((s) => s.clearPaintedCells);
  const cellCount = useStudio((s) => s.doc.objects.filter((o) => o.cellKey).length);
  const paintable = grids.filter((g) => gridSupportsCells(g.kind) && !g.locked);
  const active = paint.gridId
    ? paintable.find((g) => g.id === paint.gridId)
    : (paintable.find((g) => g.visible) ?? paintable[0]);
  const btn =
    "inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-40";

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold text-foreground">{t("Cell painting")}</h2>
      <p className="text-[11px] text-muted-foreground">
        {t(
          "Pick the Paint cells tool (B), then click or drag over the squares the grid lines make. Each cell becomes a real vector shape, so the logo stays after the grid is hidden.",
        )}
      </p>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          className={cn(btn, tool === "cell" && "bg-accent text-accent-foreground")}
          onClick={() => setTool("cell")}
        >
          <PaintBucket className="h-3 w-3" aria-hidden /> {t("Paint cells")}
        </button>
        <button
          type="button"
          aria-pressed={paint.eraser}
          className={cn(btn, paint.eraser && "bg-accent text-accent-foreground")}
          onClick={() => setPaint({ eraser: !paint.eraser })}
          title={t("Eraser (X, or hold Alt)")}
        >
          <Eraser className="h-3 w-3" aria-hidden /> {t("Eraser")}
        </button>
        <button
          type="button"
          className={cn(btn, !showGrids && "bg-accent text-accent-foreground")}
          onClick={() => setShowGrids(!showGrids)}
        >
          {showGrids ? t("Hide grids") : t("Show grids")}
        </button>
      </div>

      <label className="flex items-start gap-2 text-xs text-foreground">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={paint.combine}
          onChange={(e) => setPaint({ combine: e.target.checked })}
        />
        <span>
          {t("Cut pieces with all grids")}
          <span className="block text-[11px] text-muted-foreground">
            {t("Paints the piece formed where every visible grid overlaps, not one grid's cell.")}
          </span>
        </span>
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className={labelCls}>{t("Cell color")}</span>
          <input
            type="color"
            className="h-[26px] w-full rounded-md border border-border bg-background"
            value={paint.color}
            onChange={(e) => setPaint({ color: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelCls}>{t("Grid to paint")}</span>
          <select
            className={fieldCls}
            disabled={paint.combine}
            value={active?.id ?? ""}
            onChange={(e) => setPaint({ gridId: e.target.value || null })}
          >
            {paintable.length === 0 && <option value="">{t("No paintable grid")}</option>}
            {paintable.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-1">
        <span className={labelCls}>{t("Swatches")}</span>
        <div className="flex flex-wrap gap-1.5">
          {SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`${t("Cell color")} ${c}`}
              className={cn(
                "h-6 w-6 rounded-md border",
                paint.color.toLowerCase() === c.toLowerCase() ? "border-primary" : "border-border",
              )}
              style={{ background: c }}
              onClick={() => setPaint({ color: c })}
            />
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1">
        <span className={labelCls}>
          {t("Cell opacity")} — {Math.round(paint.opacity * 100)}%
        </span>
        <input
          type="range"
          min={0.05}
          max={1}
          step={0.05}
          value={paint.opacity}
          onChange={(e) => setPaint({ opacity: Number(e.target.value) })}
        />
      </label>

      {active?.kind === "concentric" && (
        <NumberField
          label={t("Polar sectors")}
          value={paint.sectors}
          onChange={(v) => setPaint({ sectors: Math.min(180, Math.max(1, Math.round(v))) })}
        />
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">
          {t("Painted cells")}: {cellCount}
        </span>
        <button
          type="button"
          className={btn}
          disabled={cellCount === 0}
          onClick={clearPaintedCells}
        >
          <Trash2 className="h-3 w-3" aria-hidden /> {t("Clear cells")}
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {t("Square, isometric, triangular, hexagonal and concentric grids have paintable cells.")}
      </p>
    </section>
  );
}

/** Raster picture pinned under the grids as a tracing guide (never exported). */
function ReferenceImageSection() {
  const t = useT();
  const reference = useStudio((s) => s.doc.reference);
  const artboard = useStudio((s) => s.doc.artboard);
  const setReference = useStudio((s) => s.setReference);
  const updateReference = useStudio((s) => s.updateReference);
  const input = useRef<HTMLInputElement>(null);
  const btn =
    "inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-40";

  const pick = async (file: File | undefined) => {
    if (!file) return;
    try {
      const next = await readReferenceImage(file, artboard);
      if (next) setReference(next);
      else window.alert(t("Pick an image file (PNG, JPG, SVG, WebP)."));
    } catch {
      window.alert(t("Could not load that image."));
    }
  };

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold text-foreground">{t("Reference image")}</h2>
      <p className="text-[11px] text-muted-foreground">
        {t("Sits under the grids so you can draw on top of it. It is never part of the export.")}
      </p>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" className={btn} onClick={() => input.current?.click()}>
          <ImagePlus className="h-3 w-3" aria-hidden />{" "}
          {reference ? t("Replace image") : t("Insert image")}
        </button>
        <input
          ref={input}
          type="file"
          accept="image/*"
          className="hidden"
          aria-label={t("Reference image")}
          onChange={(e) => {
            void pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {reference && (
          <button type="button" className={btn} onClick={() => setReference(null)}>
            <Trash2 className="h-3 w-3" aria-hidden /> {t("Remove")}
          </button>
        )}
      </div>

      {reference && (
        <>
          <div className="flex flex-wrap gap-1.5">
            <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <input
                type="checkbox"
                checked={reference.visible}
                onChange={(e) => updateReference({ visible: e.target.checked })}
              />
              {t("Visible")}
            </label>
            <button
              type="button"
              className={btn}
              onClick={() =>
                updateReference(
                  fitToArtboard(
                    artboard,
                    reference.width || artboard.width,
                    reference.height || artboard.height,
                  ),
                )
              }
            >
              {t("Fit to artboard")}
            </button>
            <button
              type="button"
              className={btn}
              onClick={() =>
                updateReference({
                  x: 0,
                  y: 0,
                  width: artboard.width,
                  height: artboard.height,
                })
              }
            >
              {t("Stretch to artboard")}
            </button>
          </div>
          <label className="flex flex-col gap-1">
            <span className={labelCls}>
              {t("Image opacity")} — {Math.round(reference.opacity * 100)}%
            </span>
            <input
              type="range"
              min={0.05}
              max={1}
              step={0.05}
              value={reference.opacity}
              onChange={(e) => updateReference({ opacity: Number(e.target.value) })}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="X"
              value={reference.x}
              onChange={(v) => updateReference({ x: v })}
            />
            <NumberField
              label="Y"
              value={reference.y}
              onChange={(v) => updateReference({ y: v })}
            />
            <NumberField
              label={t("Width")}
              value={reference.width}
              onChange={(v) => updateReference({ width: Math.max(1, v) })}
            />
            <NumberField
              label={t("Height")}
              value={reference.height}
              onChange={(v) => updateReference({ height: Math.max(1, v) })}
            />
          </div>
        </>
      )}
    </section>
  );
}

/** Freehand assistance: de-wobble strokes and stick them to the picture's lines. */
function TraceAssistSection() {
  const t = useT();
  const trace = useStudio((s) => s.trace);
  const setTrace = useStudio((s) => s.setTrace);
  const setTool = useStudio((s) => s.setTool);
  const tool = useStudio((s) => s.tool);
  const smoothSelection = useStudio((s) => s.smoothSelection);
  const reference = useStudio((s) => s.doc.reference);
  const selection = useStudio((s) => s.selection);
  const objects = useStudio((s) => s.doc.objects);
  const smoothable = objects.filter(
    (o) => selection.includes(o.id) && o.geometry.kind === "path" && !o.locked,
  ).length;
  const btn =
    "inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-40";

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold text-foreground">{t("Trace assist")}</h2>
      <p className="text-[11px] text-muted-foreground">
        {t(
          "Draw with the Pen (P): the wobble is averaged out, and a stroke that is really a straight line or an arc becomes one.",
        )}
      </p>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          className={cn(btn, tool === "pen" && "bg-accent text-accent-foreground")}
          onClick={() => setTool("pen")}
        >
          <PenTool className="h-3 w-3" aria-hidden /> {t("Pen")}
        </button>
        <button
          type="button"
          className={btn}
          disabled={smoothable === 0}
          onClick={smoothSelection}
          title={t("Re-clean the selected freehand paths")}
        >
          <Sparkles className="h-3 w-3" aria-hidden /> {t("Smooth selection")}
        </button>
      </div>

      <label className="flex items-center gap-2 text-xs text-foreground">
        <input
          type="checkbox"
          checked={trace.smoothing}
          onChange={(e) => setTrace({ smoothing: e.target.checked })}
        />
        {t("Smooth freehand strokes")}
      </label>
      <label className="flex items-center gap-2 text-xs text-foreground">
        <input
          type="checkbox"
          checked={trace.fitShapes}
          onChange={(e) => setTrace({ fitShapes: e.target.checked })}
        />
        {t("Recognise straight lines and arcs")}
      </label>
      <label className="flex flex-col gap-1">
        <span className={labelCls}>
          {t("Smoothing strength")} — {trace.tolerance.toFixed(1)}
        </span>
        <input
          type="range"
          min={0.5}
          max={20}
          step={0.5}
          value={trace.tolerance}
          onChange={(e) => setTrace({ tolerance: Number(e.target.value) })}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className={labelCls}>
          {t("Smoothing passes")} — {trace.passes}
        </span>
        <input
          type="range"
          min={0}
          max={8}
          step={1}
          value={trace.passes}
          onChange={(e) => setTrace({ passes: Number(e.target.value) })}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className={labelCls}>
          {t("Keep corners sharper than")} — {Math.round(trace.cornerAngle)}°
        </span>
        <input
          type="range"
          min={0}
          max={120}
          step={5}
          value={trace.cornerAngle}
          onChange={(e) => setTrace({ cornerAngle: Number(e.target.value) })}
        />
      </label>

      <hr className="border-border" />

      <label className="flex items-center gap-2 text-xs text-foreground">
        <input
          type="checkbox"
          checked={trace.magnetic}
          onChange={(e) => setTrace({ magnetic: e.target.checked })}
        />
        <Magnet className="h-3 w-3" aria-hidden /> {t("Snap strokes to the picture's lines")}
      </label>
      <p className="text-[11px] text-muted-foreground">
        {reference?.visible
          ? t("Strokes are pulled onto the edges detected in the reference image.")
          : t("Insert a reference image to enable this.")}
      </p>
      <label className="flex flex-col gap-1">
        <span className={labelCls}>
          {t("Magnet radius")} — {Math.round(trace.magnetRadius)}
        </span>
        <input
          type="range"
          min={2}
          max={60}
          step={1}
          value={trace.magnetRadius}
          onChange={(e) => setTrace({ magnetRadius: Number(e.target.value) })}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className={labelCls}>
          {t("Edge sensitivity")} — {Math.round((1 - trace.edgeThreshold) * 100)}%
        </span>
        <input
          type="range"
          min={0.02}
          max={0.6}
          step={0.02}
          value={trace.edgeThreshold}
          onChange={(e) => setTrace({ edgeThreshold: Number(e.target.value) })}
        />
      </label>
    </section>
  );
}

function CellsTab() {
  return (
    <div className="space-y-4">
      <CellPaintSection />
      <hr className="border-border" />
      <ReferenceImageSection />
      <hr className="border-border" />
      <TraceAssistSection />
    </div>
  );
}

function ObjectsTab() {
  const t = useT();
  const objects = useStudio((s) => s.doc.objects);
  const selection = useStudio((s) => s.selection);
  const setSelection = useStudio((s) => s.setSelection);
  const updateObject = useStudio((s) => s.updateObject);
  const renameObject = useStudio((s) => s.renameObject);
  const reorderObject = useStudio((s) => s.reorderObject);

  return (
    <div className="space-y-3">
      <TransformSection />
      <AlignSection />

      <hr className="border-border" />
      <section className="space-y-1">
        <h2 className="text-xs font-semibold text-foreground">
          {t("Objects")} ({objects.length})
        </h2>
        {objects.length === 0 && (
          <p className="text-[11px] text-muted-foreground">
            {t("Draw something to populate this list.")}
          </p>
        )}
        {[...objects].reverse().map((o) => (
          <div
            key={o.id}
            className={cn(
              "flex items-center gap-1.5 rounded-md border border-transparent px-1.5 py-1",
              selection.includes(o.id) && "border-border bg-accent",
            )}
          >
            <input
              type="checkbox"
              checked={o.visible}
              aria-label={`Toggle ${o.name} visibility`}
              onChange={(e) =>
                updateObject(o.id, { visible: e.target.checked }, "Toggle visibility")
              }
            />
            <input
              className="min-w-0 flex-1 bg-transparent text-xs text-foreground focus-visible:outline-none"
              value={o.name}
              onFocus={() => setSelection([o.id])}
              onChange={(e) => renameObject(o.id, e.target.value)}
            />
            <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <input
                type="checkbox"
                checked={o.locked}
                onChange={(e) => updateObject(o.id, { locked: e.target.checked }, "Toggle lock")}
              />
              {t("Lock")}
            </label>
            <button
              type="button"
              aria-label={`Move ${o.name} up`}
              className="text-muted-foreground hover:text-foreground"
              onClick={() => reorderObject(o.id, 1)}
            >
              <ArrowUp className="h-3 w-3" aria-hidden />
            </button>
            <button
              type="button"
              aria-label={`Move ${o.name} down`}
              className="text-muted-foreground hover:text-foreground"
              onClick={() => reorderObject(o.id, -1)}
            >
              <ArrowDown className="h-3 w-3" aria-hidden />
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}

function GridRow({ grid }: { grid: Grid }) {
  const t = useT();
  const updateGrid = useStudio((s) => s.updateGrid);
  const removeGrid = useStudio((s) => s.removeGrid);

  return (
    <div className="space-y-2 rounded-md border border-border p-2">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={grid.visible}
          onChange={(e) => updateGrid(grid.id, { visible: e.target.checked })}
          aria-label={`Toggle ${grid.name} visibility`}
        />
        <span className="flex-1 text-xs text-foreground">{grid.name}</span>
        <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <input
            type="checkbox"
            checked={grid.locked}
            onChange={(e) => updateGrid(grid.id, { locked: e.target.checked })}
          />
          {t("Lock")}
        </label>
        <button
          type="button"
          aria-label={`Remove ${grid.name}`}
          className="text-muted-foreground hover:text-destructive"
          onClick={() => removeGrid(grid.id)}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label={t("Rotation °")}
          value={grid.rotation}
          onChange={(v) => updateGrid(grid.id, { rotation: v })}
        />
        <NumberField
          label={t("Scale")}
          value={grid.scale}
          step={0.1}
          onChange={(v) => updateGrid(grid.id, { scale: Math.max(0.01, v) })}
        />
        <NumberField
          label={t("Origin X")}
          value={grid.origin.x}
          onChange={(v) => updateGrid(grid.id, { origin: { ...grid.origin, x: v } })}
        />
        <NumberField
          label={t("Origin Y")}
          value={grid.origin.y}
          onChange={(v) => updateGrid(grid.id, { origin: { ...grid.origin, y: v } })}
        />
        <NumberField
          label={t("Opacity")}
          value={grid.opacity}
          step={0.05}
          onChange={(v) => updateGrid(grid.id, { opacity: Math.min(1, Math.max(0, v)) })}
        />
        <NumberField
          label={t("Stroke")}
          value={grid.strokeWidth}
          step={0.25}
          onChange={(v) => updateGrid(grid.id, { strokeWidth: Math.max(0.1, v) })}
        />
        {grid.kind === "square" && (
          <>
            <NumberField
              label={t("Spacing")}
              value={grid.spacing}
              onChange={(v) => updateGrid(grid.id, { spacing: Math.max(1, v) })}
            />
            <NumberField
              label={t("Subdivisions")}
              value={grid.subdivisions}
              onChange={(v) => updateGrid(grid.id, { subdivisions: Math.max(1, Math.round(v)) })}
            />
            <NumberField
              label={t("Extent")}
              value={grid.extent}
              onChange={(v) => updateGrid(grid.id, { extent: Math.max(10, v) })}
            />
          </>
        )}
        {grid.kind === "concentric" && (
          <>
            <NumberField
              label={t("Start radius")}
              value={grid.startRadius}
              onChange={(v) => updateGrid(grid.id, { startRadius: Math.max(0, v) })}
            />
            <NumberField
              label={t("Radius step")}
              value={grid.radiusStep}
              onChange={(v) => updateGrid(grid.id, { radiusStep: Math.max(1, v) })}
            />
            <NumberField
              label={t("Count")}
              value={grid.count}
              onChange={(v) => updateGrid(grid.id, { count: Math.max(1, Math.round(v)) })}
            />
          </>
        )}
        {grid.kind === "radial" && (
          <>
            <NumberField
              label={t("Rays")}
              value={grid.rays}
              onChange={(v) => updateGrid(grid.id, { rays: Math.max(1, Math.round(v)) })}
            />
            <NumberField
              label={t("Angle offset °")}
              value={grid.angleOffset}
              onChange={(v) => updateGrid(grid.id, { angleOffset: v })}
            />
            <NumberField
              label={t("Length")}
              value={grid.length}
              onChange={(v) => updateGrid(grid.id, { length: Math.max(1, v) })}
            />
          </>
        )}
        {grid.kind === "isometric" && (
          <>
            <NumberField
              label={t("Spacing")}
              value={grid.spacing}
              onChange={(v) => updateGrid(grid.id, { spacing: Math.max(1, v) })}
            />
            <NumberField
              label={t("Extent")}
              value={grid.extent}
              onChange={(v) => updateGrid(grid.id, { extent: Math.max(10, v) })}
            />
            <NumberField
              label={t("Axis angle °")}
              value={grid.axisAngle}
              onChange={(v) => updateGrid(grid.id, { axisAngle: Math.min(89, Math.max(1, v)) })}
            />
          </>
        )}
        {grid.kind === "triangular" && (
          <>
            <NumberField
              label={t("Spacing")}
              value={grid.spacing}
              onChange={(v) => updateGrid(grid.id, { spacing: Math.max(1, v) })}
            />
            <NumberField
              label={t("Extent")}
              value={grid.extent}
              onChange={(v) => updateGrid(grid.id, { extent: Math.max(10, v) })}
            />
          </>
        )}
        {grid.kind === "hexagonal" && (
          <>
            <NumberField
              label={t("Hex size")}
              value={grid.size}
              onChange={(v) => updateGrid(grid.id, { size: Math.max(2, v) })}
            />
            <NumberField
              label={t("Rings")}
              value={grid.rings}
              onChange={(v) =>
                updateGrid(grid.id, { rings: Math.min(20, Math.max(0, Math.round(v))) })
              }
            />
            <label className="col-span-2 flex items-center gap-2 text-[11px] text-muted-foreground">
              <input
                type="checkbox"
                checked={grid.pointyTop}
                onChange={(e) => updateGrid(grid.id, { pointyTop: e.target.checked })}
              />
              {t("Pointy-top orientation")}
            </label>
          </>
        )}
        {grid.kind === "golden" && (
          <>
            <NumberField
              label={t("Width")}
              value={grid.width}
              onChange={(v) => updateGrid(grid.id, { width: Math.max(10, v) })}
            />
            <NumberField
              label={t("Height")}
              value={grid.height}
              onChange={(v) => updateGrid(grid.id, { height: Math.max(10, v) })}
            />
            <NumberField
              label={t("Steps")}
              value={grid.steps}
              onChange={(v) =>
                updateGrid(grid.id, { steps: Math.min(16, Math.max(1, Math.round(v))) })
              }
            />
            <label className="col-span-2 flex items-center gap-2 text-[11px] text-muted-foreground">
              <input
                type="checkbox"
                checked={grid.spiral}
                onChange={(e) => updateGrid(grid.id, { spiral: e.target.checked })}
              />
              {t("Golden spiral arcs")}
            </label>
          </>
        )}
        {grid.kind === "shape" && (
          <>
            <label className="col-span-2 flex flex-col gap-1">
              <span className={labelCls}>{t("Guide shape")}</span>
              <select
                className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
                value={grid.shape}
                onChange={(e) =>
                  updateGrid(grid.id, { shape: e.target.value as GuideShapeKind })
                }
              >
                {(
                  ["circle", "ellipse", "square", "rectangle", "diamond", "polygon"] as const
                ).map((s) => (
                  <option key={s} value={s}>
                    {t(s)}
                  </option>
                ))}
              </select>
            </label>
            <NumberField
              label={t("Width")}
              value={grid.width}
              onChange={(v) => updateGrid(grid.id, { width: Math.max(4, v) })}
            />
            <NumberField
              label={t("Height")}
              value={grid.height}
              onChange={(v) => updateGrid(grid.id, { height: Math.max(4, v) })}
            />
            {grid.shape === "polygon" && (
              <NumberField
                label={t("Sides")}
                value={grid.sides}
                onChange={(v) =>
                  updateGrid(grid.id, { sides: Math.min(24, Math.max(3, Math.round(v))) })
                }
              />
            )}
            <NumberField
              label={t("Copies")}
              value={grid.count}
              onChange={(v) =>
                updateGrid(grid.id, { count: Math.min(24, Math.max(1, Math.round(v))) })
              }
            />
            <NumberField
              label={t("Step ratio")}
              value={grid.stepRatio}
              step={0.05}
              onChange={(v) =>
                updateGrid(grid.id, { stepRatio: Math.min(0.99, Math.max(0.05, v)) })
              }
            />
            <label className="col-span-2 flex items-center gap-2 text-[11px] text-muted-foreground">
              <input
                type="checkbox"
                checked={grid.guides}
                onChange={(e) => updateGrid(grid.id, { guides: e.target.checked })}
              />
              {t("Center axes & diagonals")}
            </label>
          </>
        )}
        <label className="flex flex-col gap-1">
          <span className={labelCls}>{t("Color")}</span>
          <input
            type="color"
            className="h-[26px] w-full rounded-md border border-border bg-background"
            value={grid.color}
            onChange={(e) => updateGrid(grid.id, { color: e.target.value })}
          />
        </label>
      </div>
    </div>
  );
}

function GridsTab() {
  const t = useT();
  const grids = useStudio((s) => s.doc.grids);
  const addGrid = useStudio((s) => s.addGrid);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            "square",
            "concentric",
            "radial",
            "isometric",
            "triangular",
            "hexagonal",
            "golden",
            "shape",
          ] as const
        ).map((k) => (
          <button
            key={k}
            type="button"
            className="rounded-md border border-border px-2 py-1 text-[11px] capitalize text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            onClick={() => addGrid(k)}
          >
            + {t(k)}
          </button>
        ))}
      </div>
      {grids.map((g) => (
        <GridRow key={g.id} grid={g} />
      ))}
      {grids.length === 0 && <p className="text-xs text-muted-foreground">{t("No grids yet.")}</p>}
    </div>
  );
}

function SnapTab() {
  const t = useT();
  const snap = useStudio((s) => s.snap);
  const setSnapEnabled = useStudio((s) => s.setSnapEnabled);
  const toggleSnapType = useStudio((s) => s.toggleSnapType);

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-xs text-foreground">
        <input
          type="checkbox"
          checked={snap.enabled}
          onChange={(e) => setSnapEnabled(e.target.checked)}
        />
        {t("Smart snapping enabled")}
      </label>
      <div className="space-y-1.5">
        <p className={labelCls}>{t("Types (priority order)")}</p>
        {snap.priority.map((type: SnapType, i) => (
          <label key={type} className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="w-4 text-end text-[10px]">{i + 1}</span>
            <input
              type="checkbox"
              checked={snap.types[type]}
              onChange={() => toggleSnapType(type)}
            />
            {t(SNAP_LABEL[type])}
          </label>
        ))}
      </div>
    </div>
  );
}

function PrecisionTab() {
  const t = useT();
  const precision = useStudio((s) => s.precision);
  const setPrecision = useStudio((s) => s.setPrecision);
  const measurement = useStudio((s) => s.measurement);
  const scaleSelection = useStudio((s) => s.scaleSelection);
  const selection = useStudio((s) => s.selection);
  const objects = useStudio((s) => s.doc.objects);
  const unit = useStudio((s) => s.doc.artboard.unit);
  const selected = objects.filter((o) => selection.includes(o.id));

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h2 className="text-xs font-semibold text-foreground">{t("Constraints")}</h2>
        <label className="flex items-center gap-2 text-xs text-foreground">
          <input
            type="checkbox"
            checked={precision.angleLock}
            onChange={(e) => setPrecision({ angleLock: e.target.checked })}
          />
          {t("Angle lock (hold Shift for temporary lock)")}
        </label>
        <div className="flex flex-wrap gap-1.5">
          {ANGLE_STEPS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setPrecision({ angleStep: a })}
              className={cn(
                "rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                precision.angleStep === a && "bg-accent text-accent-foreground",
              )}
            >
              {a}°
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label={t("Length step")}
            value={precision.lengthStep}
            step={1}
            onChange={(v) => setPrecision({ lengthStep: Math.max(0, v) })}
          />
          <label className="flex items-center gap-2 pt-5 text-xs text-foreground">
            <input
              type="checkbox"
              checked={precision.showReadout}
              onChange={(e) => setPrecision({ showReadout: e.target.checked })}
            />
            {t("Live readout")}
          </label>
        </div>
      </section>

      <hr className="border-border" />

      <section className="space-y-2">
        <h2 className="text-xs font-semibold text-foreground">{t("Ratio scaling")}</h2>
        <p className="text-[11px] text-muted-foreground">
          {t("Scales the selection around its own centre.")}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {RATIOS.map((r) => (
            <span
              key={r.id}
              className="inline-flex overflow-hidden rounded-md border border-border"
            >
              <button
                type="button"
                disabled={selection.length === 0}
                onClick={() => scaleSelection(r.value)}
                className="px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-40"
              >
                ×{r.label}
              </button>
              <button
                type="button"
                disabled={selection.length === 0}
                onClick={() => scaleSelection(1 / r.value)}
                className="border-l border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-40"
              >
                ÷
              </button>
            </span>
          ))}
        </div>
      </section>

      <hr className="border-border" />

      <section className="space-y-2">
        <h2 className="text-xs font-semibold text-foreground">{t("Measurements")}</h2>
        {measurement ? (
          <dl className="grid grid-cols-2 gap-1 font-mono text-[11px] text-muted-foreground">
            <dt>{t("Length")}</dt>
            <dd className="text-foreground">{formatLength(measurement.length, unit)}</dd>
            <dt>{t("Angle")}</dt>
            <dd className="text-foreground">{formatAngle(measurement.angle)}</dd>
            <dt>dx</dt>
            <dd className="text-foreground">{formatLength(measurement.dx, unit)}</dd>
            <dt>dy</dt>
            <dd className="text-foreground">{formatLength(measurement.dy, unit)}</dd>
          </dl>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            {t("Pick the Measure tool (M) and click two points.")}
          </p>
        )}
        {selected.length > 0 && (
          <ul className="space-y-1 font-mono text-[11px] text-muted-foreground">
            {selected.map((o) => (
              <li key={o.id}>
                <span className="text-foreground">{o.name}</span> —{" "}
                {describeGeometry(o.geometry, unit)}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function HistoryTab() {
  const t = useT();
  const past = useStudio((s) => s.past);
  const future = useStudio((s) => s.future);
  const jumpTo = useStudio((s) => s.jumpTo);

  return (
    <ol className="space-y-1 text-xs">
      {past.map((entry, i) => (
        <li key={`${entry.label}-${i}`}>
          <button
            type="button"
            onClick={() => jumpTo(i)}
            className="w-full rounded px-2 py-1 text-left text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            {i + 1}. {entry.label}
          </button>
        </li>
      ))}
      <li className="rounded bg-accent px-2 py-1 text-accent-foreground">{t("Current state")}</li>
      {future.map((entry, i) => (
        <li key={`f-${entry.label}-${i}`} className="px-2 py-1 text-muted-foreground/50">
          {entry.label} ({t("redo")})
        </li>
      ))}
    </ol>
  );
}

export function RightPanel({ onClose }: { onClose?: () => void } = {}) {
  const t = useT();
  const [tab, setTab] = useState<Tab>("Properties");

  return (
    <aside className="flex h-full w-full flex-col border-border bg-card lg:w-72 lg:border-s">
      {onClose && (
        <div className="flex items-center justify-between border-b border-border px-3 py-2 lg:hidden">
          <span className="text-xs font-semibold text-foreground">{t("Panels")}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("Close")}
            className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground"
          >
            {t("Close")}
          </button>
        </div>
      )}
      <div
        className="flex flex-wrap border-b border-border"
        role="tablist"
        aria-label={t("Studio panels")}
      >
        {TABS.map((name) => (
          <button
            key={name}
            role="tab"
            aria-selected={tab === name}
            type="button"
            onClick={() => setTab(name)}
            className={cn(
              "flex-1 px-2 py-2 text-[11px] text-muted-foreground transition-colors hover:text-foreground",
              tab === name && "border-b-2 border-primary text-foreground",
            )}
          >
            {t(name)}
          </button>
        ))}
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        {tab === "Properties" && (
          <>
            <ArtboardSection />
            <hr className="border-border" />
            <ObjectSection />
            <hr className="border-border" />
            <PaintSection />
          </>
        )}
        {tab === "Cells" && <CellsTab />}
        {tab === "Objects" && <ObjectsTab />}
        {tab === "Grids" && <GridsTab />}
        {tab === "Snap" && <SnapTab />}
        {tab === "Precision" && <PrecisionTab />}
        {tab === "History" && <HistoryTab />}
      </div>
    </aside>
  );
}
