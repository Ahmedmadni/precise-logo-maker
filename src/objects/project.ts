import type { DocumentState } from "../store/studioStore";
import { combineGlyphLibrary } from "../calligraphy/glyphLibrary";

export const PROJECT_FORMAT = "logo-grid-studio";
export const PROJECT_VERSION = 2; // v1 projects remain readable
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
    if (data.format !== PROJECT_FORMAT || !Number.isInteger(data.version) || data.version!<1 || data.version! > PROJECT_VERSION) return null;
    const doc = data.document;
    if (!doc || !doc.artboard || !Array.isArray(doc.objects) || !Array.isArray(doc.grids)) {
      return null;
    }
    if(![doc.artboard.width,doc.artboard.height].every(n=>Number.isFinite(n)&&n>0))return null;
    if(doc.lettering!==undefined&&(!Array.isArray(doc.lettering)||doc.lettering.some(i=>!i||typeof i.id!=="string"||!["outline","text","haraka","ornament","bridge"].includes(i.kind)||![i.x,i.y,i.size,i.rotation].every(Number.isFinite)||typeof i.color!=="string")))return null;
    const validPoint=(p:unknown):boolean=>!!p&&typeof p==="object"&&"x" in p&&"y" in p&&typeof p.x==="number"&&typeof p.y==="number"&&Number.isFinite(p.x)&&Number.isFinite(p.y);
    for(const object of doc.objects){
      if(!object||typeof object.id!=="string"||typeof object.name!=="string"||!object.style||typeof object.style.stroke!=="string"||typeof object.style.fill!=="string"||!Number.isFinite(object.style.strokeWidth)||!object.geometry)return null;
      const g=object.geometry;
      switch(g.kind){
        case "line":if(!validPoint(g.a)||!validPoint(g.b))return null;break;
        case "arc":if(![g.startAngle,g.endAngle].every(Number.isFinite)||!validPoint(g.center)||!Number.isFinite(g.radius)||g.radius<0)return null;break;
        case "circle":if(!validPoint(g.center)||!Number.isFinite(g.radius)||g.radius<0)return null;break;
        case "path":if(!Array.isArray(g.points)||g.points.length>50000||!g.points.every(validPoint)||typeof g.closed!=="boolean"||g.cubicSegments!==undefined&&(!Array.isArray(g.cubicSegments)||g.cubicSegments.length>g.points.length||g.cubicSegments.some(seg=>seg!==null&&(!seg||!validPoint(seg.control1)||!validPoint(seg.control2)))))return null;break;
        default:return null;
      }
    }
    // Compound paths have a stricter shape contract: never restore malformed
    // inner rings into the renderer or pathfinder.
    for(const object of doc.objects){
      const geometry=object?.geometry;
      if(geometry?.kind!=="path"||geometry.holes===undefined)continue;
      const validRing=(ring:unknown):boolean=>Array.isArray(ring)&&ring.length>=3&&ring.length<=50000&&ring.every(p=>p&&typeof p==="object"&&Number.isFinite(p.x)&&Number.isFinite(p.y));
      if(!geometry.closed||!validRing(geometry.points)||!Array.isArray(geometry.holes)||geometry.holes.length>1000||!geometry.holes.every(validRing))return null;
      if(geometry.points.length+geometry.holes.reduce((sum,r)=>sum+r.length,0)>50000)return null;
    }
    // Treat a .logo file as untrusted too. A malformed bundled library
    // could otherwise enter the editor without the explicit JSON importer.
    if (doc.glyphLibrary !== undefined &&
      (!Array.isArray(doc.glyphLibrary) || !combineGlyphLibrary([], doc.glyphLibrary))) {
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
  setTimeout(()=>URL.revokeObjectURL(url),1000);
};

export const downloadProject = (doc: DocumentState, filename = "design.logo"): void =>
  download(serializeProject(doc), "application/json", filename);

export const readProjectFile = async (file: File): Promise<DocumentState | null> =>
  parseProject(await file.text());

export type AutosaveQuality="full"|"drawing-only"|"failed";
export const autosavePayload=(doc:DocumentState,savedAt=new Date().toISOString(),partial=false):string=>JSON.stringify({format:PROJECT_FORMAT,version:PROJECT_VERSION,savedAt,document:doc,partial});
export const saveAutosave = (doc: DocumentState, payload=autosavePayload(doc), savedAt?:string): AutosaveQuality => {
  try {
    window.localStorage.setItem(AUTOSAVE_KEY, payload);
    return "full";
  } catch {
    // A large reference picture can blow the storage quota. The drawing matters
    // more than the tracing aid, so retry without it before giving up.
    try {
      window.localStorage.setItem(AUTOSAVE_KEY, autosavePayload({ ...doc, reference: null },savedAt,true));
      return "drawing-only";
    } catch {
      return "failed";
    }
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

/**
 * Large outline projects and embedded licensed fonts can exceed localStorage's
 * quota. IndexedDB is browser/WebView-local storage, not a cloud database.
 */
const DB_NAME = "logo-grid-studio-local";
const DB_STORE = "autosave";
let dbPromise: Promise<IDBDatabase | null> | undefined;
const openLocalDb = (): Promise<IDBDatabase | null> => {
  if (dbPromise) return dbPromise;
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  const attempt = new Promise<IDBDatabase | null>((resolve) => {
    let settled=false;
    const finish=(db:IDBDatabase|null)=>{
      if(settled){db?.close();return;}
      settled=true;resolve(db);
    };
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
      };
      request.onsuccess = () => {
        const db=request.result;
        db.onversionchange=()=>{db.close();if(dbPromise===attempt)dbPromise=undefined;};
        db.onclose=()=>{if(dbPromise===attempt)dbPromise=undefined;};
        finish(db);
      };
      request.onerror = () => finish(null);
      request.onblocked = () => finish(null);
    } catch { finish(null); }
  });
  dbPromise=attempt;
  void attempt.then(db=>{if(!db&&dbPromise===attempt)dbPromise=undefined;});
  return attempt;
};

export const saveLargeAutosave = async (doc: DocumentState,payload=autosavePayload(doc)): Promise<boolean> => {
  const db = await openLocalDb();
  if (!db) return false;
  return await new Promise<boolean>((resolve) => {
    try {
      const tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).put(payload, AUTOSAVE_KEY);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
};

export interface SavedSnapshot {
  document: DocumentState;
  savedAt: string;
  partial?: boolean;
}
/** Prefer complete snapshots over reduced snapshots with identical timestamps. */
export function preferLargeSnapshot(local:SavedSnapshot|null,large:SavedSnapshot|null):boolean{
  if(!large)return false;
  if(!local)return true;
  const stamp=(v:string)=>{const n=Date.parse(v);return Number.isFinite(n)?n:0;};
  return stamp(large.savedAt)>stamp(local.savedAt)||(stamp(large.savedAt)===stamp(local.savedAt)&&local.partial===true&&large.partial!==true);
}
const parsedSnapshot = (raw: string | null): SavedSnapshot | null => {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<ProjectFile>&{partial?:boolean};
    const document = parseProject(raw);
    if (!document) return null;
    return { document, savedAt: typeof data.savedAt==="string"?data.savedAt:"", partial:data.partial===true };
  } catch { return null; }
};
export const readLocalSnapshot = (): SavedSnapshot | null => {
  try { return parsedSnapshot(window.localStorage.getItem(AUTOSAVE_KEY)); }
  catch { return null; }
};
export const loadLargeAutosave = async (): Promise<SavedSnapshot | null> => {
  const db = await openLocalDb();
  if (!db) return null;
  return await new Promise((resolve) => {
    try {
      const tx = db.transaction(DB_STORE, "readonly");
      const request = tx.objectStore(DB_STORE).get(AUTOSAVE_KEY);
      request.onsuccess = () => resolve(parsedSnapshot(typeof request.result === "string" ? request.result : null));
      request.onerror = () => resolve(null);
      tx.onabort = () => resolve(null);
    } catch { resolve(null); }
  });
};
