import { useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { ConstructionSpec } from "../../ai/construction.functions";
import { buildGrids, buildShapes } from "../../ai/construction-model";
import { geometryToPathData } from "../../objects/render";
import { GridLayer } from "../canvas/GridLayer";
import { Button } from "../ui/button";
import { useT } from "../../i18n";

export function ConstructionPreview({ spec, width, height }: { spec: ConstructionSpec; width: number; height: number }) {
  const t = useT();
  const [guides, setGuides] = useState(true);
  const grids = useMemo(() => buildGrids(spec, width, height), [spec, width, height]);
  const shapes = useMemo(() => buildShapes(spec), [spec]);
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t("Construction preview")} className="h-56 w-full rounded-md border border-border bg-background" dir="ltr">
        {guides && grids.map((grid) => <GridLayer key={grid.id} grid={grid} />)}
        {shapes.filter((shape) => guides || !shape.guide).map((shape, i) => (
          <path key={i} d={geometryToPathData(shape.geometry)} fill={shape.guide ? "none" : shape.style?.fill ?? "none"} stroke="currentColor" className={shape.guide ? "text-muted-foreground" : "text-foreground"} strokeWidth={shape.guide ? 1 : 2} strokeDasharray={shape.guide ? "5 4" : undefined} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <Button variant="outline" size="icon" className="absolute end-2 top-2" onClick={() => setGuides((v) => !v)} aria-pressed={guides} aria-label={t("Preview guides")} title={t("Preview guides")}>
        {guides ? <Eye /> : <EyeOff />}
      </Button>
    </div>
  );
}