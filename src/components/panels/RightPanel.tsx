import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { Unit } from "../../core/coordinates/units";
import { fromPx, toPx } from "../../core/coordinates/units";
import type { Geometry } from "../../core/geometry/types";
import { SNAP_LABEL, type SnapType } from "../../core/snapping/snap";
import type { Grid } from "../../grids";
import { cn } from "../../lib/utils";
import { useStudio } from "../../store/studioStore";

const TABS = ["Properties", "Grids", "Snap", "History"] as const;
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
  const artboard = useStudio((s) => s.doc.artboard);
  const setArtboard = useStudio((s) => s.setArtboard);
  const unit = artboard.unit;

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold text-foreground">Artboard</h2>
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
          Swap orientation
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label={`Width (${unit})`}
          value={fromPx(artboard.width, unit)}
          onChange={(v) => setArtboard({ width: toPx(v, unit) })}
        />
        <NumberField
          label={`Height (${unit})`}
          value={fromPx(artboard.height, unit)}
          onChange={(v) => setArtboard({ height: toPx(v, unit) })}
        />
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Unit</span>
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
          <span className={labelCls}>Background</span>
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

function ObjectSection() {
  const selection = useStudio((s) => s.selection);
  const objects = useStudio((s) => s.doc.objects);
  const updateObject = useStudio((s) => s.updateObject);
  const deleteSelection = useStudio((s) => s.deleteSelection);
  const selected = objects.find((o) => o.id === selection[0]);

  if (!selected) {
    return (
      <p className="text-xs text-muted-foreground">
        Select an object to edit its geometry numerically.
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
          <Trash2 className="h-3 w-3" aria-hidden /> Delete
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {g.kind === "line" && (
          <>
            <NumberField label="X1" value={g.a.x} onChange={(v) => patchGeometry({ ...g, a: { ...g.a, x: v } })} />
            <NumberField label="Y1" value={g.a.y} onChange={(v) => patchGeometry({ ...g, a: { ...g.a, y: v } })} />
            <NumberField label="X2" value={g.b.x} onChange={(v) => patchGeometry({ ...g, b: { ...g.b, x: v } })} />
            <NumberField label="Y2" value={g.b.y} onChange={(v) => patchGeometry({ ...g, b: { ...g.b, y: v } })} />
          </>
        )}
        {g.kind === "circle" && (
          <>
            <NumberField label="Center X" value={g.center.x} onChange={(v) => patchGeometry({ ...g, center: { ...g.center, x: v } })} />
            <NumberField label="Center Y" value={g.center.y} onChange={(v) => patchGeometry({ ...g, center: { ...g.center, y: v } })} />
            <NumberField label="Radius" value={g.radius} onChange={(v) => patchGeometry({ ...g, radius: Math.max(0, v) })} />
            <NumberField label="Diameter" value={g.radius * 2} onChange={(v) => patchGeometry({ ...g, radius: Math.max(0, v / 2) })} />
          </>
        )}
        {g.kind === "arc" && (
          <>
            <NumberField label="Center X" value={g.center.x} onChange={(v) => patchGeometry({ ...g, center: { ...g.center, x: v } })} />
            <NumberField label="Center Y" value={g.center.y} onChange={(v) => patchGeometry({ ...g, center: { ...g.center, y: v } })} />
            <NumberField label="Radius" value={g.radius} onChange={(v) => patchGeometry({ ...g, radius: Math.max(0, v) })} />
            <NumberField label="Start °" value={g.startAngle} onChange={(v) => patchGeometry({ ...g, startAngle: v })} />
            <NumberField label="End °" value={g.endAngle} onChange={(v) => patchGeometry({ ...g, endAngle: v })} />
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label="Stroke width"
          value={selected.style.strokeWidth}
          step={0.5}
          onChange={(v) =>
            updateObject(selected.id, { style: { ...selected.style, strokeWidth: Math.max(0.1, v) } }, "Change stroke width")
          }
        />
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Stroke</span>
          <input
            type="color"
            className="h-[26px] w-full rounded-md border border-border bg-background"
            value={selected.style.stroke}
            onChange={(e) =>
              updateObject(selected.id, { style: { ...selected.style, stroke: e.target.value } }, "Change stroke color")
            }
          />
        </label>
      </div>
    </section>
  );
}

function GridRow({ grid }: { grid: Grid }) {
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
          Lock
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
        <NumberField label="Rotation °" value={grid.rotation} onChange={(v) => updateGrid(grid.id, { rotation: v })} />
        <NumberField label="Scale" value={grid.scale} step={0.1} onChange={(v) => updateGrid(grid.id, { scale: Math.max(0.01, v) })} />
        <NumberField label="Origin X" value={grid.origin.x} onChange={(v) => updateGrid(grid.id, { origin: { ...grid.origin, x: v } })} />
        <NumberField label="Origin Y" value={grid.origin.y} onChange={(v) => updateGrid(grid.id, { origin: { ...grid.origin, y: v } })} />
        <NumberField label="Opacity" value={grid.opacity} step={0.05} onChange={(v) => updateGrid(grid.id, { opacity: Math.min(1, Math.max(0, v)) })} />
        <NumberField label="Stroke" value={grid.strokeWidth} step={0.25} onChange={(v) => updateGrid(grid.id, { strokeWidth: Math.max(0.1, v) })} />
        {grid.kind === "square" && (
          <>
            <NumberField label="Spacing" value={grid.spacing} onChange={(v) => updateGrid(grid.id, { spacing: Math.max(1, v) })} />
            <NumberField label="Subdivisions" value={grid.subdivisions} onChange={(v) => updateGrid(grid.id, { subdivisions: Math.max(1, Math.round(v)) })} />
            <NumberField label="Extent" value={grid.extent} onChange={(v) => updateGrid(grid.id, { extent: Math.max(10, v) })} />
          </>
        )}
        {grid.kind === "concentric" && (
          <>
            <NumberField label="Start radius" value={grid.startRadius} onChange={(v) => updateGrid(grid.id, { startRadius: Math.max(0, v) })} />
            <NumberField label="Radius step" value={grid.radiusStep} onChange={(v) => updateGrid(grid.id, { radiusStep: Math.max(1, v) })} />
            <NumberField label="Count" value={grid.count} onChange={(v) => updateGrid(grid.id, { count: Math.max(1, Math.round(v)) })} />
          </>
        )}
        {grid.kind === "radial" && (
          <>
            <NumberField label="Rays" value={grid.rays} onChange={(v) => updateGrid(grid.id, { rays: Math.max(1, Math.round(v)) })} />
            <NumberField label="Angle offset °" value={grid.angleOffset} onChange={(v) => updateGrid(grid.id, { angleOffset: v })} />
            <NumberField label="Length" value={grid.length} onChange={(v) => updateGrid(grid.id, { length: Math.max(1, v) })} />
          </>
        )}
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Color</span>
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
  const grids = useStudio((s) => s.doc.grids);
  const addGrid = useStudio((s) => s.addGrid);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {(["square", "concentric", "radial"] as const).map((k) => (
          <button
            key={k}
            type="button"
            className="rounded-md border border-border px-2 py-1 text-[11px] capitalize text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            onClick={() => addGrid(k)}
          >
            + {k}
          </button>
        ))}
      </div>
      {grids.map((g) => (
        <GridRow key={g.id} grid={g} />
      ))}
      {grids.length === 0 && <p className="text-xs text-muted-foreground">No grids yet.</p>}
    </div>
  );
}

function SnapTab() {
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
        Smart snapping enabled
      </label>
      <div className="space-y-1.5">
        <p className={labelCls}>Types (priority order)</p>
        {snap.priority.map((t: SnapType, i) => (
          <label key={t} className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="w-4 text-right text-[10px]">{i + 1}</span>
            <input
              type="checkbox"
              checked={snap.types[t]}
              onChange={() => toggleSnapType(t)}
            />
            {SNAP_LABEL[t]}
          </label>
        ))}
      </div>
    </div>
  );
}

function HistoryTab() {
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
      <li className="rounded bg-accent px-2 py-1 text-accent-foreground">Current state</li>
      {future.map((entry, i) => (
        <li key={`f-${entry.label}-${i}`} className="px-2 py-1 text-muted-foreground/50">
          {entry.label} (redo)
        </li>
      ))}
    </ol>
  );
}

export function RightPanel() {
  const [tab, setTab] = useState<Tab>("Properties");

  return (
    <aside className="flex h-full w-72 flex-col border-l border-border bg-card">
      <div className="flex border-b border-border" role="tablist" aria-label="Studio panels">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 px-2 py-2 text-[11px] text-muted-foreground transition-colors hover:text-foreground",
              tab === t && "border-b-2 border-primary text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        {tab === "Properties" && (
          <>
            <ArtboardSection />
            <hr className="border-border" />
            <ObjectSection />
          </>
        )}
        {tab === "Grids" && <GridsTab />}
        {tab === "Snap" && <SnapTab />}
        {tab === "History" && <HistoryTab />}
      </div>
    </aside>
  );
}
