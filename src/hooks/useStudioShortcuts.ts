import { useEffect } from "react";
import { useStudio, type ToolId } from "../store/studioStore";

const TOOL_KEYS: Record<string, ToolId> = {
  v: "select",
  l: "line",
  c: "circle",
  a: "arc",
  m: "measure",
  h: "pan",
};

const isTypingTarget = (el: EventTarget | null): boolean => {
  if (!(el instanceof HTMLElement)) return false;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable;
};

export function useStudioShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const store = useStudio.getState();
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) store.redo();
        else store.undo();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (store.selection.length > 0) {
          e.preventDefault();
          store.deleteSelection();
        }
        return;
      }
      if (e.key === "Escape") {
        store.clearSelection();
        store.setMeasurement(null);
        return;
      }
      if (mod) return;
      const tool = TOOL_KEYS[e.key.toLowerCase()];
      if (tool) {
        e.preventDefault();
        store.setTool(tool);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
