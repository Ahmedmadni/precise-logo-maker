import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { StudioCanvas } from "../components/canvas/StudioCanvas";
import { RightPanel } from "../components/panels/RightPanel";
import { StatusBar } from "../components/panels/StatusBar";
import { ToolRail } from "../components/toolbar/ToolRail";
import { TopBar } from "../components/toolbar/TopBar";
import { useAutosave } from "../hooks/useAutosave";
import { useStudioShortcuts } from "../hooks/useStudioShortcuts";

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
  return (
    <div className="dark flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <ToolRail />
        <main className="min-w-0 flex-1">
          <ClientOnly fallback={<div className="h-full w-full bg-background" />}>
            <CanvasWithShortcuts />
          </ClientOnly>
        </main>
        <RightPanel />
      </div>
      <StatusBar />
    </div>
  );
}

function CanvasWithShortcuts() {
  useStudioShortcuts();
  useAutosave();
  return <StudioCanvas />;
}
