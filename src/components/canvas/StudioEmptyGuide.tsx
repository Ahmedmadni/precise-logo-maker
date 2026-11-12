import { PenLine, Type } from "lucide-react";
import { useStudio } from "../../store/studioStore";

export function StudioEmptyGuide({ openPanel }: { openPanel: () => void }) {
  const doc = useStudio((s) => s.doc);
  const tool = useStudio((s) => s.tool);
  const setSection = useStudio((s) => s.setWorkspaceSection);
  const setTool = useStudio((s) => s.setTool);
  if (doc.objects.length > 0 || (doc.lettering?.length ?? 0) > 0 || tool !== "select") return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-4" dir="rtl">
      <div className="pointer-events-auto w-full max-w-[320px] rounded-2xl border border-primary/25 bg-card/95 p-5 text-center shadow-xl backdrop-blur-sm">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 font-serif text-2xl text-primary">ش</div>
        <h2 className="mt-3 text-base font-bold text-foreground">ابدأ تصميم شعارك</h2>
        <p className="mt-2 text-xs leading-6 text-muted-foreground">اكتب اسما بالعربية، أو ارسم شكلا فيكتور. يمكنك تعديل كل حرف وإضافة التشكيل والزخارف بعد ذلك.</p>
        <button type="button" onClick={() => { setSection("text"); openPanel(); }}
          className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground">
          <Type className="h-5 w-5" /> كتابة شعار عربي
        </button>
        <button type="button" onClick={() => { setTool("select"); setSection("draw"); openPanel(); }}
          className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-xs text-foreground">
          <PenLine className="h-4 w-4" /> الرسم الفيكتور
        </button>
      </div>
    </div>
  );
}
