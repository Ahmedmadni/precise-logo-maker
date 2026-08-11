import type { Artboard } from "../store/studioStore";

/**
 * A raster picture pinned under the grids purely as a tracing reference.
 * It is never part of the exported artwork — the logo itself always stays
 * vector geometry drawn on top of it.
 */
export interface ReferenceImage {
  /** Data URL so the picture survives save / reload with the project. */
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** 0–1. */
  opacity: number;
  visible: boolean;
  locked: boolean;
}

/** Longest edge kept when re-encoding, so autosave stays inside local storage limits. */
export const MAX_REFERENCE_PX = 1600;

const readAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the image file"));
    reader.readAsDataURL(file);
  });

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not decode the image"));
    image.src = src;
  });

const downscale = (image: HTMLImageElement, scale: number, type: string): string => {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return image.src;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(type === "image/jpeg" ? "image/jpeg" : "image/png", 0.9);
};

/** Fit a natural size inside the artboard, preserving the aspect ratio. */
export const fitToArtboard = (
  artboard: Pick<Artboard, "width" | "height">,
  naturalWidth: number,
  naturalHeight: number,
): Pick<ReferenceImage, "x" | "y" | "width" | "height"> => {
  const k = Math.min(artboard.width / naturalWidth, artboard.height / naturalHeight);
  const width = naturalWidth * k;
  const height = naturalHeight * k;
  return {
    x: (artboard.width - width) / 2,
    y: (artboard.height - height) / 2,
    width,
    height,
  };
};

/** Reads an image file into a reference layer centred on the artboard. */
export const readReferenceImage = async (
  file: File,
  artboard: Pick<Artboard, "width" | "height">,
): Promise<ReferenceImage | null> => {
  if (!file.type.startsWith("image/")) return null;
  const raw = await readAsDataUrl(file);
  const image = await loadImage(raw);
  const longest = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = longest > MAX_REFERENCE_PX ? MAX_REFERENCE_PX / longest : 1;
  const src = scale < 1 ? downscale(image, scale, file.type) : raw;
  return {
    src,
    ...fitToArtboard(artboard, image.naturalWidth, image.naturalHeight),
    opacity: 0.45,
    visible: true,
    locked: false,
  };
};
