import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { PathGeometry } from "../../core/geometry/types";
import { insertPathNode, deletePathNode } from "../../editor/path-nodes";
import { useT } from "../../i18n";
import { Button } from "../ui/button";

export function PathNodesSection({ path, disabled, onChange }: { path: PathGeometry; disabled: boolean; onChange: (path: PathGeometry) => void }) {
  const t = useT();
  const [node, setNode] = useState(0);
  const index = Math.min(node, path.points.length - 1);
  const point = path.points[index];
  if (!point) return null;
  const update = (axis: "x" | "y", value: string) => {
    if (!value.trim()) return;
    const number = Number(value);
    if (Number.isFinite(number)) onChange({ ...path, points: path.points.map((p, i) => i === index ? { ...p, [axis]: number } : p) });
  };
  return (
    <fieldset disabled={disabled} className="space-y-2 disabled:opacity-50">
      <legend className="mb-2 text-xs font-semibold">{t("Path nodes")}</legend>
      <label className="flex items-center gap-2 text-xs">
        {t("Node")}
        <select aria-label={t("Node")} className="min-w-0 flex-1 rounded-md border border-border bg-background p-1.5" value={index} onChange={(e) => setNode(Number(e.target.value))}>
          {path.points.map((_, i) => <option key={i} value={i}>{i + 1}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        {(["x", "y"] as const).map((axis) => <label key={axis} className="space-y-1 text-xs">{axis.toUpperCase()}<input aria-label={`${t("Node")} ${axis.toUpperCase()}`} type="number" step="0.5" value={Number(point[axis].toFixed(4))} className="w-full rounded-md border border-border bg-background p-1.5" onChange={(e) => update(axis, e.target.value)} /></label>)}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="icon" title={t("Add node")} aria-label={t("Add node")} disabled={disabled || (!path.closed && index === path.points.length - 1)} onClick={() => { onChange(insertPathNode(path, index)); setNode(index + 1); }}><Plus /></Button>
        <Button variant="outline" size="icon" title={t("Delete node")} aria-label={t("Delete node")} disabled={disabled || path.points.length <= (path.closed ? 3 : 2)} onClick={() => { onChange(deletePathNode(path, index)); setNode(Math.max(0, index - 1)); }}><Trash2 /></Button>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={path.closed} disabled={disabled || path.points.length < 3} onChange={(e) => onChange({ ...path, closed: e.target.checked })} />{t("Closed path")}</label>
      </div>
    </fieldset>
  );
}