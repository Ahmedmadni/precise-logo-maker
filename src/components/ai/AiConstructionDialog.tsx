import { useState } from "react";
import { Loader2, Wand2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { suggestConstruction, type ConstructionSpec } from "../../ai/construction.functions";
import { useStudio } from "../../store/studioStore";
import { createGrid, type Grid } from "../../grids";
import type { Geometry } from "../../core/geometry/types";
import { useLang, useT } from "../../i18n";

const n = (v: number | null, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);

function buildGrids(spec: ConstructionSpec, w: number, h: number): Grid[] {
  const center = { x: w / 2, y: h / 2 };
  const size = Math.max(w, h);
  return spec.grids.slice(0, 4).flatMap((g) => {
    const kinds = ["square", "concentric", "radial", "isometric", "triangular", "hexagonal", "golden"];
    if (!kinds.includes(g.kind)) return [];
    const base = createGrid(g.kind as Grid["kind"], center, size) as unknown as Record<string, unknown>;
    const patch: Record<string, unknown> = { rotation: n(g.rotation, base["rotation"] as number) };
    if (g.spacing && g.spacing > 2) {
      if ("spacing" in base) patch["spacing"] = g.spacing;
      if ("radiusStep" in base) patch["radiusStep"] = g.spacing;
      if ("size" in base) patch["size"] = g.spacing;
    }
    if (g.count && "count" in base) patch["count"] = Math.min(40, Math.round(g.count));
    if (g.count && "rings" in base) patch["rings"] = Math.min(12, Math.round(g.count));
    if (g.rays && "rays" in base) patch["rays"] = Math.min(72, Math.round(g.rays));
    return [{ ...base, ...patch } as unknown as Grid];
  });
}

function buildShapes(spec: ConstructionSpec) {
  return spec.shapes.slice(0, 40).flatMap((s) => {
    let geometry: Geometry | null = null;
    if (s.type === "circle" && s.r)
      geometry = { kind: "circle", center: { x: n(s.cx, 0), y: n(s.cy, 0) }, radius: s.r };
    else if (s.type === "arc" && s.r)
      geometry = {
        kind: "arc",
        center: { x: n(s.cx, 0), y: n(s.cy, 0) },
        radius: s.r,
        startAngle: n(s.start, 0),
        endAngle: n(s.end, 180),
      };
    else if (s.type === "line")
      geometry = { kind: "line", a: { x: n(s.x1, 0), y: n(s.y1, 0) }, b: { x: n(s.x2, 0), y: n(s.y2, 0) } };
    else if (s.type === "path" && s.points && s.points.length >= 2)
      geometry = { kind: "path", points: s.points, closed: !!s.closed };
    if (!geometry) return [];
    const guide = s.role === "guide";
    const fill = s.fill && /^#[0-9a-f]{3,8}$/i.test(s.fill) ? s.fill : "none";
    return [{ geometry, guide, style: guide ? undefined : { fill, fillOpacity: 1 } }];
  });
}

export function AiConstructionDialog({ className }: { className: string }) {
  const t = useT();
  const lang = useLang();
  const artboard = useStudio((s) => s.doc.artboard);
  const apply = useStudio((s) => s.applyConstruction);
  const run = useServerFn(suggestConstruction);
  const [open, setOpen] = useState(false);
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spec, setSpec] = useState<ConstructionSpec | null>(null);
  const [replace, setReplace] = useState(false);

  const generate = async () => {
    setBusy(true);
    setError(null);
    setSpec(null);
    try {
      const res = await run({
        data: { brief, width: artboard.width, height: artboard.height, lang },
      });
      if (res.error) setError(res.error);
      else if (res.spec) setSpec(res.spec);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const insert = () => {
    if (!spec) return;
    apply(buildGrids(spec, artboard.width, artboard.height), buildShapes(spec), replace);
    setOpen(false);
  };

  const guides = spec?.shapes.filter((s) => s.role === "guide").length ?? 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className={className} title={t("Suggest a geometric construction from a brand brief")}>
          <Wand2 className="h-3.5 w-3.5" aria-hidden /> {t("AI construction")}
        </button>
      </DialogTrigger>
      <DialogContent className="dark max-w-lg border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle>{t("AI construction")}</DialogTitle>
          <DialogDescription>
            {t("Describe the brand. You get grids, guides and shapes you can edit like anything you drew.")}
          </DialogDescription>
        </DialogHeader>
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={5}
          maxLength={2000}
          placeholder={t("e.g. A coffee roastery called Noor: warm, modern, a sunrise over a cup")}
          className="w-full resize-none rounded-md border border-border bg-background p-2 text-sm"
        />
        <button
          type="button"
          onClick={() => void generate()}
          disabled={busy || brief.trim().length < 3}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          {busy ? t("Designing…") : t("Suggest construction")}
        </button>
        {error && <p className="rounded-md border border-destructive/50 p-2 text-sm text-destructive">{error}</p>}
        {spec && (
          <div className="space-y-2 rounded-md border border-border p-3 text-sm">
            <p className="font-semibold">{spec.concept}</p>
            <p className="text-muted-foreground">{spec.rationale}</p>
            <p className="text-xs text-muted-foreground">
              {t("Grids")}: {spec.grids.length} · {t("Guides")}: {guides} · {t("Shapes")}:{" "}
              {spec.shapes.length - guides}
            </p>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
              {t("Replace current drawing and grids")}
            </label>
            <button
              type="button"
              onClick={insert}
              className="w-full rounded-md border border-border bg-accent px-3 py-2 text-sm font-medium text-accent-foreground"
            >
              {t("Insert on artboard")}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
