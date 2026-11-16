import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { PanelRightOpen, SlidersHorizontal, X } from "lucide-react";
import { StudioCanvas } from "../components/canvas/StudioCanvas";
import { RightPanel } from "../components/panels/RightPanel";
import { StatusBar } from "../components/panels/StatusBar";
import { ToolRail } from "../components/toolbar/ToolRail";
import { MobileToolDock } from "../components/toolbar/MobileToolDock";
import { StudioHeader } from "../components/toolbar/StudioHeader";
import { StudioEmptyGuide } from "../components/canvas/StudioEmptyGuide";
import { useAutosave } from "../hooks/useAutosave";
import { useServiceWorker } from "../lib/pwa";
import { useStudioShortcuts } from "../hooks/useStudioShortcuts";
import { useLanguageBootstrap, useT } from "../i18n";
import { useStudio } from "../store/studioStore";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Logo Studio — Arabic Calligraphy & Vector Design" },
      {
        name: "description",
        content:
          "Arabic logo and vector editor with editable glyph outlines, typography, ornaments, and geometric tools.",
      },
      { property: "og:title", content: "Logo Grid Studio — Geometric Logo Construction" },
      {
        property: "og:description",
        content:
          "Build precise geometric logos with multi-grid systems, smart snapping and editable SVG geometry.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudioPage,
});

function StudioPage() {
  const [panelOpen, setPanelOpen] = useState(false);
  useEffect(() => {
    if (!panelOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPanelOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [panelOpen]);

  return (
    <div className="dark flex h-[100dvh] w-screen flex-col overflow-hidden bg-background text-foreground">
      <ClientOnly fallback={null}>
        <LanguageSync />
      </ClientOnly>
      <StudioHeader />
      <div className="flex min-h-0 flex-1">
        <div className="hidden sm:flex lg:hidden"><ToolRail onOpenLettering={() => setPanelOpen(true)} /></div>
        <main className="relative min-w-0 flex-1">
          <ClientOnly fallback={<div className="h-full w-full bg-background" />}>
            <CanvasWithShortcuts />
          </ClientOnly>
          <StudioEmptyGuide openPanel={() => setPanelOpen(true)} />
          <ClientOnly fallback={null}>
            <SelectionQuickEdit panelOpen={panelOpen} openPanel={() => setPanelOpen(true)} />
          </ClientOnly>
          <ClientOnly fallback={null}>
            <PanelToggle open={panelOpen} onToggle={() => setPanelOpen((v) => !v)} />
          </ClientOnly>
        </main>

        {/* Desktop: docked panel. Mobile: slide-over sheet. */}
        <div className="hidden lg:flex">
          <RightPanel />
        </div>
        {panelOpen && (
          <div className="fixed inset-x-0 top-0 bottom-[calc(64px+max(env(safe-area-inset-bottom),4px))] z-40 sm:inset-0 lg:hidden">
            <button
              type="button"
              aria-label="إغلاق لوحة الأدوات"
              className="absolute inset-0 bg-black/50"
              onClick={() => setPanelOpen(false)}
            />
            <div role="dialog" aria-label="أدوات التصميم" className="absolute inset-x-0 bottom-0 h-[min(78dvh,45rem)] overflow-hidden rounded-t-2xl border-t border-primary/30 bg-card shadow-2xl sm:inset-y-0 sm:start-auto sm:end-0 sm:h-auto sm:w-[min(23rem,90vw)] sm:rounded-none">
              <RightPanel onClose={() => setPanelOpen(false)} />
            </div>
          </div>
        )}
      </div>
      <MobileToolDock openPanel={() => setPanelOpen(true)} closePanel={() => setPanelOpen(false)} panelOpen={panelOpen} />
      <div className="hidden sm:block"><StatusBar /></div>
    </div>
  );
}

function SelectionQuickEdit({ panelOpen, openPanel }: { panelOpen: boolean; openPanel: () => void }) {
  const glyph = useStudio((s) => s.selectedLetteringId);
  const geometryCount = useStudio((s) => s.selection.length);
  const setSection = useStudio((s) => s.setWorkspaceSection);
  if (panelOpen || (!glyph && geometryCount === 0)) return null;
  return (
    <button type="button" onClick={() => { setSection("edit"); openPanel(); }}
      aria-label="تحرير العنصر المحدد"
      className="absolute bottom-4 end-3 z-20 inline-flex min-h-12 items-center gap-2 rounded-xl border border-primary/60 bg-card/95 px-4 text-xs font-semibold text-primary shadow-xl backdrop-blur-sm sm:hidden">
      <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
      {glyph ? "تعديل الحرف المحدد" : "تعديل الشكل المحدد"}
    </button>
  );
}

function PanelToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={t("Panels")}
      className="absolute top-3 end-3 z-30 hidden h-12 w-12 sm:inline-flex lg:hidden items-center justify-center rounded-full border border-border bg-card text-foreground shadow-lg lg:hidden"
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
  useServiceWorker();
  const fontData = useStudio((s) => s.doc.customThuluthFont);
  useEffect(() => {
    if (!fontData || typeof FontFace === "undefined") return;
    let active = true;
    const face = new FontFace("Custom Thuluth", `url("${fontData}")`);
    void face.load().then((loaded) => { if (active) document.fonts.add(loaded); }).catch(() => {});
    return () => { active = false; };
  }, [fontData]);
  return <StudioCanvas />;
}
