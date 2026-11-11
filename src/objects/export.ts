import type { Artboard, DocumentState } from "../store/studioStore";
import { geometryToPathData } from "./render";
import type { VectorObject } from "../core/geometry/types";
import { letteringSvg } from "../calligraphy/model";

const escapeXml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Protect SVG exports from malformed imported project style values. */
const safePaint = (value: string): string =>
  /^(?:none|transparent|currentColor|#[0-9a-fA-F]{3,8}|rgba?\([0-9.,%\s]+\)|[a-zA-Z]{2,30})$/.test(value) ? value : "none";
const opacity01 = (value: number | undefined): number =>
  value === undefined || !Number.isFinite(value) ? 1 : Math.min(1, Math.max(0, value));

const objectToSvg = (o: VectorObject): string => {
  const s = o.style;
  const extras = [
    opacity01(s.fillOpacity) !== 1 ? ` fill-opacity="${opacity01(s.fillOpacity)}"` : "",
    opacity01(s.opacity) !== 1 ? ` opacity="${opacity01(s.opacity)}"` : "",
    s.dash && Number.isFinite(s.dash) && s.dash > 0 ? ` stroke-dasharray="${s.dash} ${s.dash}"` : "",
  ].join("");
  return `  <path id="${escapeXml(o.id)}" data-name="${escapeXml(o.name)}" d="${geometryToPathData(
    o.geometry,
  )}" fill="${safePaint(s.fill)}" stroke="${safePaint(s.stroke)}" stroke-width="${Number.isFinite(s.strokeWidth) ? Math.max(0, s.strokeWidth) : 0}" stroke-linecap="${s.cap ?? "round"}" stroke-linejoin="${s.join ?? "round"}"${extras} />`;
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
  const lettering = (doc.lettering ?? []).map(letteringSvg).filter(Boolean).join("\n");
  const embeddedFont = doc.customThuluthFont && /^data:(?:font\/(?:ttf|otf|woff|woff2|sfnt)|application\/(?:octet-stream|x-font-ttf|font-woff));base64,[A-Za-z0-9+/=]+$/.test(doc.customThuluthFont)
    ? `  <defs><style>@font-face { font-family: "Custom Thuluth"; src: url("${doc.customThuluthFont}"); }</style></defs>\n`
    : "";
  const bg = options.background
    ? `  <rect width="${a.width}" height="${a.height}" fill="${safePaint(a.background)}" />\n`
    : "";
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${a.width}" height="${a.height}" viewBox="0 0 ${a.width} ${a.height}">`,
    embeddedFont + bg + [body, lettering].filter(Boolean).join("\n"),
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
