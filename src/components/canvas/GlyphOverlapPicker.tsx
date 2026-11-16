import { ChevronLeft, Layers3, X } from "lucide-react";
import type { LetteringItem } from "../../calligraphy/model";

export function GlyphOverlapPicker({ items, currentId, onNext, onDismiss }: {
  items: LetteringItem[];
  currentId: string | null;
  onNext: () => void;
  onDismiss: () => void;
}) {
  if (items.length < 2) return null;
  const index = Math.max(0, items.findIndex((item) => item.id === currentId));
  const chosen = items[index];
  const name = chosen?.sourceText || (chosen?.kind === "haraka" ? "حركة تشكيل"
    : chosen?.kind === "ornament" ? "زخرفة" : "عنصر عربي");
  return (
    <div dir="rtl" role="group" aria-label="اختيار العناصر المتداخلة"
      className="absolute left-1/2 top-3 z-30 flex max-w-[95%] -translate-x-1/2 items-center gap-2 rounded-xl border border-primary/40 bg-card/95 px-2 py-1.5 text-foreground shadow-lg backdrop-blur-sm"
      onPointerDown={(e) => e.stopPropagation()}>
      <Layers3 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <div className="min-w-0 text-xs">
        <p className="truncate font-semibold">عناصر متداخلة: {index + 1} من {items.length}</p>
        <p className="max-w-32 truncate text-[11px] text-muted-foreground">{name}</p>
      </div>
      <button type="button" onClick={onNext} aria-label="تحديد العنصر التالي من العناصر المتداخلة"
        className="flex min-h-11 items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-2 text-xs font-semibold text-primary">
        التالي <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </button>
      <button type="button" onClick={onDismiss} aria-label="إغلاق اختيار العناصر المتداخلة"
        className="flex h-11 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent">
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
