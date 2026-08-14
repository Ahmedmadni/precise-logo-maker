import type { Artboard, DocumentState } from "../store/studioStore";
import { geometryToPathData } from "./render";
import type { VectorObject } from "../core/geometry/types";

const escapeXml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const objectToSvg = (o: VectorObject): string => {
  const s = o.style;
  const extras = [
    s.fillOpacity !== undefined && s.fillOpacity !== 1 ? ` fill-opacity="${s.fillOpacity}"` : "",
    s.opacity !== undefined && s.opacity !== 1 ? ` opacity="${s.opacity}"` : "",
    s.dash ? ` stroke-dasharray="${s.dash} ${s.dash}"` : "",
  ].join("");
  return `  <path id="${escapeXml(o.id)}" data-name="${escapeXml(o.name)}" d="${geometryToPathData(
    o.geometry,
  )}" fill="${s.fill}" stroke="${s.stroke}" stroke-width="${s.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"${extras} />`;
};

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
    .filter((o) => o.visible && !o.guide)
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

/** Rasterises the exported SVG to a PNG blob at the requested pixel width. */
export const renderPng = async (doc: DocumentState, size: number): Promise<Blob> => {
  const svg = buildSvgDocument(doc);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const image = new Image();
    image.decoding = "sync";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Failed to rasterise SVG"));
      image.src = url;
    });
    const ratio = doc.artboard.height / doc.artboard.width;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(size);
    canvas.height = Math.round(size * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG encoding failed"))), "image/png");
    });
  } finally {
    URL.revokeObjectURL(url);
  }
};

export const downloadPng = async (
  doc: DocumentState,
  size = 1024,
  filename = `logo-${Math.round(size)}.png`,
): Promise<void> => {
  const blob = await renderPng(doc, size);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};
