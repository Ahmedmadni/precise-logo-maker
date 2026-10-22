import { useEffect, useState } from "react";
import { StudioCanvas } from "../components/canvas/StudioCanvas";
import { RightPanel } from "../components/panels/RightPanel";
import { StatusBar } from "../components/panels/StatusBar";
import { MobileTopBar } from "../components/toolbar/MobileTopBar";
import { ToolRail } from "../components/toolbar/ToolRail";
import { useAutosave } from "../hooks/useAutosave";
import { useStudioShortcuts } from "../hooks/useStudioShortcuts";
import { useLanguageBootstrap } from "../i18n";

export function MobileApp() {
  const [panelOpen, setPanelOpen] = useState(false);
  useLanguageBootstrap();
  useStudioShortcuts();
  useAutosave();

  useEffect(() => {
    if (!panelOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPanelOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [panelOpen]);

  return (
    <div className="dark flex h-[100dvh] w-full flex-col overflow-hidden bg-background text-foreground">
      <MobileTopBar onOpenPanel={() => setPanelOpen(true)} />
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <ToolRail />
        <main className="order-1 relative min-h-0 min-w-0 flex-1 lg:order-none">
          <StudioCanvas />
        </main>
        <div className="hidden xl:flex"><RightPanel /></div>
      </div>
      <StatusBar />
      {panelOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button type="button" className="absolute inset-0 bg-black/60" aria-label="Close panels"
            onClick={() => setPanelOpen(false)} />
          <div className="studio-safe-panel relative h-full w-[min(23rem,92vw)] shadow-2xl">
            <RightPanel onClose={() => setPanelOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
