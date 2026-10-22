import { useRef, useState } from "react";
import {
  Download, Eye, EyeOff, FilePlus2, FolderOpen, ImagePlus, Languages,
  Maximize2, PanelRightOpen, Redo2, Save, Undo2,
} from "lucide-react";
import { exportPng, exportProject, exportSvg } from "../../mobile/export";
import { fitBounds } from "../../core/coordinates/view";
import { readProjectFile } from "../../objects/project";
import { readReferenceImage } from "../../objects/reference";
import { useLangStore, useT } from "../../i18n";
import { artboardWorldBounds, useStudio } from "../../store/studioStore";

interface Props {
  onOpenPanel: () => void;
}

const actionClass =
  "inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-3 text-xs font-medium text-foreground active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40";

export function MobileTopBar({ onOpenPanel }: Props) {
  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);
  const doc = useStudio((s) => s.doc);
  const viewport = useStudio((s) => s.viewport);
  const setView = useStudio((s) => s.setView);
  const showGrids = useStudio((s) => s.showGrids);
  const setShowGrids = useStudio((s) => s.setShowGrids);
  const newDocument = useStudio((s) => s.newDocument);
  const loadDocument = useStudio((s) => s.loadDocument);
  const setReference = useStudio((s) => s.setReference);
  const undo = useStudio((s) => s.undo);
  const redo = useStudio((s) => s.redo);
  const canUndo = useStudio((s) => s.past.length > 0);
  const canRedo = useStudio((s) => s.future.length > 0);
  const [busy, setBusy] = useState(false);
  const [pngSize, setPngSize] = useState(1024);
  const projectInput = useRef<HTMLInputElement>(null);
  const referenceInput = useRef<HTMLInputElement>(null);

  const perform = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      console.error("Studio action failed", error);
      window.alert(t("Could not complete the operation. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const openProject = async (file?: File) => {
    if (!file) return;
    const loaded = await readProjectFile(file);
    if (!loaded) throw new Error("Invalid .logo project");
    loadDocument(loaded, `Open ${file.name}`);
  };

  const openReference = async (file?: File) => {
    if (!file) return;
    const loaded = await readReferenceImage(file, doc.artboard);
    if (!loaded) throw new Error("Invalid reference image");
    setReference(loaded);
  };

  return (
    <header className="studio-safe-top z-20 shrink-0 border-b border-border bg-card px-2 pt-2">
      <div className="flex min-h-11 items-center justify-between gap-2 pb-2">
        <h1 className="truncate ps-2 text-sm font-semibold tracking-tight text-foreground">
          {t("Logo Grid Studio")}
        </h1>
        <div className="flex shrink-0 items-center gap-1">
          <button className={actionClass} type="button" onClick={undo} disabled={!canUndo} aria-label={t("Undo")}>
            <Undo2 className="h-4 w-4" aria-hidden />
          </button>
          <button className={actionClass} type="button" onClick={redo} disabled={!canRedo} aria-label={t("Redo")}>
            <Redo2 className="h-4 w-4" aria-hidden />
          </button>
          <button className={actionClass} type="button" onClick={onOpenPanel} aria-label={t("Panels")}>
            <PanelRightOpen className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      <nav aria-label={t("Document actions")} className="flex gap-1.5 overflow-x-auto pb-2 [scrollbar-width:none]">
        <button className={actionClass} type="button" onClick={() => {
          if (!doc.objects.length || window.confirm(t("Start a new document? Unsaved work is lost."))) newDocument();
        }}><FilePlus2 className="h-4 w-4" aria-hidden />{t("New")}</button>
        <button className={actionClass} type="button" onClick={() => projectInput.current?.click()}>
          <FolderOpen className="h-4 w-4" aria-hidden />{t("Open")}</button>
        <button className={actionClass} type="button" disabled={busy} onClick={() => void perform(() => exportProject(doc))}>
          <Save className="h-4 w-4" aria-hidden />{t("Save")}</button>
        <button className={actionClass} type="button" onClick={() => referenceInput.current?.click()}>
          <ImagePlus className="h-4 w-4" aria-hidden />{t("Reference image")}</button>
        <button className={actionClass} type="button" onClick={() => setShowGrids(!showGrids)} aria-pressed={showGrids}>
          {showGrids ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
          {showGrids ? t("Hide grids") : t("Show grids")}
        </button>
        <button className={actionClass} type="button" onClick={() => setView(fitBounds(artboardWorldBounds(doc.artboard), viewport.width, viewport.height))}>
          <Maximize2 className="h-4 w-4" aria-hidden />{t("Fit artboard")}</button>
        <button className={actionClass} type="button" disabled={!doc.objects.length || busy} onClick={() => void perform(() => exportSvg(doc))}>
          <Download className="h-4 w-4" aria-hidden />SVG</button>
        <select aria-label={t("PNG export size")} className="h-11 shrink-0 rounded-lg border border-border bg-secondary px-2 text-xs" value={pngSize}
          onChange={(event) => setPngSize(Number(event.target.value))}>
          {[512, 1024, 2048, 4096].map((size) => <option key={size} value={size}>{size}px</option>)}
        </select>
        <button className={actionClass} type="button" disabled={!doc.objects.length || busy} onClick={() => void perform(() => exportPng(doc, pngSize))}>
          <Download className="h-4 w-4" aria-hidden />PNG</button>
        <button className={actionClass} type="button" onClick={() => setLang(lang === "ar" ? "en" : "ar")} aria-label={t("Language")}>
          <Languages className="h-4 w-4" aria-hidden />{lang === "ar" ? "EN" : "AR"}</button>
      </nav>
      <input className="hidden" ref={projectInput} type="file" accept=".logo,application/json" aria-label={t("Open project file")}
        onChange={(event) => { void perform(() => openProject(event.target.files?.[0])); event.target.value = ""; }} />
      <input className="hidden" ref={referenceInput} type="file" accept="image/*" aria-label={t("Reference image")}
        onChange={(event) => { void perform(() => openReference(event.target.files?.[0])); event.target.value = ""; }} />
    </header>
  );
}
