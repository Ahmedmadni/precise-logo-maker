import { describe, expect, it } from "vitest";
import { createLettering, createHaraka, fontFamily, HARAKAT, isHaraka, letteringSvg, xmlEscape } from "../model";

describe("Arabic lettering and safe SVG export", () => {
  it("escapes user text so it cannot inject markup", () => {
    expect(xmlEscape('<script a="&">')).toBe("&lt;script a=&quot;&amp;&quot;&gt;");
    const item = { ...createLettering(100, 200), text: '<image onload="alert(1)">' };
    const output = letteringSvg(item);
    expect(output).not.toContain("<image");
    expect(output).toContain("&lt;image");
  });
  it("keeps script direction and editable SVG text", () => {
    const output = letteringSvg({ ...createLettering(150, 250), text: "مدني" });
    expect(output).toContain('direction="rtl"');
    expect(output).toContain('text-anchor="middle"');
    expect(output).toContain("مدني");
  });
  it("builds every diacritic as a separate vector path", () => {
    expect(HARAKAT).toHaveLength(8);
    for (const mark of HARAKAT) {
      expect(isHaraka(mark.id)).toBe(true);
      const output = letteringSvg(createHaraka(mark.id, 25, 70));
      expect(output).toContain("<path");
      expect(output).toContain('fill-rule="evenodd"');
    }
    expect(isHaraka("unknown")).toBe(false);
  });
  it("never injects unsafe styles from imported documents", () => {
    const output = letteringSvg({ ...createLettering(10, 20), color: 'red" onload="boom' });
    expect(output).toContain('fill="#e8eaf0"');
    expect(output).not.toContain("onload");
  });
  it("gives custom Thuluth an explicit Arabic fallback", () => {
    expect(fontFamily("Custom Thuluth")).toContain("Amiri");
  });
});
