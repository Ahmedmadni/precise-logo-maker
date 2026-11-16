import { describe, expect, it } from "vitest";
import { createHaraka, createLettering, createOrnament } from "../../../calligraphy/model";
import {
  layerCategoryForItem, letteringLayerLabel, matchesLayerCategory,
  matchesLayerSearch, normalizeLayerSearch,
} from "../layerCatalog";

describe("Arabic layer search and readable categories", () => {
  it("finds Arabic words regardless of common diacritics, alef variants and elongations", () => {
    expect(normalizeLayerSearch("أَحْمَد")).toBe("احمد");
    expect(matchesLayerSearch("احمد", "أَحْمَد")).toBe(true);
    expect(matchesLayerSearch("سلم", "ســلَم")).toBe(true);
    expect(matchesLayerSearch("زخرفة", "محمد")).toBe(false);
    expect(matchesLayerSearch("", "محمد")).toBe(true);
  });

  it("shows the actual selected mark and ornament name rather than a generic icon", () => {
    const mark = createHaraka("shadda", 0, 0);
    const ornament = createOrnament("kashida", 0, 0);
    expect(letteringLayerLabel(mark)).toBe("شدة");
    expect(letteringLayerLabel(ornament)).toBe("امتداد زخرفي");
    expect(layerCategoryForItem(mark)).toBe("marks");
    expect(layerCategoryForItem(ornament)).toBe("ornaments");
    expect(matchesLayerSearch("شده", letteringLayerLabel(mark))).toBe(false);
    expect(matchesLayerSearch("شدة", letteringLayerLabel(mark))).toBe(true);
  });

  it("keeps standalone editable text in the words category and filters accurately", () => {
    const word = createLettering(100, 200);
    expect(layerCategoryForItem(word)).toBe("words");
    expect(matchesLayerCategory("words", "words")).toBe(true);
    expect(matchesLayerCategory("all", "shapes")).toBe(true);
    expect(matchesLayerCategory("ornaments", "shapes")).toBe(false);
  });
});
