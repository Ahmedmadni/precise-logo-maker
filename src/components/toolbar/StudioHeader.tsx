import { useRef, useState } from "react";
import {
  Check, ChevronDown, Download, Eye, EyeOff, FilePlus2, FolderOpen,
  ImagePlus, Languages, Maximize2, Redo2, RotateCcw, Save, Settings2,
  Undo2, X,
} from "lucide-react";
import { downloadSvg, downloadPng } from "../../objects/export";
import { downloadProject, readProjectFile } from "../../objects/project";
import { readReferenceImage } from "../../objects/reference";
import { fitBounds } from "../../core/coordinates/view";
import { artboardWorldBounds, useStudio } from "../../store/studioStore";
import { useLangStore } from "../../i18n";
import { AiConstructionDialog } from "../ai/AiConstructionDialog";

type Menu = "file" | "view" | "export" | null;
const action = "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-start text-sm transition-colors hover:bg-accent";
const borderButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-3 text-xs font-semibold text-foreground transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary";

export function StudioHeader() {
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const projectFile = useRef<HTMLInputElement>(null);
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
  const exportImage = async () => {
    setBusy(true); setError("");
    try {
      await downloadPng(doc, pngSize, transparent ? `logo-${pngSize}-transparent.png` : `logo-${pngSize}.png`, { background: !transparent });
      close();
    } catch { setError(tr("فشل تصدير PNG. جرّب تصدير SVG.", "PNG export failed. Try SVG.")); }
    finally { setBusy(false); }
  };
  const exportVector = () => {
    try {
      downloadSvg(doc, transparent ? "logo-transparent.svg" : "logo.svg", { background: !transparent });
      close();
    } catch { setError(tr("تعذر تصدير SVG.", "SVG export failed.")); }
  };
  return (
    <header className="relative z-30 flex min-h-14 shrink-0 items-center gap-1.5 border-b border-border bg-card px-2 text-foreground sm:px-4" dir="rtl">
      <div className="me-auto flex min-w-0 items-center gap-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/40 bg-primary/10 font-serif text-xl font-bold text-primary">ش</div>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-bold sm:text-base">{tr("استوديو الشعارات", "Logo Studio")}</h1>
          <p className="hidden text-[11px] text-muted-foreground sm:block">{tr("الخط العربي والرسم الفيكتور", "Arabic lettering & vector design")}</p>
        </div>
      </div>
      <button type="button" onClick={undo} disabled={!canUndo} aria-label={tr("تراجع", "Undo")}
        className="flex h-11 w-10 shrink-0 items-center justify-center rounded-lg text-foreground hover:bg-accent disabled:opacity-30">
        <Undo2 className="h-5 w-5" />
      </button>
      <button type="button" onClick={redo} disabled={!canRedo} aria-label={tr("إعادة", "Redo")}
        className="flex h-11 w-10 shrink-0 items-center justify-center rounded-lg text-foreground hover:bg-accent disabled:opacity-30">
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
        aria-label={tr("العرض", "View")} className={`${borderButton} px-2.5`}>
        <Settings2 className="h-4 w-4" /><span className="hidden sm:inline">{tr("عرض", "View")}</span>
      </button>
      <button type="button" aria-expanded={menu === "export"} onClick={() => open("export")}
        className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground">
        <Download className="h-4 w-4" /><span>{tr("تصدير", "Export")}</span><ChevronDown className="h-3.5 w-3.5" />
      </button>
      <input ref={projectFile} type="file" accept=".logo,application/json" className="hidden"
        aria-label={tr("فتح مشروع", "Open project")} onChange={(e) => {
          void loadFile(e.target.files?.[0]); e.target.value = "";
        }} />
      <input ref={referenceFile} type="file" accept="image/*" className="hidden"
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
            <button type="button" className={action} onClick={() => projectFile.current?.click()}><FolderOpen className="h-5 w-5 text-primary" />{tr("فتح مشروع محفوظ (.logo)", "Open .logo project")}</button>
            <button type="button" className={action} onClick={() => { downloadProject(doc); close(); }}><Save className="h-5 w-5 text-primary" />{tr("حفظ نسخة احتياطية للمشروع", "Save project backup")}</button>
            <button type="button" className={action} onClick={() => referenceFile.current?.click()}><ImagePlus className="h-5 w-5 text-primary" />{tr("إضافة صورة مرجعية", "Add reference image")}</button>
            <button type="button" className={action} onClick={() => { setLang(lang === "ar" ? "en" : "ar"); close(); }}>
              <Languages className="h-5 w-5 text-primary" />{tr("اللغة: العربية", "Language: English")}</button>
            <p className="p-2 text-[11px] leading-5 text-muted-foreground">{tr("يُحفظ عملك تلقائيا على هذا الجهاز. احتفظ بملف .logo للاستخدام على جهاز آخر.", "Your work is autosaved locally. Export a .logo file as backup.")}</p>
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
            <div className="border-t border-border pt-2"><AiConstructionDialog className={action + " w-full"} /></div>
          </div>}
          {menu === "export" && <div className="space-y-4">
            <p className="text-xs leading-5 text-muted-foreground">{tr("اختر الصيغة المناسبة، ثم صدّر الشعار بالضغط على الزر.", "Choose your format, then export your logo.")}</p>
            <label className="flex min-h-11 items-center gap-3 rounded-lg border border-border bg-background px-3 text-xs">
              <input type="checkbox" checked={transparent} onChange={(e) => setTransparent(e.target.checked)}
                className="h-4 w-4 accent-[var(--color-primary)]" />
              {tr("خلفية شفافة", "Transparent background")}
            </label>
            <button type="button" disabled={count === 0} onClick={exportVector}
              className="flex min-h-14 w-full items-center justify-between rounded-xl border border-primary/50 bg-primary/10 px-4 text-sm font-semibold disabled:opacity-40">
              <span>SVG <span className="block text-[11px] font-normal text-muted-foreground">{tr("فيكتور قابل للتكبير دون فقد دقة", "Scalable vector artwork")}</span></span>
              <Download className="h-5 w-5 text-primary" />
            </button>
            <label className="block space-y-1 text-xs">
              {tr("دقة صورة PNG", "PNG resolution")}
              <select value={pngSize} onChange={(e) => setPngSize(Number(e.target.value))}
                className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm">
                {[512, 1024, 2048, 4096].map((size) => <option value={size} key={size}>{size} × {size} px</option>)}
              </select>
            </label>
            <button type="button" disabled={count === 0 || busy} onClick={() => void exportImage()}
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
