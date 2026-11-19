import { Capacitor, registerPlugin } from "@capacitor/core";
import type { DocumentState } from "../store/studioStore";
import { buildSvgDocument, renderPng, type ExportOptions } from "../objects/export";
import { parseProject, serializeProject } from "../objects/project";

interface NativeDocumentsBridge {
  saveFile(input: { filename: string; mimeType: string; base64: string }): Promise<{ saved?: boolean; cancelled?: boolean }>;
  openProject(): Promise<{ content?: string; cancelled?: boolean }>;
}
const documents = registerPlugin<NativeDocumentsBridge>("NativeDocuments");

/** Browser preview keeps the existing browser download/open path. */
export function nativeDocumentsAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}
function requireAndroid(): void {
  if (!nativeDocumentsAvailable()) throw new Error("Android document picker is unavailable");
}
async function blobToBase64(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("File encoding failed"));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("File encoding failed"));
        return;
      }
      const offset = reader.result.indexOf(",");
      if (offset < 0) {
        reject(new Error("Invalid encoded file"));
        return;
      }
      resolve(reader.result.slice(offset + 1));
    };
    reader.readAsDataURL(blob);
  });
}
async function saveBlob(blob: Blob, filename: string, mimeType: string): Promise<boolean> {
  requireAndroid();
  if (blob.size > 32 * 1024 * 1024) throw new Error("File exceeds 32 MiB Android export limit");
  const response = await documents.saveFile({ filename, mimeType, base64: await blobToBase64(blob) });
  if (response.cancelled) return false;
  if (!response.saved) throw new Error("Android did not confirm the save");
  return true;
}
export async function saveAndroidProject(doc: DocumentState): Promise<boolean> {
  return saveBlob(new Blob([serializeProject(doc)], { type: "application/json" }), "design.logo", "application/json");
}
export async function exportAndroidSvg(doc: DocumentState, filename: string, options: ExportOptions): Promise<boolean> {
  return saveBlob(new Blob([buildSvgDocument(doc, options)], { type: "image/svg+xml" }), filename, "image/svg+xml");
}
export async function exportAndroidPng(doc: DocumentState, size: number, filename: string, options: ExportOptions): Promise<boolean> {
  return saveBlob(await renderPng(doc, size, options), filename, "image/png");
}
export async function openAndroidProject(): Promise<DocumentState | null> {
  requireAndroid();
  const result = await documents.openProject();
  if (result.cancelled) return null;
  if (typeof result.content !== "string") throw new Error("Android returned no project data");
  const doc = parseProject(result.content);
  if (!doc) throw new Error("Invalid .logo project");
  return doc;
}
