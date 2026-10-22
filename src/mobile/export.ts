import { buildSvgDocument, renderPng } from "../objects/export";
import { serializeProject } from "../objects/project";
import type { DocumentState } from "../store/studioStore";

/**
 * Browsers download files; Android uses a temporary app-cache file and the native
 * share sheet (so the user can choose Files, Drive, messages, etc.).
 * No storage permission and no server upload are required.
 */
export async function exportBlob(blob: Blob, filename: string): Promise<void> {
  const { Capacitor } = await import("@capacitor/core");
  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
      import("@capacitor/filesystem"),
      import("@capacitor/share"),
    ]);
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error ?? new Error("Cannot read export"));
      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== "string") return reject(new Error("Invalid data URL"));
        resolve(result.slice(result.indexOf(",") + 1));
      };
      reader.readAsDataURL(blob);
    });
    await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache });
    const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
    await Share.share({ title: filename, files: [uri], dialogTitle: "Save or share design" });
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking immediately can cancel a download in some mobile browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportProject(doc: DocumentState): Promise<void> {
  return exportBlob(new Blob([serializeProject(doc)], { type: "application/json" }), "design.logo");
}

export function exportSvg(doc: DocumentState): Promise<void> {
  return exportBlob(new Blob([buildSvgDocument(doc)], { type: "image/svg+xml" }), "logo.svg");
}

export async function exportPng(doc: DocumentState, width: number): Promise<void> {
  const blob = await renderPng(doc, width);
  await exportBlob(blob, `logo-${width}.png`);
}
