import { Circle, Layers3, MousePointer2, PenLine, Sparkles, Type } from "lucide-react";
import { useStudio } from "../../store/studioStore";

const row = "flex min-h-11 w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-start text-xs text-foreground transition-colors hover:border-primary/50 hover:bg-accent";
export function StudioLayersPanel() {
  const doc = useStudio((s) => s.doc);
  const glyphId = useStudio((s) => s.selectedLetteringId);
  const selection = useStudio((s) => s.selection);
  const selectGlyph = useStudio((s) => s.selectLettering);
  const selectShapes = useStudio((s) => s.setSelection);
  const setSection = useStudio((s) => s.setWorkspaceSection);
  const letters = doc.lettering ?? [];
  const groups = new Map<string, typeof letters>();
  const standalone = letters.filter((item) => !item.groupId);
  for (const glyph of letters) {
    if (!glyph.groupId) continue;
    const group = groups.get(glyph.groupId) ?? [];
    group.push(glyph);
    groups.set(glyph.groupId, group);
  }
  const selectLetter = (id: string) => {
    selectGlyph(id);
    setSection("edit");
  };
  const selectObject = (id: string) => {
    selectShapes([id]);
    setSection("edit");
  };
  const empty = letters.length === 0 && doc.objects.length === 0;
  return (
    <div className="space-y-4 pb-5" dir="rtl">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">عناصر التصميم</h3>
        <p className="text-xs text-muted-foreground">اختر أي عنصر لتعديل مكانه وحجمه. كل حرف فيكتور قابل للتحديد منفردا.</p>
      </div>
      {empty && <div className="rounded-xl border border-dashed border-primary/30 p-4 text-center">
        <Layers3 className="mx-auto mb-2 h-7 w-7 text-primary" />
        <p className="text-sm font-semibold">مساحة التصميم فارغة</p>
        <p className="mt-1 text-xs text-muted-foreground">ابدأ بإضافة كلمة أو ارسم شكلا هندسيا.</p>
        <div className="mt-3 flex gap-2">
          <button className={row + " justify-center"} onClick={() => setSection("text")}><Type className="h-4 w-4" />كتابة</button>
          <button className={row + " justify-center"} onClick={() => setSection("draw")}><PenLine className="h-4 w-4" />رسم</button>
        </div>
      </div>}
      {groups.size > 0 && <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-xs text-muted-foreground">الكلمات المركبة</h4>
          <span className="text-xs text-muted-foreground">{groups.size}</span>
        </div>
        {[...groups].map(([groupId, glyphs], index) => (
          <details key={groupId} className="group rounded-xl border border-border bg-card" open={glyphs.some((g) => g.id === glyphId) || index === 0}>
            <summary className="cursor-pointer list-none px-3 py-3 text-sm font-medium marker:hidden">
              <span className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2"><Type className="h-4 w-4 text-primary" />
                  <span className="truncate">{glyphs[0]?.sourceText ?? "كلمة عربية"}</span></span>
                <span className="text-xs text-muted-foreground">{glyphs.length} أجزاء</span>
              </span>
            </summary>
            <div className="space-y-1 border-t border-border p-2">
              {glyphs.map((item, i) => (
                <button key={item.id} type="button" className={row + (glyphId === item.id ? " border-primary/70 bg-primary/10" : "")}
                  onClick={() => selectLetter(item.id)}>
                  <MousePointer2 className="h-4 w-4 text-primary" />
                  <span>جزء حرفي {i + 1}</span>
                  <span className="me-auto text-[11px] text-muted-foreground">تعديل</span>
                </button>
              ))}
            </div>
          </details>
        ))}
      </section>}
      {standalone.length > 0 && <section className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground">الحركات والزخارف والنصوص</h4>
        {standalone.map((item, i) => (
          <button type="button" key={item.id} className={row + (glyphId === item.id ? " border-primary/70 bg-primary/10" : "")}
            onClick={() => selectLetter(item.id)}>
            {item.kind === "ornament" || item.kind === "haraka" ? <Sparkles className="h-4 w-4 text-primary" /> : <Type className="h-4 w-4 text-primary" />}
            <span className="truncate">{item.kind === "ornament" ? "زخرفة" : item.kind === "haraka" ? "حركة تشكيل" : item.text ?? `عنصر ${i + 1}`}</span>
            <span className="me-auto text-[11px] text-muted-foreground">تعديل</span>
          </button>
        ))}
      </section>}
      {doc.objects.length > 0 && <section className="space-y-2">
        <h4 className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
          <span>الأشكال الهندسية</span><span>{doc.objects.length}</span>
        </h4>
        {doc.objects.map((item) => (
          <button type="button" key={item.id} className={row + (selection.includes(item.id) ? " border-primary/70 bg-primary/10" : "")}
            onClick={() => selectObject(item.id)}>
            <Circle className="h-4 w-4 text-primary" />
            <span className="truncate">{item.name || "شكل هندسي"}</span>
            <span className="me-auto text-[11px] text-muted-foreground">تعديل</span>
          </button>
        ))}
      </section>}
    </div>
  );
}
