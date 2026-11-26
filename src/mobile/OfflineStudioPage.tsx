import { useEffect, useState, type ReactNode } from "react";
import { Check, PanelRightOpen, PencilRuler, SlidersHorizontal, Waypoints, X } from "lucide-react";
import { StudioCanvas } from "../components/canvas/StudioCanvas";
import { RightPanel } from "../components/panels/RightPanel";
import { StatusBar } from "../components/panels/StatusBar";
import { ToolRail } from "../components/toolbar/ToolRail";
import { MobileToolDock } from "../components/toolbar/MobileToolDock";
import { StudioHeaderOffline } from "./StudioHeaderOffline";
import { MobileBrushControls } from "./MobileBrushControls";
import { MobileNodeControls } from "./MobileNodeControls";
import { StudioEmptyGuide } from "../components/canvas/StudioEmptyGuide";
import { useAutosave } from "../hooks/useAutosave";
import {useCustomTypeface} from "../hooks/useCustomTypeface";
import { useStudioShortcuts } from "../hooks/useStudioShortcuts";
import { useLanguageBootstrap, useT } from "../i18n";
import { useStudio } from "../store/studioStore";
import { readStudioAppearance, saveStudioAppearance, type StudioAppearance } from "./studioAppearance";

// An Android WebView already starts entirely on the client; there is no SSR
// hydration, TanStack router, Cloudflare backend, or PWA service worker here.
function ClientOnly({ children }: { children: ReactNode; fallback?: ReactNode }) {
  return <>{children}</>;
}

export function OfflineStudioPage() {
  const [panelOpen, setPanelOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [appearance, setAppearance] = useState<StudioAppearance>(readStudioAppearance);
  useEffect(() => saveStudioAppearance(appearance), [appearance]);
  useEffect(()=>{
    const query=window.matchMedia("(min-width: 900px) and (orientation: landscape), (min-width: 1200px)");
    const sync=()=>{if(query.matches)setPanelOpen(false);};
    sync();query.addEventListener("change",sync);
    return ()=>query.removeEventListener("change",sync);
  },[]);
  const openProperties = () => {
    if (window.matchMedia("(min-width: 900px) and (orientation: landscape), (min-width: 1200px)").matches) setInspectorOpen(true);
    else setPanelOpen(true);
  };
  useEffect(() => {
    if (!panelOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPanelOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [panelOpen]);

  return (
    <div className={"studio-workspace flex h-[100dvh] w-full flex-col overflow-hidden bg-background text-foreground pt-[env(safe-area-inset-top)] ps-[env(safe-area-inset-left)] pe-[env(safe-area-inset-right)] " +
      (appearance === "dark" ? "dark" : "")}>
      <ClientOnly fallback={null}>
        <LanguageSync />
      </ClientOnly>
      <StudioHeaderOffline appearance={appearance} onAppearanceChange={setAppearance} />
      {/* At desktop sizes the inspector docks beside—not above—the canvas. */}
      <div className="flex min-h-0 flex-1">
        <div className="hidden min-h-0 shrink-0 sm:flex">
          <ToolRail onOpenLettering={openProperties} />
        </div>
        <main className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
          <button type="button" onClick={() => setInspectorOpen((shown) => !shown)}
            aria-label={inspectorOpen ? "إخفاء لوحة الخصائص" : "إظهار لوحة الخصائص"}
            aria-pressed={inspectorOpen} title="إظهار أو إخفاء خصائص التصميم"
            className="absolute end-3 top-3 z-30 hidden h-11 w-11 items-center justify-center rounded-xl border border-border bg-card/95 text-foreground shadow-sm hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary [@media(min-width:900px)_and_(orientation:landscape)]:inline-flex min-[1200px]:inline-flex">
            {inspectorOpen ? <X className="h-5 w-5" aria-hidden /> : <PanelRightOpen className="h-5 w-5" aria-hidden />}
          </button>
          <ClientOnly fallback={<div className="h-full w-full bg-background" />}>
            <CanvasWithShortcuts />
          </ClientOnly>
          <StudioEmptyGuide openPanel={openProperties} />
          <MobileBrushControls panelOpen={panelOpen} />
          <MobileNodeControls panelOpen={panelOpen} />
          <ClientOnly fallback={null}>
            <SelectionQuickEdit panelOpen={panelOpen} openPanel={openProperties} />
          </ClientOnly>
          <ClientOnly fallback={null}>
            <PanelToggle open={panelOpen} onToggle={() => setPanelOpen((v) => !v)} />
          </ClientOnly>
        </main>

        {/* Mobile and tablet use a modal sheet; desktop uses a docked inspector. */}
        {panelOpen && (
          <div className="fixed inset-x-0 top-0 bottom-[calc(56px+max(env(safe-area-inset-bottom),4px))] z-40 sm:inset-0 [@media(min-width:900px)_and_(orientation:landscape)]:hidden min-[1200px]:hidden">
            <button
              type="button"
              aria-label="إغلاق لوحة الأدوات"
              className="absolute inset-0 bg-black/50"
              onClick={() => setPanelOpen(false)}
            />
            <div role="dialog" aria-label="أدوات التصميم" className="absolute inset-x-0 bottom-0 h-[min(78dvh,45rem)] max-h-full overflow-hidden rounded-t-2xl border-t border-primary/30 bg-card shadow-2xl sm:inset-y-0 sm:start-auto sm:end-0 sm:h-auto sm:w-[min(23rem,90vw)] sm:rounded-none">
              <RightPanel onClose={() => setPanelOpen(false)} />
            </div>
          </div>
        )}
        {inspectorOpen && (
          <div className="hidden min-h-0 h-full w-[clamp(15rem,26vw,23rem)] shrink-0 overflow-hidden [@media(min-width:900px)_and_(orientation:landscape)]:block min-[1200px]:block">
            <RightPanel />
          </div>
        )}
      </div>
      <MobileToolDock openPanel={() => setPanelOpen(true)} closePanel={() => setPanelOpen(false)} panelOpen={panelOpen} />
      <div className="hidden sm:block"><StatusBar /></div>
    </div>
  );
}

/**
 * Canvas-first workflow shortcuts on narrow screens. The existing Android
 * properties sheet stays optional; node/anchor drag can start immediately.
 * All navigation state is ephemeral and does not alter .logo contents.
 */
function SelectionQuickEdit({ panelOpen, openPanel }: { panelOpen: boolean; openPanel: () => void }) {
  const selectedId = useStudio((s) => s.selectedLetteringId);
  const doc = useStudio((s) => s.doc);
  const geometryCount = useStudio((s) => s.selection.length);
  const editNodes = useStudio((s) => s.editGlyphNodes);
  const editJoins = useStudio((s) => s.editJoinAnchors);
  const tool = useStudio((s) => s.tool);
  const setSection = useStudio((s) => s.setWorkspaceSection);
  const setInspectorTab = useStudio((s) => s.setGlyphInspectorTab);
  const setEditNodes = useStudio((s) => s.setEditGlyphNodes);
  const setEditJoins = useStudio((s) => s.setEditJoinAnchors);
  const item = (doc.lettering ?? []).find((glyph) => glyph.id === selectedId);
  if (panelOpen || editNodes || tool !== "select" || (!item && geometryCount === 0)) return null;

  const isOutline = item?.kind === "outline" && !!item.pathData;
  const canJoin = isOutline && !item.catalogShapeId;
  const detailed = () => { setSection("edit"); openPanel(); };
  const openNodes = () => {
    setSection("edit");
    setInspectorTab("paths");
    setEditNodes(true);
  };
  const openJoins = () => {
    if (!canJoin) return;
    setSection("edit");
    setInspectorTab("joins");
    setEditJoins(true);
  };
  const buttonStyle = "inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-3 text-[11px] font-semibold text-foreground active:bg-primary/15";
  return (
    <div dir="rtl" role="group" aria-label="أدوات سريعة للعنصر المحدد"
      className="absolute bottom-3 end-2 z-20 flex max-w-[calc(100%-1rem)] items-center gap-1 rounded-2xl border border-primary/40 bg-card/95 p-1.5 shadow-xl backdrop-blur-lg [@media(min-width:900px)_and_(orientation:landscape)]:hidden min-[1200px]:hidden">
      {editJoins && canJoin ? (
        <>
          <span className="max-w-24 truncate px-1 text-[11px] font-semibold text-primary">
            نقاط الوصل
          </span>
          <button type="button" onClick={() => setEditJoins(false)}
            aria-label="إنهاء تحرير نقاط الوصل" className={buttonStyle}>
            <Check className="h-4 w-4" aria-hidden /> إنهاء
          </button>
          <button type="button" onClick={detailed}
            aria-label="فتح تفاصيل نقاط الوصل" className={buttonStyle}>
            <SlidersHorizontal className="h-4 w-4" aria-hidden /> تفاصيل
          </button>
        </>
      ) : (
        <>
          {isOutline && (
            <button type="button" onClick={openNodes}
              aria-label="فتح تحرير نقاط Bézier مباشرة على الرسم" className={buttonStyle}>
              <PencilRuler className="h-4 w-4" aria-hidden /> العقد
            </button>
          )}
          {canJoin && (
            <button type="button" onClick={openJoins}
              aria-label="فتح تحرير نقاط وصل الحروف على الرسم" className={buttonStyle}>
              <Waypoints className="h-4 w-4" aria-hidden /> الوصلات
            </button>
          )}
          <button type="button" onClick={detailed}
            aria-label={item?.kind === "bridge" ? "تحرير إعدادات الكشيدة" :
              item?.kind === "haraka" ? "تحرير حركة التشكيل" : "فتح أدوات تعديل العنصر"}
            className={buttonStyle+" border-primary/50 text-primary"}>
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            {item?.kind === "bridge" ? "الكشيدة" :
              item?.kind === "haraka" ? "الحركة" : "تفاصيل"}
          </button>
        </>
      )}
    </div>
  );
}

function PanelToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={t("Panels")}
      className="absolute top-3 end-3 z-30 hidden h-12 w-12 sm:inline-flex [@media(min-width:900px)_and_(orientation:landscape)]:hidden min-[1200px]:hidden items-center justify-center rounded-full border border-border bg-card text-foreground shadow-lg [@media(min-width:900px)_and_(orientation:landscape)]:hidden min-[1200px]:hidden"
    >
      {open ? (
        <X className="h-5 w-5" aria-hidden />
      ) : (
        <PanelRightOpen className="h-5 w-5" aria-hidden />
      )}
    </button>
  );
}

function LanguageSync() {
  useLanguageBootstrap();
  return null;
}

function CanvasWithShortcuts() {
  useStudioShortcuts();
  useAutosave();
  useCustomTypeface();
  return <StudioCanvas />;
}
