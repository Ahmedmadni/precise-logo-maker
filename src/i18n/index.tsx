import { create } from "zustand";
import { useEffect } from "react";

export type Lang = "en" | "ar";

/**
 * Translation dictionary keyed by the English source string.
 * Keeping English as the key lets every component call t("Artboard")
 * with no key bookkeeping while still giving full Arabic coverage.
 */
export const AR: Record<string, string> = {
  // App / shell
  "Logo Grid Studio": "استوديو شبكات الشعارات",
  "Phase 7 — Drawing & Paint": "المرحلة 7 — الرسم والتلوين",
  Language: "اللغة",
  English: "English",
  Arabic: "العربية",
  Panels: "اللوحات",
  Tools: "الأدوات",
  Close: "إغلاق",
  "Install app": "تثبيت التطبيق",
  "Install the studio on this device": "تثبيت الاستوديو على هذا الجهاز",

  // Files & view
  New: "جديد",
  Open: "فتح",
  Save: "حفظ",
  Undo: "تراجع",
  Redo: "إعادة",
  "New document": "مستند جديد",
  "Open .logo project": "فتح مشروع ‎.logo",
  "Save .logo project": "حفظ مشروع ‎.logo",
  "Open project file": "فتح ملف مشروع",
  "Undo (Ctrl+Z)": "تراجع (Ctrl+Z)",
  "Redo (Ctrl+Shift+Z)": "إعادة (Ctrl+Shift+Z)",
  "Start a new document? Unsaved work is lost.": "بدء مستند جديد؟ سيتم فقدان العمل غير المحفوظ.",
  "This file is not a valid .logo project.": "هذا الملف ليس مشروع ‎.logo صالحًا.",
  "Fit artboard": "ملاءمة لوح الرسم",
  "Fit selection": "ملاءمة التحديد",
  Reset: "إعادة ضبط",
  "Reset view": "إعادة ضبط العرض",
  "Export SVG": "تصدير SVG",
  "Export PNG": "تصدير PNG",
  "PNG export size": "حجم تصدير PNG",

  // Tools
  Select: "تحديد",
  Line: "خط",
  Circle: "دائرة",
  Arc: "قوس",
  Pen: "قلم حر",
  Cells: "الخلايا",
  "Paint cells": "تلوين الخلايا",
  "Cell shape": "شكل من التقاطعات",
  Measure: "قياس",
  Pan: "تحريك",
  "Drawing tools": "أدوات الرسم",
  tool: "أداة",

  // Status bar
  Zoom: "تكبير",
  Unit: "الوحدة",
  Snap: "الالتقاط",
  Grids: "الشبكات",
  Objects: "العناصر",
  Tool: "الأداة",
  on: "مفعّل",
  off: "متوقف",

  // Panels / tabs
  Properties: "الخصائص",
  Precision: "الدقة",
  History: "السجل",
  "Studio panels": "لوحات الاستوديو",

  // Artboard
  Artboard: "لوح الرسم",
  "Swap orientation": "تبديل الاتجاه",
  Width: "العرض",
  Height: "الارتفاع",
  Background: "الخلفية",

  // Object properties
  "Select an object to edit its geometry numerically.": "اختر عنصرًا لتحرير هندسته رقميًا.",
  Delete: "حذف",
  "Center X": "مركز X",
  "Center Y": "مركز Y",
  Radius: "نصف القطر",
  Diameter: "القطر",
  "Start °": "البداية °",
  "End °": "النهاية °",
  "Stroke width": "سمك الخط",
  Stroke: "لون الخط",
  Color: "اللون",

  // Paint / styling
  Paint: "التلوين",
  Fill: "لون التعبئة",
  "Fill opacity": "شفافية التعبئة",
  Dash: "تقطيع الخط",
  "No fill": "بدون تعبئة",
  Swatches: "ألوان جاهزة",
  "Select objects to paint them.": "اختر عناصر لتلوينها.",
  "Applies to every selected object.": "يُطبَّق على كل العناصر المحددة.",
  "Pen (P) draws freehand. Paint cells (B) fills grid cells. Cell shape (N) links grid intersections into one outline — double-click or right-click to finish.":
    "قلم حر (P) للرسم اليدوي. تلوين الخلايا (B) يملأ خلايا الشبكة. شكل من التقاطعات (N) يوصّل نقاط تقاطع الشبكات في مخطط واحد — انقر مرتين أو بالزر الأيمن للإنهاء.",

  // Cell painting
  "Cell painting": "تلوين الخلايا",
  "Pick the Paint cells tool (B), then click or drag over the squares the grid lines make. Each cell becomes a real vector shape, so the logo stays after the grid is hidden.":
    "اختر أداة تلوين الخلايا (B)، ثم انقر أو اسحب فوق المربعات الناتجة من تقاطع خطوط الشبكة. كل خلية تتحول إلى شكل فيكتور حقيقي، فيبقى الشعار بعد إخفاء الشبكة.",
  Eraser: "ممحاة",
  "Eraser (X, or hold Alt)": "ممحاة (X أو مع الضغط على Alt)",
  "Hide grids": "إخفاء الشبكات",
  "Show grids": "إظهار الشبكات",
  "Show or hide every grid (G)": "إظهار أو إخفاء كل الشبكات (G)",
  "Cell color": "لون الخلية",
  "Cell opacity": "شفافية الخلية",
  "Grid to paint": "الشبكة المستهدفة",
  "Cut pieces with all grids": "تقطيع بكل الشبكات",
  "Paints the piece formed where every visible grid overlaps, not one grid's cell.":
    "يلوّن القطعة الناتجة عن تقاطع كل الشبكات الظاهرة، وليس خلية شبكة واحدة.",
  "No paintable grid": "لا توجد شبكة قابلة للتلوين",
  "Polar sectors": "القطاعات الدائرية",
  "Painted cells": "الخلايا الملوّنة",
  "Clear cells": "مسح الخلايا",
  "Square, isometric, triangular, hexagonal and concentric grids have paintable cells.":
    "الشبكات المربعة والأيزومترية والمثلثية والسداسية والمتحدة المركز تدعم تلوين الخلايا.",

  // Reference image
  "Reference image": "صورة مرجعية",
  "Place a picture under the grid to trace over": "ضع صورة تحت الشبكة للرسم فوقها",
  "Sits under the grids so you can draw on top of it. It is never part of the export.":
    "توضع أسفل الشبكات لترسم فوقها، ولا تدخل أبدًا في ملف التصدير.",
  "Insert image": "إدراج صورة",
  "Fit to artboard": "ملاءمة لوح الرسم",
  "Replace image": "استبدال الصورة",
  Remove: "إزالة",
  Visible: "ظاهرة",
  "Stretch to artboard": "تمديد على لوح الرسم",
  "Image opacity": "شفافية الصورة",
  "Pick an image file (PNG, JPG, SVG, WebP).": "اختر ملف صورة (PNG أو JPG أو SVG أو WebP).",
  "Could not load that image.": "تعذّر تحميل هذه الصورة.",

  // Trace assist
  "Trace assist": "مساعد التتبّع",
  "Draw with the Pen (P): the wobble is averaged out, and a stroke that is really a straight line or an arc becomes one.":
    "ارسم بالقلم الحر (P): تُسوّى التعرجات تلقائيًا، وإذا كان الخط في الأصل مستقيمًا أو قوسًا يتحول إليه.",
  "Smooth selection": "تسوية التحديد",
  "Re-clean the selected freehand paths": "إعادة تسوية المسارات الحرة المحددة",
  "Smooth freehand strokes": "تسوية الخطوط الحرة",
  "Recognise straight lines and arcs": "التعرّف على الخطوط المستقيمة والأقواس",
  "Smoothing strength": "قوة التسوية",
  "Smoothing passes": "مرّات التنعيم",
  "Keep corners sharper than": "حافظ على الزوايا الأحدّ من",
  "Snap strokes to the picture's lines": "مطابقة الخطوط لحواف الصورة",
  "Strokes are pulled onto the edges detected in the reference image.":
    "تُسحب الخطوط إلى الحواف المكتشفة في الصورة المرجعية.",
  "Insert a reference image to enable this.": "أدرج صورة مرجعية لتفعيل هذه الميزة.",
  "Magnet radius": "مدى الجذب",
  "Edge sensitivity": "حساسية الحواف",

  // Transform
  Transform: "التحويل",
  Duplicate: "تكرار",
  "Mirror H": "مرآة أفقية",
  "Mirror V": "مرآة رأسية",
  "Rotate °": "تدوير °",
  Apply: "تطبيق",
  "Radial repeat": "تكرار شعاعي",
  Count: "العدد",
  Repeat: "تكرار",
  "Arrow keys nudge by 1 (Shift = 10). Ctrl/Cmd+D duplicates. Drag with the Select tool to move.":
    "مفاتيح الأسهم تحرك بمقدار 1 (Shift = 10). Ctrl/Cmd+D للتكرار. اسحب بأداة التحديد للتحريك.",

  // Align
  "Align & distribute": "المحاذاة والتوزيع",
  Left: "يسار",
  Center: "مركز",
  Right: "يمين",
  Top: "أعلى",
  "Center H": "محاذاة أفقية للوسط",
  "Center V": "محاذاة رأسية للوسط",
  Bottom: "أسفل",
  "Distribute H": "توزيع أفقي",
  "Distribute V": "توزيع رأسي",
  "One object aligns to the artboard; several align to their shared bounds. Distribute needs 3+.":
    "العنصر الواحد يُحاذى إلى لوح الرسم، وعدة عناصر تُحاذى إلى حدودها المشتركة. التوزيع يحتاج 3 عناصر فأكثر.",

  // Objects list
  "Draw something to populate this list.": "ارسم شيئًا لتظهر العناصر هنا.",
  Lock: "قفل",

  // Grids
  "No grids yet.": "لا توجد شبكات بعد.",
  square: "مربعة",
  concentric: "متحدة المركز",
  radial: "شعاعية",
  isometric: "أيزومترية",
  triangular: "مثلثية",
  hexagonal: "سداسية",
  golden: "ذهبية",
  "Rotation °": "الدوران °",
  Scale: "المقياس",
  "Origin X": "الأصل X",
  "Origin Y": "الأصل Y",
  Opacity: "الشفافية",
  Spacing: "التباعد",
  Subdivisions: "التقسيمات",
  Extent: "المدى",
  "Start radius": "نصف القطر الابتدائي",
  "Radius step": "خطوة نصف القطر",
  Rays: "الأشعة",
  "Angle offset °": "إزاحة الزاوية °",
  Length: "الطول",
  "Axis angle °": "زاوية المحور °",
  "Hex size": "حجم السداسي",
  Rings: "الحلقات",
  "Flat top": "رأس مسطح",
  Steps: "الخطوات",
  "Golden spiral arcs": "أقواس اللولب الذهبي",

  // Snap
  "Smart snapping enabled": "الالتقاط الذكي مفعّل",
  "Types (priority order)": "الأنواع (حسب الأولوية)",
  Grid: "شبكة",
  Endpoint: "نقطة طرفية",
  Midpoint: "منتصف",
  Intersection: "تقاطع",
  Quadrant: "ربع الدائرة",
  "On geometry": "على الشكل",
  "Pointy-top orientation": "اتجاه رأس مدبب",
  Tangent: "مماس",
  Perpendicular: "عمودي",

  // Precision
  Constraints: "القيود",
  "Angle lock (hold Shift for temporary lock)": "قفل الزاوية (اضغط Shift للقفل المؤقت)",
  "Length step": "خطوة الطول",
  "Live readout": "قراءة حية",
  "Ratio scaling": "التحجيم بالنسب",
  "Scales the selection around its own centre.": "يُحجّم التحديد حول مركزه.",
  Measurements: "القياسات",
  Angle: "الزاوية",
  "Pick the Measure tool (M) and click two points.": "اختر أداة القياس (M) وانقر نقطتين.",

  // History
  "Current state": "الحالة الحالية",
  redo: "إعادة",
};

type LangState = {
  lang: Lang;
  setLang: (lang: Lang) => void;
};

const STORAGE_KEY = "logo-grid-studio.lang";

export const useLangStore = create<LangState>((set) => ({
  lang: "ar",
  setLang: (lang) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* storage unavailable */
    }
    set({ lang });
  },
}));

export function translate(lang: Lang, text: string): string {
  if (lang === "en") return text;
  return AR[text] ?? text;
}

/** Returns a translate function bound to the active language. */
export function useT() {
  const lang = useLangStore((s) => s.lang);
  return (text: string) => translate(lang, text);
}

export function useLang() {
  return useLangStore((s) => s.lang);
}

export function useDir(): "rtl" | "ltr" {
  return useLangStore((s) => (s.lang === "ar" ? "rtl" : "ltr"));
}

/** Restores the saved language and keeps <html lang/dir> in sync. */
export function useLanguageBootstrap() {
  const lang = useLangStore((s) => s.lang);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "ar") useLangStore.setState({ lang: saved });
    } catch {
      /* storage unavailable */
    }
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);
  return lang;
}
