import { afterEach, describe, expect, it, vi } from "vitest";
import {
  STUDIO_APPEARANCE_KEY, normalizeStudioAppearance, readStudioAppearance,
  saveStudioAppearance,
} from "../studioAppearance";

afterEach(() => vi.unstubAllGlobals());

describe("offline studio visual preference", () => {
  it("uses only supported appearance names and defaults conservatively", () => {
    expect(normalizeStudioAppearance("light")).toBe("light");
    for (const value of [null, undefined, "dark", "system", "auto", {}, 15]) {
      expect(normalizeStudioAppearance(value)).toBe("dark");
    }
  });

  it("persists only the UI mode, independently of the editable .logo document", () => {
    const settings = new Map<string, string>();
    const storage = {
      getItem: (key: string) => settings.get(key) ?? null,
      setItem: (key: string, value: string) => { settings.set(key, value); },
    };
    vi.stubGlobal("window", { localStorage: storage });
    expect(readStudioAppearance()).toBe("dark");
    saveStudioAppearance("light");
    expect(settings.get(STUDIO_APPEARANCE_KEY)).toBe("light");
    expect(readStudioAppearance()).toBe("light");
    saveStudioAppearance("dark");
    expect(readStudioAppearance()).toBe("dark");
    expect([...settings.keys()]).toEqual([STUDIO_APPEARANCE_KEY]);
  });

  it("keeps the editor usable when WebView storage is restricted", () => {
    vi.stubGlobal("window", {
      get localStorage(): never { throw new Error("SecurityError"); },
    });
    expect(readStudioAppearance()).toBe("dark");
    expect(() => saveStudioAppearance("light")).not.toThrow();
  });
});
