/** Studio-only visual preferences. Never inserted into .logo project data. */
export type StudioAppearance = "light" | "dark";
export const STUDIO_APPEARANCE_KEY = "logo-studio:appearance:v1";

export function normalizeStudioAppearance(value: unknown): StudioAppearance {
  return value === "light" ? "light" : "dark";
}

export function readStudioAppearance(): StudioAppearance {
  try {
    if (typeof window !== "undefined") {
      return normalizeStudioAppearance(window.localStorage.getItem(STUDIO_APPEARANCE_KEY));
    }
  } catch {
    // Android WebView may disable storage in some private contexts.
  }
  return "dark";
}

export function saveStudioAppearance(value: StudioAppearance): void {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STUDIO_APPEARANCE_KEY, value);
    }
  } catch {
    // The selected mode still works for this session without localStorage.
  }
}
