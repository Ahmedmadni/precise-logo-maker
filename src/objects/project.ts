import type { DocumentState } from "../store/studioStore";

export const PROJECT_FORMAT = "logo-grid-studio";
export const PROJECT_VERSION = 1;
export const AUTOSAVE_KEY = "logo-grid-studio:autosave";

export interface ProjectFile {
  format: typeof PROJECT_FORMAT;
  version: number;
  savedAt: string;
  document: DocumentState;
}

export const serializeProject = (doc: DocumentState): string =>
  JSON.stringify(
    {
      format: PROJECT_FORMAT,
      version: PROJECT_VERSION,
      savedAt: new Date().toISOString(),
      document: doc,
    } satisfies ProjectFile,
    null,
    2,
  );

/** Parses a `.logo` payload, returning null when the shape is not recognised. */
export const parseProject = (raw: string): DocumentState | null => {
  try {
    const data = JSON.parse(raw) as Partial<ProjectFile>;
    if (data.format !== PROJECT_FORMAT) return null;
    const doc = data.document;
    if (!doc || !doc.artboard || !Array.isArray(doc.objects) || !Array.isArray(doc.grids)) {
      return null;
    }
    return doc as DocumentState;
  } catch {
    return null;
  }
};

const download = (content: BlobPart, type: string, filename: string): void => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const downloadProject = (doc: DocumentState, filename = "design.logo"): void =>
  download(serializeProject(doc), "application/json", filename);

export const readProjectFile = async (file: File): Promise<DocumentState | null> =>
  parseProject(await file.text());

export const saveAutosave = (doc: DocumentState): void => {
  try {
    window.localStorage.setItem(AUTOSAVE_KEY, serializeProject(doc));
  } catch {
    /* storage unavailable — autosave is best effort */
  }
};

export const loadAutosave = (): DocumentState | null => {
  try {
    const raw = window.localStorage.getItem(AUTOSAVE_KEY);
    return raw ? parseProject(raw) : null;
  } catch {
    return null;
  }
};

export const clearAutosave = (): void => {
  try {
    window.localStorage.removeItem(AUTOSAVE_KEY);
  } catch {
    /* ignore */
  }
};
