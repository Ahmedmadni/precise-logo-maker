import { useEffect, useRef } from "react";
import { loadAutosave, saveAutosave } from "../objects/project";
import { useStudio } from "../store/studioStore";

const DEBOUNCE_MS = 800;

/** Restores the last autosaved document once, then persists changes to local storage. */
export function useAutosave(): void {
  const restored = useRef(false);

  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const saved = loadAutosave();
    if (saved) useStudio.setState({ doc: saved, historyLog: ["Restored autosave"] });
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = useStudio.subscribe((state, prev) => {
      if (state.doc === prev.doc) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => saveAutosave(useStudio.getState().doc), DEBOUNCE_MS);
    });
    const flush = () => {
      if (timer) clearTimeout(timer);
      saveAutosave(useStudio.getState().doc);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      flush();
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
      unsubscribe();
    };
  }, []);
}
