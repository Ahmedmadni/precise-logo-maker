import { useRef, useState } from "react";
import {
  Download,
  Eye,
  EyeOff,
  FilePlus2,
  FolderOpen,
  Image,
  ImagePlus,
  Languages,
  Maximize2,
  Redo2,
  RotateCcw,
  Save,
  Scan,
  Undo2,
} from "lucide-react";
import { downloadPng, downloadSvg } from "../../objects/export";
import { downloadProject, readProjectFile } from "../../objects/project";
import { readReferenceImage } from "../../objects/reference";
import { fitBounds } from "../../core/coordinates/view";
import { geometryBounds, unionBounds } from "../../core/geometry/math";
import { artboardWorldBounds, useStudio } from "../../store/studioStore";
import { useLangStore, useT } from "../../i18n";

const ZOOM_LEVELS = [1, 2, 4, 8];

export function TopBar() {
  const view = useStudio((s) => s.view);
  const setView = useStudio((s) => s.setView);
  const doc = useStudio((s) => s.doc);
  const viewport = useStudio((s) => s.viewport);
  const selection = useStudio((s) => s.selection);
  const undo = useStudio((s) => s.undo);
  const redo = useStudio((s) => s.redo);
  const canUndo = useStudio((s) => s.past.length > 0);
  const canRedo = useStudio((s) => s.future.length > 0);
  const loadDocument = useStudio((s) => s.loadDocument);
  const newDocument = useStudio((s) => s.newDocument);
  const showGrids = useStudio((s) => s.showGrids);
  const setShowGrids = useStudio((s) => s.setShowGrids);
  const setReference = useStudio((s) => s.setReference);
  const fileInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const [pngSize, setPngSize] = useState(1024);
  const [busy, setBusy] = useState(false);
  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);

  const openProject = async (file: File | undefined) => {
    if (!file) return;
    const parsed = await readProjectFile(file);
    if (parsed) loadDocument(parsed, `Open ${file.name}`);
    else window.alert(t("This file is not a valid .logo project."));
  };

  const openReference = async (file: File | undefined) => {
    if (!file) return;
    try {
      const reference = await readReferenceImage(file, doc.artboard);
      if (reference) setReference(reference);
      else window.alert(t("Pick an image file (PNG, JPG, SVG, WebP)."));
    } catch {
      window.alert(t("Could not load that image."));
    }
  };

  const exportPng = async () => {
    setBusy(true);
    try {
      await downloadPng(doc, pngSize);
    } finally {
      setBusy(false);
    }
  };

  const fitArtboard = () =>
    setView(fitBounds(artboardWorldBounds(doc.artboard), viewport.width, viewport.height));

  const fitSelection = () => {
    const selected = doc.objects.filter((o) => selection.includes(o.id));
    if (selected.length === 0) return;
    const b = unionBounds(selected.map((o) => geometryBounds(o.geometry)));
    setView(fitBounds(b, viewport.width, viewport.height, 96));
  };

  const setZoom = (zoom: number) => {
    const center = { x: viewport.width / 2, y: viewport.height / 2 };
    const world = {
      x: (center.x - view.pan.x) / view.zoom,
      y: (center.y - view.pan.y) / view.zoom,
    };
    setView({
      ...view,
      zoom,
      pan: { x: center.x - world.x * zoom, y: center.y - world.y * zoom },
    });
  };

  const btn =
    "inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <header className="flex flex-nowrap items-center gap-2 overflow-x-auto border-b border-border bg-card px-3 py-2 [scrollbar-width:none]">
      <h1 className="flex-none whitespace-nowrap text-sm font-semibold tracking-tight text-foreground">
        {t("Logo Grid Studio")}
      </h1>
      <span className="hidden text-[11px] text-muted-foreground sm:inline">
        {t("Phase 7 — Drawing & Paint")}
      </span>

      <button
        type="button"
        className={`${btn} flex-none`}
        onClick={() => setLang(lang === "ar" ? "en" : "ar")}
        title={t("Language")}
        aria-label={t("Language")}
      >
        <Languages className="h-3.5 w-3.5" aria-hidden />
        {lang === "ar" ? "English" : "العربية"}
      </button>

      <div className="flex flex-none items-center gap-1.5">
        <button
          type="button"
          className={btn}
          onClick={() => {
            if (
              doc.objects.length === 0 ||
              window.confirm(t("Start a new document? Unsaved work is lost."))
            )
              newDocument();
          }}
          title={t("New document")}
        >
          <FilePlus2 className="h-3.5 w-3.5" aria-hidden /> {t("New")}
        </button>
        <button
          type="button"
          className={btn}
          onClick={() => fileInput.current?.click()}
          title={t("Open .logo project")}
        >
          <FolderOpen className="h-3.5 w-3.5" aria-hidden /> {t("Open")}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".logo,application/json"
          className="hidden"
          aria-label={t("Open project file")}
          onChange={(e) => {
            void openProject(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          className={btn}
          onClick={() => downloadProject(doc)}
          title={t("Save .logo project")}
        >
          <Save className="h-3.5 w-3.5" aria-hidden /> {t("Save")}
        </button>
        <button
          type="button"
          className={btn}
          onClick={undo}
          disabled={!canUndo}
          title={t("Undo (Ctrl+Z)")}
        >
          <Undo2 className="h-3.5 w-3.5" aria-hidden /> {t("Undo")}
        </button>
        <button
          type="button"
          className={btn}
          onClick={redo}
          disabled={!canRedo}
          title={t("Redo (Ctrl+Shift+Z)")}
        >
          <Redo2 className="h-3.5 w-3.5" aria-hidden /> {t("Redo")}
        </button>
      </div>

      <div className="flex flex-none items-center gap-1.5">
        <button
          type="button"
          className={btn}
          onClick={() => imageInput.current?.click()}
          title={t("Place a picture under the grid to trace over")}
        >
          <ImagePlus className="h-3.5 w-3.5" aria-hidden /> {t("Reference image")}
        </button>
        <input
          ref={imageInput}
          type="file"
          accept="image/*"
          className="hidden"
          aria-label={t("Reference image")}
          onChange={(e) => {
            void openReference(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          className={btn}
          aria-pressed={!showGrids}
          onClick={() => setShowGrids(!showGrids)}
          title={t("Show or hide every grid (G)")}
        >
          {showGrids ? (
            <Eye className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <EyeOff className="h-3.5 w-3.5" aria-hidden />
          )}
          {showGrids ? t("Hide grids") : t("Show grids")}
        </button>
      </div>

      <div className="ms-auto flex flex-none items-center gap-1.5">
        <button type="button" className={btn} onClick={fitArtboard}>
          <Maximize2 className="h-3.5 w-3.5" aria-hidden /> {t("Fit artboard")}
        </button>
        <button
          type="button"
          className={btn}
          onClick={fitSelection}
          disabled={selection.length === 0}
        >
          <Scan className="h-3.5 w-3.5" aria-hidden /> {t("Fit selection")}
        </button>
        <button
          type="button"
          className={btn}
          onClick={() => setView({ ...view, rotation: 0, zoom: 1, pan: { x: 0, y: 0 } })}
          title={t("Reset view")}
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden /> {t("Reset")}
        </button>
        <button
          type="button"
          className={btn}
          onClick={() => downloadSvg(doc)}
          disabled={doc.objects.length === 0}
          title={t("Export SVG")}
        >
          <Download className="h-3.5 w-3.5" aria-hidden /> SVG
        </button>
        <select
          className="rounded-md border border-border bg-background px-1.5 py-1.5 text-xs text-muted-foreground"
          value={pngSize}
          aria-label={t("PNG export size")}
          onChange={(e) => setPngSize(Number(e.target.value))}
        >
          {[512, 1024, 2048, 4096].map((s) => (
            <option key={s} value={s}>
              {s}px
            </option>
          ))}
        </select>
        <button
          type="button"
          className={btn}
          onClick={() => void exportPng()}
          disabled={doc.objects.length === 0 || busy}
          title={t("Export PNG")}
        >
          <Image className="h-3.5 w-3.5" aria-hidden /> PNG
        </button>

        {ZOOM_LEVELS.map((z) => (
          <button
            key={z}
            type="button"
            className={`${btn} hidden sm:inline-flex`}
            onClick={() => setZoom(z)}
          >
            {z * 100}%
          </button>
        ))}
      </div>
    </header>
  );
}
