import { useEffect, useRef, useState } from "react";
import { Type, Trash2 } from "lucide-react";
import { FONT_PRESETS, HARAKAT, createLettering, fontFamily, type FontPreset } from "../../calligraphy/model";
import { useStudio } from "../../store/studioStore";
import { useT } from "../../i18n";

const field = "w-full min-h-10 rounded-md border border-border bg-background px-2 text-sm text-foreground";
export function LetteringPanel() {
  const t = useT();
  const doc = useStudio((s) => s.doc);
  const selectedId = useStudio((s) => s.selectedLetteringId);
  const select = useStudio((s) => s.selectLettering);
  const insert = useStudio((s) => s.addLettering);
  const update = useStudio((s) => s.updateLettering);
  const remove = useStudio((s) => s.deleteLettering);
  const [fontError, setFontError] = useState("");
  const fontInput = useRef<HTMLInputElement>(null);
  const item = (doc.lettering ?? []).find((entry) => entry.id === selectedId);
  const fontData = doc.customThuluthFont;
  useEffect(() => {
    if (!fontData || typeof FontFace === "undefined") return;
    let disposed = false;
    const face = new FontFace("Custom Thuluth", `url("${fontData}")`);
    void face.load().then((loaded) => {
      if (!disposed) document.fonts.add(loaded);
    }).catch(() => { if (!disposed) setFontError(t("Could not load that font.")); });
    return () => { disposed = true; };
  }, [fontData, t]);

  const addText = () => {
    const newItem = createLettering(doc.artboard.width / 2, doc.artboard.height / 2);
    insert(newItem);
  };

  const uploadFont = async (file?: File) => {
    if (!file) return;
    setFontError("");
    if (!/\.(ttf|otf|woff2?)$/i.test(file.name) || file.size > 1_500_000) {
      setFontError(t("Choose a licensed TTF/OTF/WOFF font under 1.5 MB."));
      return;
    }
    const url = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("font read error"));
      reader.readAsDataURL(file);
    });
    useStudio.getState().setCustomThuluthFont(url);
    if (item?.kind === "text") update(item.id, { font: "Custom Thuluth" });
  };

  return (
    <div className="space-y-4 text-xs">
      <section className="space-y-2">
        <h2 className="font-semibold text-foreground">{t("Arabic lettering")}</h2>
        <p className="text-muted-foreground">{t("Add editable Arabic lettering, then place separate vector diacritics precisely.")}</p>
        <button type="button" className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 font-semibold text-primary-foreground" onClick={addText}>
          <Type className="h-4 w-4" /> {t("Add Arabic text")}
        </button>
      </section>
      <section className="space-y-2">
        <h3 className="font-semibold text-foreground">{t("Diacritic ornaments")}</h3>
        <div className="grid grid-cols-4 gap-1.5">
          {HARAKAT.map((mark) => (
            <button type="button" key={mark.id} title={mark.label} aria-label={mark.label}
              className="min-h-11 rounded-md border border-border bg-background text-xl hover:bg-accent"
              onClick={() => insert({
                id: `mark-${crypto.randomUUID()}`, kind: "haraka", mark: mark.id,
                x: (item?.x ?? doc.artboard.width / 2), y: (item?.y ?? doc.artboard.height / 2) - 70,
                size: 32, rotation: 0, color: item?.color ?? "#e8eaf0",
              })}>
              {mark.glyph}
            </button>
          ))}
        </div>
      </section>
      <section className="space-y-2">
        <h3 className="font-semibold text-foreground">{t("Lettering elements")}</h3>
        <select value={item?.id ?? ""} onChange={(e) => select(e.target.value || null)} className={field} aria-label={t("Lettering elements")}>
          <option value="">{t("Choose an element")}</option>
          {(doc.lettering ?? []).map((entry) => <option value={entry.id} key={entry.id}>
            {entry.kind === "text" ? entry.text : HARAKAT.find((m) => m.id === entry.mark)?.label}
          </option>)}
        </select>
        {item && (
          <>
            {item.kind === "text" && (
              <>
                <label className="block space-y-1"><span>{t("Text")}</span>
                  <textarea className={field + " min-h-20 py-2"} dir="rtl" maxLength={300}
                    value={item.text ?? ""} onChange={(e) => update(item.id, { text: e.target.value })} />
                </label>
                <label className="block space-y-1"><span>{t("Font")}</span>
                  <select className={field} value={item.font ?? "Amiri"} onChange={(e) => update(item.id, { font: e.target.value as FontPreset })}>
                    {FONT_PRESETS.map((font) => <option value={font} key={font}>{font}</option>)}
                  </select>
                </label>
                <p dir="rtl" className="rounded-md border border-border px-2 py-3 text-center text-xl" style={{ fontFamily: fontFamily(item.font) }}>
                  {item.text}
                </p>
              </>
            )}
            <div className="grid grid-cols-2 gap-2">
              {(["x", "y", "size", "rotation"] as const).map((key) => (
                <label key={key} className="space-y-1"><span>{key === "size" ? t("Size") : key === "rotation" ? t("Rotation") : key.toUpperCase()}</span>
                  <input type="number" className={field} value={item[key]} min={key === "size" ? 1 : undefined}
                    onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) update(item.id, { [key]: key === "size" ? Math.max(1, Math.min(1000, v)) : v }); }} />
                </label>
              ))}
            </div>
            <label className="flex items-center gap-2">{t("Color")}
              <input type="color" value={item.color} onChange={(e) => update(item.id, { color: e.target.value })} className="h-10 w-16" />
            </label>
            <button type="button" className="flex min-h-10 items-center gap-2 rounded-md border border-destructive px-3 text-destructive" onClick={() => remove(item.id)}>
              <Trash2 className="h-4 w-4" /> {t("Delete")}
            </button>
          </>
        )}
      </section>
      <section className="space-y-2 border-t border-border pt-3">
        <h3 className="font-semibold">{t("Custom Thuluth font")}</h3>
        <p className="text-muted-foreground">{t("Import your licensed Thuluth font. The font will be stored in the project, but text is not converted to glyph outlines.")}</p>
        <input ref={fontInput} type="file" accept=".ttf,.otf,.woff,.woff2" className="hidden"
          onChange={(e) => { void uploadFont(e.target.files?.[0]); e.target.value = ""; }} />
        <button type="button" className="min-h-10 rounded-md border border-border px-3" onClick={() => fontInput.current?.click()}>
          {t("Import font")}
        </button>
        {fontError && <p role="alert" className="text-destructive">{fontError}</p>}
      </section>
    </div>
  );
}
