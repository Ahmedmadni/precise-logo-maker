import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { PanelRightOpen, X } from "lucide-react";
import { StudioCanvas } from "../components/canvas/StudioCanvas";
import { RightPanel } from "../components/panels/RightPanel";
import { StatusBar } from "../components/panels/StatusBar";
import { ToolRail } from "../components/toolbar/ToolRail";
import { TopBar } from "../components/toolbar/TopBar";
import { useAutosave } from "../hooks/useAutosave";
import { useStudioShortcuts } from "../hooks/useStudioShortcuts";
import { useLanguageBootstrap, useT } from "../i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Logo Grid Studio — Geometric Logo Construction" },
      {
        name: "description",
        content:
          "Vector-first studio for constructing geometric logos: world-space grids, smart snapping, circles, lines and arcs with real SVG geometry.",
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

  return (
    <div className="dark flex h-[100dvh] w-screen flex-col overflow-hidden bg-background text-foreground">
      <ClientOnly fallback={null}>
        <LanguageSync />
      </ClientOnly>
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <ToolRail />
        <main className="relative min-w-0 flex-1">
          <ClientOnly fallback={<div className="h-full w-full bg-background" />}>
            <CanvasWithShortcuts />
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
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              aria-label="Close"
              className="absolute inset-0 bg-black/50"
              onClick={() => setPanelOpen(false)}
            />
            <div className="absolute inset-y-0 end-0 w-[min(20rem,90vw)] shadow-2xl">
              <RightPanel onClose={() => setPanelOpen(false)} />
            </div>
          </div>
        )}
      </div>
      <StatusBar />
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
      className="absolute bottom-4 end-4 z-30 inline-flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-lg lg:hidden"
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
  return <StudioCanvas />;
}
