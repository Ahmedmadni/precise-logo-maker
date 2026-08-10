import type { Artboard, DocumentState } from "../store/studioStore";
import { geometryToPathData } from "./render";
import type { VectorObject } from "../core/geometry/types";

const escapeXml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const objectToSvg = (o: VectorObject): string =>
  `  <path id="${escapeXml(o.id)}" data-name="${escapeXml(o.name)}" d="${geometryToPathData(
    o.geometry,
  )}" fill="${o.style.fill}" stroke="${o.style.stroke}" stroke-width="${o.style.strokeWidth}" stroke-linecap="round" />`;

export interface ExportOptions {
  /** Include the artboard background rectangle. */
  background: boolean;
}

export const buildSvgDocument = (
  doc: DocumentState,
  options: ExportOptions = { background: true },
): string => {
  const a: Artboard = doc.artboard;
  const body = doc.objects
    .filter((o) => o.visible)
    .map(objectToSvg)
    .join("\n");
  const bg = options.background
    ? `  <rect width="${a.width}" height="${a.height}" fill="${a.background}" />\n`
    : "";
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${a.width}" height="${a.height}" viewBox="0 0 ${a.width} ${a.height}">`,
    bg + body,
    "</svg>",
    "",
  ].join("\n");
};

export const downloadSvg = (doc: DocumentState, filename = "logo.svg"): void => {
  const blob = new Blob([buildSvgDocument(doc)], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};
