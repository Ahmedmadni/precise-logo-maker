import { useRef, useState } from "react";
import {
  Check, ChevronDown, Download, Eye, EyeOff, FilePlus2, FolderOpen,
  ImagePlus, Languages, Maximize2, Redo2, RotateCcw, Save, Settings2,
  Undo2, Moon, Sun, X,
} from "lucide-react";
import { downloadSvg, downloadPng, pngDimensions, hasExportLiveText } from "../objects/export";
import { downloadProject, readProjectFile } from "../objects/project";
import { readReferenceImage } from "../objects/reference";
import { fitBounds } from "../core/coordinates/view";
import { artboardWorldBounds, useStudio } from "../store/studioStore";
import { useLangStore } from "../i18n";
import { nativeDocumentsAvailable, saveAndroidProject, exportAndroidSvg, exportAndroidPng, openAndroidProject, openAndroidReferenceImage } from "./nativeDocuments";
import type { StudioAppearance } from "./studioAppearance";


type Menu = "file" | "view" | "export" | null;
const action = "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-start text-sm transition-colors hover:bg-accent";
const borderButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-3 text-xs font-semibold text-foreground transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary";

export function StudioHeaderOffline({
  appearance = "dark", onAppearanceChange,
}: {
  appearance?: StudioAppearance;
  onAppearanceChange?: (value: StudioAppearance) => void;
} = {}) {
  const doc = useStudio((s) => s.doc);
  const view = useStudio((s) => s.view);
  const setView = useStudio((s) => s.setView);
  const viewport = useStudio((s) => s.viewport);
  const undo = useStudio((s) => s.undo);
  const redo = useStudio((s) => s.redo);
  const canUndo = useStudio((s) => s.past.length > 0);
  const canRedo = useStudio((s) => s.future.length > 0);
  const newDocument = useStudio((s) => s.newDocument);
  const loadDocument = useStudio((s) => s.loadDocument);
  const showGrids = useStudio((s) => s.showGrids);
  const setShowGrids = useStudio((s) => s.setShowGrids);
  const guideDraw = useStudio((s) => s.guideDraw);
  const setGuideDraw = useStudio((s) => s.setGuideDraw);
  const setReference = useStudio((s) => s.setReference);
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);
  const [menu, setMenu] = useState<Menu>(null);
  const [transparent, setTransparent] = useState(true);
  const [pngSize, setPngSize] = useState(2048);
  const selectedPngDimensions=pngDimensions(doc.artboard,pngSize);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const projectFile = useRef<HTMLInputElement>(null);
  const nativeFiles = nativeDocumentsAvailable();
  const referenceFile = useRef<HTMLInputElement>(null);
  const count = doc.objects.length + (doc.lettering?.length ?? 0);
  const tr = (ar: string, en: string) => lang === "ar" ? ar : en;

  const open = (kind: Menu) => { setError(""); setMenu(menu === kind ? null : kind); };
  const close = () => { setMenu(null); setError(""); };
  const fit = () => setView(fitBounds(artboardWorldBounds(doc.artboard), viewport.width, viewport.height));
  const newFile = () => {
    if (count === 0 || window.confirm(tr("إنشاء تصميم جديد؟ احفظ نسخة من التصميم الحالي أولا.", "Start a new design? Save your current project first."))) {
      newDocument();
      close();
    }
  };
  const loadFile = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = await readProjectFile(file);
      if (!parsed) throw new Error(tr("ملف المشروع غير صالح.", "Invalid project file."));
      loadDocument(parsed, `Open ${file.name}`);
      close();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر فتح الملف"); }
  };
  const loadImage = async (file?: File) => {
    if (!file) return;
    try {
      const image = await readReferenceImage(file, doc.artboard);
      if (!image) throw new Error(tr("اختر صورة صالحة.", "Choose a valid image."));
      setReference(image);
      close();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر فتح الصورة"); }
  };
  const openReference = async () => {
    if (!nativeFiles) { referenceFile.current?.click(); return; }
    setBusy(true); setError("");
    try {
      const file = await openAndroidReferenceImage();
      if (file) await loadImage(file);
    } catch (cause) { setError(cause instanceof Error ? cause.message : tr("تعذر استيراد الصورة", "Image import failed")); }
    finally { setBusy(false); }
  };
  const exportImage = async () => {
    setBusy(true); setError("");
    try {
      const filename = transparent ? "logo-" + pngSize + "-transparent.png" : "logo-" + pngSize + ".png";
      if (nativeFiles) {
        if (await exportAndroidPng(doc, pngSize, filename, { background: !transparent })) close();
      } else {
        await downloadPng(doc, pngSize, filename, { background: !transparent });
        close();
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : tr("تعذر تصدير PNG", "PNG export failed")); }
    finally { setBusy(false); }
  };
  const exportVector = async () => {
    setBusy(true); setError("");
    try {
      const filename = transparent ? "logo-transparent.svg" : "logo.svg";
      if (nativeFiles) {
        if (await exportAndroidSvg(doc, filename, { background: !transparent })) close();
      } else {
        downloadSvg(doc, filename, { background: !transparent });
        close();
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : tr("تعذر تصدير SVG", "SVG export failed")); }
    finally { setBusy(false); }
  };
  const saveBackup = async () => {
    setBusy(true); setError("");
    try {
      if (nativeFiles) {
        if (await saveAndroidProject(doc)) close();
      } else {
        downloadProject(doc);
        close();
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : tr("تعذر حفظ المشروع", "Project save failed")); }
    finally { setBusy(false); }
  };
  const openProject = async () => {
    if (!nativeFiles) { projectFile.current?.click(); return; }
    setBusy(true); setError("");
    try {
      const parsed = await openAndroidProject();
      if (parsed) { loadDocument(parsed, "Open Android .logo"); close(); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : tr("تعذر فتح المشروع", "Project open failed")); }
    finally { setBusy(false); }
  };
  return (
    <header className="relative z-30 flex min-h-14 shrink-0 items-center gap-1.5 border-b border-border bg-card px-2 text-foreground sm:px-4" dir="rtl">
      <div className="me-auto flex min-w-0 items-center gap-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/40 bg-primary/10 font-serif text-xl font-bold text-primary">ش</div>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-bold sm:text-base"><span className="sm:hidden">{tr("استوديو", "Studio")}</span><span className="hidden sm:inline">{tr("استوديو الشعارات", "Logo Studio")}</span></h1>
          <p className="hidden text-[11px] text-muted-foreground sm:block">{tr("الخط العربي والرسم الفيكتور", "Arabic lettering & vector design")}</p>
        </div>
      </div>
      <button type="button" onClick={undo} disabled={!canUndo} aria-label={tr("تراجع", "Undo")}
        className="flex h-11 w-10 shrink-0 items-center justify-center rounded-lg text-foreground hover:bg-accent disabled:opacity-30">
        <Undo2 className="h-5 w-5" />
      </button>
      <button type="button" onClick={redo} disabled={!canRedo} aria-label={tr("إعادة", "Redo")}
        className="hidden h-11 w-10 shrink-0 items-center justify-center rounded-lg text-foreground hover:bg-accent disabled:opacity-30 sm:flex">
        <Redo2 className="h-5 w-5" />
      </button>
      <button type="button" onClick={fit} title={tr("ملاءمة اللوحة", "Fit artboard")}
        aria-label={tr("ملاءمة اللوحة", "Fit artboard")}
        className="hidden h-11 w-10 shrink-0 items-center justify-center rounded-lg text-foreground hover:bg-accent sm:flex">
        <Maximize2 className="h-4 w-4" />
      </button>
      <button type="button" aria-expanded={menu === "file"} onClick={() => open("file")} aria-label={tr("المشروع", "Project")}
        className={`${borderButton} px-2.5`}>
        <FolderOpen className="h-4 w-4" /><span className="hidden sm:inline">{tr("المشروع", "Project")}</span>
      </button>
      <button type="button" aria-expanded={menu === "view"} onClick={() => open("view")}
        aria-label={tr("العرض", "View")} className={`${borderButton} hidden px-2.5 sm:inline-flex`}>
        <Settings2 className="h-4 w-4" /><span className="hidden sm:inline">{tr("عرض", "View")}</span>
      </button>
      <button type="button" onClick={() => onAppearanceChange?.(appearance === "dark" ? "light" : "dark")}
        aria-label={tr(appearance === "dark" ? "تفعيل الوضع الفاتح" : "تفعيل الوضع الداكن", appearance === "dark" ? "Switch to light theme" : "Switch to dark theme")}
        title={tr("تبديل المظهر", "Switch appearance")}
        className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-foreground hover:bg-accent sm:inline-flex">
        {appearance === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
      </button>
      <button type="button" aria-expanded={menu === "export"} onClick={() => open("export")}
        className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground">
        <Download className="h-4 w-4" /><span>{tr("تصدير", "Export")}</span><ChevronDown className="h-3.5 w-3.5" />
      </button>
      <input ref={projectFile} type="file" accept=".logo,application/json" className="hidden"
        aria-label={tr("فتح مشروع", "Open project")} onChange={(e) => {
          void loadFile(e.target.files?.[0]); e.target.value = "";
        }} />
      <input ref={referenceFile} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
        aria-label={tr("إضافة صورة مرجعية", "Add reference image")} onChange={(e) => {
          void loadImage(e.target.files?.[0]); e.target.value = "";
        }} />
      {menu && <>
        <button type="button" aria-label={tr("إغلاق القائمة", "Close menu")} onClick={close}
          className="fixed inset-0 z-40 bg-black/45" />
        <div className="absolute end-2 top-[calc(100%+6px)] z-50 max-h-[min(78dvh,32rem)] w-[min(90vw,22rem)] overflow-y-auto rounded-2xl border border-border bg-card p-3 shadow-2xl sm:end-4" role="dialog"
          aria-label={tr(menu === "file" ? "قائمة المشروع" : menu === "view" ? "إعدادات العرض" : "خيارات التصدير",
            menu === "file" ? "Project menu" : menu === "view" ? "View menu" : "Export menu")}>
          <div className="mb-2 flex items-center justify-between border-b border-border pb-2">
            <h2 className="text-sm font-bold">
              {menu === "file" ? tr("المشروع والملفات", "Project & files") :
               menu === "view" ? tr("خيارات العرض", "View options") : tr("تصدير الشعار", "Export logo")}
            </h2>
            <button type="button" onClick={close} aria-label={tr("إغلاق", "Close")} className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-accent"><X className="h-5 w-5" /></button>
          </div>
          {menu === "file" && <div className="space-y-1">
            <button type="button" className={action} onClick={newFile}><FilePlus2 className="h-5 w-5 text-primary" />{tr("تصميم جديد", "New design")}</button>
            <button type="button" className={action} disabled={!canRedo} onClick={() => { redo(); close(); }}><Redo2 className="h-5 w-5 text-primary" />{tr("إعادة آخر تعديل", "Redo last edit")}</button>
            <button type="button" className={action} onClick={() => setMenu("view")}><Settings2 className="h-5 w-5 text-primary" />{tr("خيارات العرض والشبكات", "View & grid options")}</button>
            <button type="button" className={action} disabled={busy} onClick={() => void openProject()}><FolderOpen className="h-5 w-5 text-primary" />{tr("فتح مشروع محفوظ (.logo)", "Open .logo project")}</button>
            <button type="button" className={action} disabled={busy} onClick={() => void saveBackup()}><Save className="h-5 w-5 text-primary" />{tr("حفظ نسخة احتياطية للمشروع", "Save project backup")}</button>
            <button type="button" className={action} disabled={busy} onClick={() => void openReference()}><ImagePlus className="h-5 w-5 text-primary" />{tr("إضافة صورة مرجعية", "Add reference image")}</button>
            <button type="button" className={action} onClick={() => onAppearanceChange?.(appearance === "dark" ? "light" : "dark")}>
              {appearance === "dark" ? <Sun className="h-5 w-5 text-primary" /> : <Moon className="h-5 w-5 text-primary" />}
              {appearance === "dark" ? tr("تفعيل المظهر الفاتح", "Switch to light theme") : tr("تفعيل المظهر الداكن", "Switch to dark theme")}
            </button>
            <button type="button" className={action} onClick={() => { setLang(lang === "ar" ? "en" : "ar"); close(); }}>
              <Languages className="h-5 w-5 text-primary" />{tr("اللغة: العربية", "Language: English")}</button>
            <p className="p-2 text-[11px] leading-5 text-muted-foreground">{nativeFiles ? tr("اختر مكان الحفظ من ملفات أندرويد؛ إلغاء الاختيار لا يحذف مشروعك.", "Choose a destination in Android Files; cancelling keeps your work.") : tr("يُحفظ عملك تلقائيا على هذا الجهاز. احتفظ بملف .logo للاستخدام على جهاز آخر.", "Your work is autosaved locally. Export a .logo file as backup.")}</p>
          </div>}
          {menu === "view" && <div className="space-y-1">
            <button type="button" className={action} onClick={() => { fit(); close(); }}><Maximize2 className="h-5 w-5 text-primary" />{tr("إظهار مساحة التصميم كاملة", "Fit artboard")}</button>
            <button type="button" className={action} onClick={() => { setView({ ...view, pan: { x: 0, y: 0 }, rotation: 0, zoom: 1 }); close(); }}>
              <RotateCcw className="h-5 w-5 text-primary" />{tr("إعادة ضبط العرض", "Reset view")}</button>
            <button type="button" className={action} onClick={() => setShowGrids(!showGrids)}>
              {showGrids ? <EyeOff className="h-5 w-5 text-primary" /> : <Eye className="h-5 w-5 text-primary" />}
              {showGrids ? tr("إخفاء الشبكة", "Hide grid") : tr("إظهار الشبكة", "Show grid")}
              {showGrids && <Check className="me-auto h-4 w-4 text-primary" />}
            </button>
            <button type="button" className={action} onClick={() => setGuideDraw(!guideDraw)}>
              <Settings2 className="h-5 w-5 text-primary" />{guideDraw ? tr("إيقاف خطوط الدليل", "Disable guides") : tr("رسم خطوط إرشادية", "Enable guides")}
            </button>
            <p className="border-t border-border pt-3 text-[11px] leading-5 text-muted-foreground">
              يعمل محرر أندرويد دون إنترنت. أدوات الذكاء الاصطناعي المرتبطة بالخادم متاحة
              في إصدار الموقع الإلكتروني فقط، ولا يحتاج الرسم والخط والتصدير إلى تسجيل دخول.
            </p>
          </div>}
          {menu === "export" && <div className="space-y-4">
            <p className="text-xs leading-5 text-muted-foreground">{tr("اختر الصيغة المناسبة، ثم صدّر الشعار بالضغط على الزر.", "Choose your format, then export your logo.")}</p>
            <label className="flex min-h-11 items-center gap-3 rounded-lg border border-border bg-background px-3 text-xs">
              <input type="checkbox" checked={transparent} onChange={(e) => setTransparent(e.target.checked)}
                className="h-4 w-4 accent-[var(--color-primary)]" />
              {tr("خلفية شفافة", "Transparent background")}
            </label>
            <button type="button" disabled={count === 0 || busy} onClick={() => void exportVector()}
              className="flex min-h-14 w-full items-center justify-between rounded-xl border border-primary/50 bg-primary/10 px-4 text-sm font-semibold disabled:opacity-40">
              <span>SVG <span className="block text-[11px] font-normal text-muted-foreground">{tr("فيكتور قابل للتكبير دون فقد دقة", "Scalable vector artwork")}</span></span>
              <Download className="h-5 w-5 text-primary" />
            </button>
            <label className="block space-y-1 text-xs">
              {tr("دقة صورة PNG", "PNG resolution")}
              <select value={pngSize} onChange={(e) => setPngSize(Number(e.target.value))}
                className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm">
                {[256,512,1024,2048,4096].map(size=>{const d=pngDimensions(doc.artboard,size);return <option value={size} key={size} disabled={!d}>{d?`${d.width} × ${d.height} px`:`${size} px — ${tr("يتجاوز الحد","Too large")}`}</option>;})}
              </select>
            </label>
            {!selectedPngDimensions&&<p className="text-xs text-destructive">{tr("اختر عرضًا أصغر؛ الحد الأقصى 4096 بكسل لكل ضلع.","Choose a smaller width; maximum 4096 px per edge.")}</p>}
            {hasExportLiveText(doc)&&<p className="rounded border border-border p-2 text-xs leading-5 text-muted-foreground">{tr("يحتوي التصميم على نصوص حية؛ قد تختلف الخطوط في الملف المصدر. حوّل النصوص إلى مسارات فيكتور قبل التصدير لضمان ثبات شكل الحروف.","Live text may render with different fonts in exported files. Convert text to vector outlines before export for consistent glyph shapes.")}</p>}
            <button type="button" disabled={count === 0 || busy || !selectedPngDimensions} onClick={() => void exportImage()}
              className="flex min-h-14 w-full items-center justify-between rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-40">
              {busy ? tr("جار التصدير...", "Exporting...") : "PNG"}
              <Download className="h-5 w-5" />
            </button>
          </div>}
          {error && <p className="mt-2 rounded-lg border border-destructive/50 p-2 text-xs text-destructive" role="alert">{error}</p>}
        </div>
      </>}
    </header>
  );
}
