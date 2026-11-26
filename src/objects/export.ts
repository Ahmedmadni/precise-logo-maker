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

const safeCap=(value:unknown)=>value==="butt"||value==="square"?value:"round";
const safeJoin=(value:unknown)=>value==="miter"||value==="bevel"?value:"round";

const objectToSvg = (o: VectorObject): string => {
  const s = o.style;
  const extras = [
    opacity01(s.fillOpacity) !== 1 ? ` fill-opacity="${opacity01(s.fillOpacity)}"` : "",
    opacity01(s.opacity) !== 1 ? ` opacity="${opacity01(s.opacity)}"` : "",
    s.dash && Number.isFinite(s.dash) && s.dash > 0 ? ` stroke-dasharray="${s.dash} ${s.dash}"` : "",
  ].join("");
  return `  <path id="${escapeXml(o.id)}" data-name="${escapeXml(o.name)}" d="${geometryToPathData(
    o.geometry,
  )}"${o.geometry.kind==="path"&&o.geometry.holes?.length?' fill-rule="evenodd"':""} fill="${safePaint(s.fill)}" stroke="${safePaint(s.stroke)}" stroke-width="${Number.isFinite(s.strokeWidth) ? Math.max(0, s.strokeWidth) : 0}" stroke-linecap="${safeCap(s.cap)}" stroke-linejoin="${safeJoin(s.join)}"${extras} />`;
};

export interface ExportOptions {
  /** Include the artboard background rectangle. */
  background: boolean;
}

export const MAX_PNG_EDGE=4096;
export const MAX_PNG_PIXELS=4096*4096;
export function pngDimensions(artboard:Pick<Artboard,"width"|"height">,size:number):{width:number;height:number}|null{
  if(![artboard.width,artboard.height,size].every(Number.isFinite)||artboard.width<=0||artboard.height<=0||size<1)return null;
  const width=Math.round(size),height=Math.max(1,Math.round(width*artboard.height/artboard.width));
  if(width>MAX_PNG_EDGE||height>MAX_PNG_EDGE||width*height>MAX_PNG_PIXELS)return null;
  return {width,height};
}
export const hasExportLiveText=(doc:DocumentState):boolean=>(doc.lettering??[]).some(i=>!i.hidden&&i.kind==="text"&&typeof i.text==="string"&&!!i.text.trim());

/** Count visible export candidates; editor-only construction guides are excluded. */
export const hasExportArtwork=(doc:DocumentState):boolean=>doc.objects.some(o=>o.visible&&!o.guide&&(o.style.opacity??1)>0)||(doc.lettering??[]).some(i=>!i.hidden&&(i.kind!=="text"||typeof i.text==="string"&&!!i.text.trim()));

export const buildSvgDocument = (
  doc: DocumentState,
  options: ExportOptions = { background: true },
  rasterSize?:{width:number;height:number},
): string => {
  const a: Artboard = doc.artboard;
  if(![a.width,a.height].every(n=>typeof n==="number"&&Number.isFinite(n)&&n>0))throw new Error("Invalid artboard dimensions");
  if(rasterSize&&(![rasterSize.width,rasterSize.height].every(n=>Number.isInteger(n)&&n>0&&n<=MAX_PNG_EDGE)||rasterSize.width*rasterSize.height>MAX_PNG_PIXELS))throw new Error("Invalid raster viewport");
  const body = doc.objects
    .filter((o) => o.visible && !o.guide)
    .map(objectToSvg)
    .join("\n");
  const letteringItems = doc.lettering ?? [];
  // Place calligraphic joins behind glyph outlines so the joined endpoints
  // stay optically clean, independently of the layer insertion order.
  const orderedLettering = [
    ...letteringItems.filter((item) => item.kind === "bridge" && !item.hidden),
    ...letteringItems.filter((item) => item.kind !== "bridge" && !item.hidden),
  ];
  const lettering = orderedLettering.map((item) => letteringSvg(item, letteringItems)).filter(Boolean).join("\n");
  const hasLiveCustomText = (doc.lettering ?? []).some((item) => !item.hidden && item.kind === "text" && item.font === "Custom Thuluth");
  const embeddedFont = hasLiveCustomText && doc.customThuluthFont && /^data:(?:font\/(?:ttf|otf|woff|woff2|sfnt)|application\/(?:octet-stream|x-font-ttf|font-woff));base64,[A-Za-z0-9+/=]+$/.test(doc.customThuluthFont)
    ? `  <defs><style>@font-face { font-family: "Custom Thuluth"; src: url("${doc.customThuluthFont}"); }</style></defs>\n`
    : "";
  const bg = options.background
    ? `  <rect width="${a.width}" height="${a.height}" fill="${safePaint(a.background)}" />\n`
    : "";
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${rasterSize?.width??a.width}" height="${rasterSize?.height??a.height}" viewBox="0 0 ${a.width} ${a.height}">`,
    embeddedFont + bg + [body, lettering].filter(Boolean).join("\n"),
    "</svg>",
    "",
  ].join("\n");
};

export const downloadSvg = (doc: DocumentState, filename = "logo.svg", options: ExportOptions = { background: true }): void => {
  const blob = new Blob([buildSvgDocument(doc, options)], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
};

/** Rasterises the exported SVG to a PNG blob at the requested pixel width. */
export const renderPng = async (doc: DocumentState, size: number, options: ExportOptions = { background: true }): Promise<Blob> => {
  const dimensions=pngDimensions(doc.artboard,size);
  if(!dimensions)throw new Error("PNG dimensions exceed supported limits (4096 px per edge). Choose a smaller width or export SVG.");
  const svg = buildSvgDocument(doc, options,dimensions);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  let canvas:HTMLCanvasElement|undefined;
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      const finish=(error?:Error)=>{
        clearTimeout(timeout);image.onload=null;image.onerror=null;
        if(error)reject(error);else resolve();
      };
      const timeout=setTimeout(()=>finish(new Error("SVG rasterisation timed out")),30000);
      image.onload = () => finish();
      image.onerror = () => finish(new Error("Failed to rasterise SVG"));
      image.src = url;
    });
    canvas = document.createElement("canvas");
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const raster=canvas;
    return await new Promise<Blob>((resolve, reject) => {
      const timeout=setTimeout(()=>reject(new Error("PNG encoding timed out")),30000);
      try{raster.toBlob(blob=>{
        clearTimeout(timeout);
        if(blob&&blob.size>0)resolve(blob);else reject(new Error("PNG encoding failed"));
      },"image/png");}catch(error){clearTimeout(timeout);reject(error);}
    });
  } finally {
    if(canvas){canvas.width=0;canvas.height=0;}
    URL.revokeObjectURL(url);
  }
};

export const downloadPng = async (
  doc: DocumentState,
  size = 1024,
  filename = `logo-${Math.round(size)}.png`,
  options: ExportOptions = { background: true },
): Promise<void> => {
  const blob = await renderPng(doc, size, options);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
};
