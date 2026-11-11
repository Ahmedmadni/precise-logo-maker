import { useEffect, useRef } from "react";
import {
  loadLargeAutosave, readLocalSnapshot, saveAutosave, saveLargeAutosave,
} from "../objects/project";
import { useStudio } from "../store/studioStore";

const DEBOUNCE_MS = 800;

/**
 * Restore the newest local snapshot; persist heavy vector outlines via
 * IndexedDB and keep a synchronous localStorage fallback for pagehide.
 */
export function useAutosave(): void {
  const restored = useRef(false);

  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const local = readLocalSnapshot();
    if (local) useStudio.setState({ doc: local.document, historyLog: ["Restored autosave"] });
    const snapshotAfterLocal = useStudio.getState().doc;
    let cancelled = false;
    void loadLargeAutosave().then((large) => {
      if (cancelled || !large || useStudio.getState().doc !== snapshotAfterLocal) return;
      const localStamp = local?.savedAt ? Date.parse(local.savedAt) : 0;
      const largeStamp = large.savedAt ? Date.parse(large.savedAt) : 0;
      if (!local || largeStamp > localStamp) {
        useStudio.setState({ doc: large.document, historyLog: ["Restored large project"] });
      }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const persist = () => {
      const current = useStudio.getState().doc;
      saveAutosave(current);
      void saveLargeAutosave(current);
    };
    const unsubscribe = useStudio.subscribe((state, prev) => {
      if (state.doc === prev.doc) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(persist, DEBOUNCE_MS);
    });
    const flush = () => {
      if (timer) clearTimeout(timer);
      persist();
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
