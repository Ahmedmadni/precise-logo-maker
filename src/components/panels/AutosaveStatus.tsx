import {useStudio} from "../../store/studioStore";
import {AlertTriangle,Check,Clock} from "lucide-react";

export function AutosaveStatus(){
  const state=useStudio(s=>s.autosaveStatus);
  if(state==="idle")return null;
  const warning=state==="partial"||state==="failed";
  const message=state==="failed"?"تعذر الحفظ المحلي — صدّر نسخة .logo قبل الإغلاق":state==="partial"?"حُفظ الرسم دون الصورة المرجعية — صدّر نسخة .logo":state==="checking"?"جارٍ فحص الحفظ المحلي":state==="pending"?"الحفظ المحلي قيد التنفيذ":"تم الحفظ محليًا";
  const Icon=warning?AlertTriangle:state==="saved"?Check:Clock;
  return <div dir="rtl" role="status" aria-live="polite" className={`flex shrink-0 items-center gap-1.5 border-b border-border px-2 py-1 text-[10px] ${warning?"text-destructive":"text-muted-foreground"}`}>
    <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true"/><span>{message}</span>
  </div>;
}
