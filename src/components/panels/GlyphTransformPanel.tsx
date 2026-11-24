import { useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Copy, RotateCcw, Trash2, Move, PencilRuler, Waypoints, Shapes } from "lucide-react";
import type { LetteringItem } from "../../calligraphy/model";
import { adjustOutlineRegionWidth, morphGlyphPixels, type MorphDirection, type MorphProfile, type MorphRegion } from "../../calligraphy/morph";
import { moveOutlineNodeWithHandles, outlineNodes } from "../../calligraphy/pathEditor";
import { moveLinkedCubicControl } from "../../calligraphy/handleCoupling";
import { CubicHandleLinkControls } from "./CubicHandleLinkControls";
import { useStudio, type GlyphInspectorTab } from "../../store/studioStore";
import { AlternateBrowser } from "./AlternateBrowser";
import { GlyphLibraryPanel } from "./GlyphLibraryPanel";
import { GlyphContoursJoinPanel } from "./GlyphContoursJoinPanel";
import { GlyphAnchorInspector } from "./GlyphAnchorInspector";
import { GlyphNodeTopologyActions } from "./GlyphNodeTopologyActions";

const button = "inline-flex min-h-11 items-center justify-center gap-1 rounded-lg border border-border bg-secondary px-2 text-xs text-foreground hover:bg-accent active:scale-[.98] disabled:opacity-40";
const input = "min-h-11 w-full rounded-lg border border-border bg-background px-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-primary";
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
type SliderKey = "scaleX" | "scaleY" | "skewX" | "skewY" | "rotation" | "weight";
const directions: { key: MorphDirection; label: string; icon: typeof ArrowRight }[] = [
  { key: "right", label: "مد لليمين", icon: ArrowRight },
  { key: "left", label: "مد لليسار", icon: ArrowLeft },
  { key: "up", label: "مد لأعلى", icon: ArrowUp },
  { key: "down", label: "مد لأسفل", icon: ArrowDown },
];

export function GlyphTransformPanel({ selected, siblings }: {
  selected: LetteringItem;
  siblings: LetteringItem[];
}) {
  const update = useStudio((s) => s.updateLettering);
  const moveGroup = useStudio((s) => s.moveLetteringGroup);
  const remove = useStudio((s) => s.deleteLettering);
  const duplicate = useStudio((s) => s.duplicateLettering);
  const reorder = useStudio((s) => s.reorderLettering);
  const toggleBakedVersion = useStudio((s) => s.toggleBakedVersion);
  const editNodes = useStudio((s) => s.editGlyphNodes);
  const setEditNodes = useStudio((s) => s.setEditGlyphNodes);
  const selectedNode = useStudio((s) => s.selectedGlyphNodeId);
  const showAllNodes = useStudio((s) => s.showAllGlyphNodes);
  const moveNodeHandles = useStudio((s) => s.moveGlyphNodeHandles);
  const controlLinkMode = useStudio((s) => s.controlLinkMode);
  const setMoveNodeHandles = useStudio((s) => s.setMoveGlyphNodeHandles);
  const setShowAllNodes = useStudio((s) => s.setShowAllGlyphNodes);
  const setSelectedNode = useStudio((s) => s.setSelectedGlyphNodeId);
  const moveScope = useStudio((s) => s.letteringMoveScope);
  const setMoveScope = useStudio((s) => s.setLetteringMoveScope);
  const preview = useStudio((s) => s.letteringPreview);
  const setPreview = useStudio((s) => s.setLetteringPreview);
  const commitPreview = useStudio((s) => s.commitLetteringPreview);
  const [step, setStep] = useState(5);
  const [showAdvancedCoordinates, setShowAdvancedCoordinates] = useState(false);
  const storedTab = useStudio((s) => s.glyphInspectorTab);
  const setInspectorTab = useStudio((s) => s.setGlyphInspectorTab);
  const [direction, setDirection] = useState<MorphDirection>("right");
  const [extension, setExtension] = useState(0);
  const [regionWidth, setRegionWidth] = useState(100);
  const [morphProfile, setMorphProfile] = useState<MorphProfile>("gradual");
  const [morphRegion, setMorphRegion] = useState<MorphRegion>("whole");
  const isOutline = selected.kind === "outline" && !!selected.pathData;
  const isCatalogSymbol = isOutline && !!selected.catalogShapeId;
  // When a movement/mark/symbol is selected, do not show inapplicable tools.
  // Preserve the preferred workflow so the next regular glyph returns to it.
  const activeTab: GlyphInspectorTab = !isOutline ||
    (isCatalogSymbol && storedTab !== "basic" && storedTab !== "paths")
    ? "basic" : storedTab;
  const tabs = [
    { id: "basic" as const, label: "أساسي", icon: Move, detail: "التحريك والحجم واللون" },
    ...(isOutline ? [
      { id: "paths" as const, label: "المسارات", icon: PencilRuler, detail: "المد والنقاط والأجزاء" },
      ...(!isCatalogSymbol ? [
        { id: "joins" as const, label: "الوصلات", icon: Waypoints, detail: "الدخول والخروج" },
        { id: "alternates" as const, label: "البدائل", icon: Shapes, detail: "أشكال الخط المتاحة" },
      ] : []),
    ] : []),
  ];
  const changeTab = (next: GlyphInspectorTab) => {
    if (next !== activeTab) setInspectorTab(next);
  };
  const pending = preview?.id === selected.id ? preview.patch : {};
  const currentPath = pending.pathData ?? selected.pathData ?? "";
  const nodes = isOutline ? outlineNodes(currentPath).slice(0, 350) : [];
  const node = nodes.find((n) => n.id === selectedNode) ?? null;
  const sliderValue = (key: SliderKey) =>
    Number(pending[key] ?? selected[key] ?? (key === "scaleX" || key === "scaleY" ? 1 : 0));

  const previewValue = (key: SliderKey, val: number) => {
    setPreview(selected.id, { ...pending, [key]: val });
  };
  const nudge = (dx: number, dy: number) => {
    commitPreview();
    if (moveScope === "word" && selected.groupId) {
      moveGroup(selected.groupId, dx, dy);
    } else {
      update(selected.id, { x: selected.x + dx, y: selected.y + dy });
    }
  };
  const previewStretch = (value: number, chosenDirection = direction) => {
    if (!isOutline) return;
    setExtension(value);
    const path = morphGlyphPixels(selected, chosenDirection, value, morphProfile, morphRegion);
    if (path) setPreview(selected.id, { ...pending, pathData: path });
  };
  const finishStretch = () => {
    commitPreview();
    setExtension(0);
  };
  const previewRegionWidth = (value: number) => {
    if (!isOutline || !selected.pathData) return;
    const path = adjustOutlineRegionWidth(selected.pathData, direction, value / 100, morphRegion);
    if (path) { setRegionWidth(value); setPreview(selected.id, { ...pending, pathData: path }); }
  };
  const finishRegionWidth = () => { commitPreview(); setRegionWidth(100); };
  const setNodeCoordinate = (axis: "x" | "y", val: number) => {
    if (!node || !isOutline || !Number.isFinite(val)) return;
    commitPreview();
    const x = axis === "x" ? val : node.x;
    const y = axis === "y" ? val : node.y;
    const next = node.role === "control" && controlLinkMode !== "free"
      ? moveLinkedCubicControl(selected.pathData!, node.id, x, y, controlLinkMode)
        ?? moveOutlineNodeWithHandles(selected.pathData!, node.id, x, y, moveNodeHandles)
      : moveOutlineNodeWithHandles(selected.pathData!, node.id, x, y, moveNodeHandles);
    if (next) update(selected.id, { pathData: next });
  };
  return (
    <section className="space-y-4 rounded-xl border border-primary/40 bg-background p-3 text-sm" dir="rtl">
      <header className="space-y-1">
        <h3 className="font-semibold">{isCatalogSymbol ? "تحرير شكل خطاطي مستقل" : selected.kind === "outline" ? "تحرير الحرف المحدد" : selected.kind === "haraka" ? "تحرير حركة التشكيل" : selected.kind === "ornament" ? "تحرير الزخرفة" : "تحرير النص"}</h3>
        <p className="text-[11px] leading-5 text-muted-foreground">
          {isCatalogSymbol ? "هذا الشكل مسار SVG مستقل: عدّل حجمه وزاويته ونقاطه واحفظه في مكتبتك. لا يعتمد على بدائل OpenType أو وصلات الحروف." :
            isOutline ? "اختر نوع التعديل من الأدوات التالية. لن تُعرض أدوات الخط الدقيقة كلها دفعة واحدة." :
            "غيّر الموضع والحجم واللون، أو اسحب العنصر مباشرة على اللوحة."}
        </p>
      </header>
      <nav aria-label="أدوات تحرير العنصر" className={`grid gap-1.5 ${isCatalogSymbol ? "grid-cols-2" : isOutline ? "grid-cols-4" : "grid-cols-1"}`}>
        {tabs.map(({ id, label, icon: Icon, detail }) => (
          <button type="button" key={id} aria-pressed={activeTab === id} title={detail}
            onClick={() => changeTab(id)}
            className={`${button} flex min-h-[62px] min-w-0 flex-col gap-1 px-1 text-[11px] ${activeTab === id ? "border-primary bg-primary/15 font-semibold text-primary" : ""}`}>
            <Icon className="h-5 w-5 shrink-0" aria-hidden="true" /><span>{label}</span>
          </button>
        ))}
      </nav>
      {activeTab !== "basic" && <p className="text-xs leading-5 text-muted-foreground">{tabs.find((tab) => tab.id === activeTab)?.detail}</p>}
      {selected.bakedSourceIds?.length ? (
        <div className="space-y-2 rounded-xl border border-primary/40 bg-primary/5 p-3">
          <p className="text-xs font-semibold">نسخة فيكتور موحدة</p>
          <p className="text-[11px] leading-5 text-muted-foreground">
            هذا شكل ناتج عن دمج الوصلة والحرفين. الأصول محفوظة في المشروع
            ويمكن استعادتها لمتابعة تحرير نقاط Bézier والاتصالات.
          </p>
          <button type="button"
            className="min-h-11 w-full rounded-lg border border-primary/40 bg-background px-3 text-xs font-semibold text-primary"
            onClick={() => toggleBakedVersion(selected.id)}>
            {selected.hidden ? "عرض النسخة الموحدة وإخفاء الأصول" : "استعادة الحروف والوصلة الأصلية"}
          </button>
        </div>
      ) : null}
      {activeTab === "basic" && <>
      <details open className="rounded-lg border border-border p-3">
        <summary className="cursor-pointer text-xs font-bold">تحريك العنصر والموضع</summary>
        <div className="mt-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          {(["glyph", "word"] as const).map((scope) => (
            <button key={scope} type="button" onClick={() => setMoveScope(scope)}
              disabled={scope === "word" && !selected.groupId}
              className={`${button} ${scope === moveScope ? "border-primary bg-primary/15 text-foreground" : ""}`}>
              {scope === "glyph" ? "تحريك الحرف فقط" : "تحريك الكلمة كاملة"}
            </button>
          ))}
        </div>
        <p className="text-[11px] leading-5 text-muted-foreground">
          اختر وضع التحريك ثم اسحب العنصر على مساحة الرسم، أو استخدم أسهم الإزاحة الدقيقة.
        </p>
        <label className="flex items-center justify-between gap-3 text-xs">
          مقدار الحركة لكل ضغطة
          <select className={input + " max-w-28"} value={step} onChange={(e) => setStep(Number(e.target.value))}>
            {[1, 2, 5, 10, 25, 50].map((n) => <option key={n} value={n}>{n} px</option>)}
          </select>
        </label>
        <div className="grid grid-cols-4 gap-2">
          {([[ArrowRight, 1, 0, "يمين"], [ArrowLeft, -1, 0, "يسار"], [ArrowUp, 0, -1, "أعلى"], [ArrowDown, 0, 1, "أسفل"]] as const)
            .map(([Icon, dx, dy, label]) => (
              <button key={label} type="button" title={label} aria-label={label} className={button}
                onClick={() => nudge(dx * step, dy * step)}><Icon className="h-5 w-5" /></button>
            ))}
        </div>
        </div>
      </details>

      {selected.kind === "text" && (
        <label className="block space-y-1 text-xs">النص
          <textarea className={input} dir="rtl" value={selected.text ?? ""}
            onChange={(e) => update(selected.id, { text: e.target.value })} />
        </label>
      )}
      <GlyphAnchorInspector selected={selected} />
      <label className="flex min-h-12 items-center justify-between gap-4 rounded-lg border border-border px-3 text-xs font-semibold">
        لون العنصر
        <input type="color" className="h-10 w-20 cursor-pointer rounded-lg border border-border bg-background p-1"
          value={selected.color} onChange={(e) => update(selected.id, { color: e.target.value })} />
      </label>
      <details open={showAdvancedCoordinates} onToggle={(event) => setShowAdvancedCoordinates(event.currentTarget.open)} className="rounded-lg border border-border p-3">
        <summary className="cursor-pointer text-xs font-bold">الإحداثيات الدقيقة (X / Y / الحجم)</summary>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {([
            ["x", "موضع X", -100000, 100000],
            ["y", "موضع Y", -100000, 100000],
            ["size", "حجم العنصر", 1, 1000],
          ] as const).map(([key, label, min, max]) => (
            <label key={key} className="block space-y-1">
              <span className="text-xs text-muted-foreground">{label}</span>
              <input type="number" className={input} min={min} max={max} value={selected[key]}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (Number.isFinite(val)) update(selected.id, { [key]: clamp(val, min, max) });
                }} />
            </label>
          ))}
        </div>
      </details>

      <details className="rounded-lg border border-border p-3">
        <summary className="cursor-pointer text-xs font-bold">التحويلات المتقدمة: الحجم والدوران والسُمك والميل</summary>
        <div className="mt-3 space-y-3">
        {([
          ["scaleX", "إطالة الحرف أفقيًا", 0.35, 4, 0.05],
          ["scaleY", "إطالة الحرف رأسيًا", 0.35, 4, 0.05],
          ["rotation", "تدوير الحرف", -180, 180, 1],
          ["skewX", "ميل الحرف أفقيًا", -50, 50, 1],
          ["skewY", "ميل الحرف رأسيًا", -50, 50, 1],
          ...(isOutline ? [["weight", "سُمك إضافي للضربة (Stroke)", 0, 20, 0.25]] as const : []),
        ] as [SliderKey, string, number, number, number][]).map(([key, label, min, max, interval]) => (
          <div key={key} className="space-y-1">
            <label htmlFor={`glyph-slider-${key}`} className="flex items-center justify-between text-xs">
              {label}
              <span className="font-mono text-foreground" dir="ltr">{sliderValue(key).toFixed(key === "rotation" || key === "skewX" || key === "skewY" ? 0 : 2)}{key === "rotation" || key === "skewX" || key === "skewY" ? "°" : key === "weight" ? " px" : "×"}</span>
            </label>
            <input id={`glyph-slider-${key}`} type="range" min={min} max={max} step={interval}
              className="min-h-10 w-full accent-[var(--color-primary)]"
              value={sliderValue(key)}
              onChange={(e) => previewValue(key, Number(e.target.value))}
              onPointerUp={commitPreview} onPointerCancel={commitPreview}
              onKeyUp={commitPreview} onBlur={commitPreview} />
          </div>
        ))}
        <button type="button" className={button + " w-full"}
          onClick={() => { commitPreview(); update(selected.id, { scaleX: 1, scaleY: 1, skewX: 0, skewY: 0, rotation: 0, weight: 0 }); }}>
          <RotateCcw className="h-4 w-4" /> إعادة الإطالة والدوران والسُمك للأصل
        </button>
        </div>
      </details>

      </>}
      {isOutline && activeTab === "paths" && (
        <>
          <details className="rounded-lg border border-border p-3">
            <summary className="cursor-pointer text-xs font-bold">إطالة الأطراف وتشكيل المنحنيات</summary>
            <div className="mt-3 space-y-3">
            <p className="text-[11px] leading-5 text-muted-foreground">
              تعدّل هذه الأداة نقاط مسار الحرف الفعلية تدريجيًا، مع تثبيت منطقة الاتصال قدر الإمكان.
              يختلف ذلك عن التحجيم الأفقي العادي.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {directions.map(({ key, label, icon: Icon }) => (
                <button type="button" className={`${button} ${direction === key ? "border-primary bg-primary/15" : ""}`}
                  key={key} onClick={() => {
                    if (extension) finishStretch();
                    setDirection(key);
                  }}>
                  <Icon className="h-4 w-4" />{label}
                </button>
              ))}
            </div>
            <label className="block space-y-1 text-xs">نطاق التعديل من الطرف المختار
              <select className={input} value={morphRegion} onChange={(e) => { if (extension) finishStretch(); setMorphRegion(e.target.value as MorphRegion); }}>
                <option value="whole">كامل المسار</option>
                <option value="outer-half">النصف الخارجي</option>
                <option value="outer-third">الثلث الخارجي</option>
              </select>
            </label>
            <label className="block space-y-1 text-xs">توزيع المد على المسار
              <select className={input} value={morphProfile} onChange={(e) => { if (extension) finishStretch(); setMorphProfile(e.target.value as MorphProfile); }}>
                <option value="gradual">تدريجي — الحفاظ على منطقة الاتصال</option>
                <option value="tip">تركيز المد على الطرف</option>
                <option value="balanced">توزيع متوازن على كامل المسار</option>
              </select>
            </label>
            <label className="block space-y-1">
              <span className="flex justify-between gap-2 text-xs">
                مقدار المد أو التقصير
                <span className="font-mono" dir="ltr">{extension > 0 ? "+" : ""}{extension} px</span>
              </span>
              <input type="range" min="-60" max="160" step="2"
                className="min-h-10 w-full accent-[var(--color-primary)]" value={extension}
                onChange={(e) => previewStretch(Number(e.target.value))}
                onPointerUp={finishStretch} onPointerCancel={finishStretch}
                onKeyUp={finishStretch} onBlur={finishStretch} />
            </label>
            <label className="block space-y-1 text-xs">
              <span className="flex justify-between">العرض الموضعي للمقطع <span dir="ltr">{regionWidth}%</span></span>
              <input type="range" min="50" max="150" step="5" value={regionWidth}
                className="min-h-10 w-full accent-[var(--color-primary)]"
                onChange={(e) => previewRegionWidth(Number(e.target.value))}
                onPointerUp={finishRegionWidth} onPointerCancel={finishRegionWidth} onKeyUp={finishRegionWidth} onBlur={finishRegionWidth} />
            </label>
            <p className="text-[11px] text-muted-foreground">يستخدم العرض الموضعي الاتجاه والنطاق المحددين أعلاه، ولا يمثل سماكة قلم حقيقية.</p>
            <p className="text-[11px] text-muted-foreground">يمكنك تطبيق المد أكثر من مرة، والتراجع عن كل عملية بشكل مستقل.</p>
            </div>
          </details>
          <details className="rounded-lg border border-border p-3">
            <summary className="cursor-pointer text-xs font-bold">نقاط Bézier والمقابض</summary>
            <div className="mt-3 space-y-3">
            <button type="button" className={`${button} w-full ${editNodes ? "border-primary bg-primary/15" : ""}`}
              onClick={() => setEditNodes(!editNodes)}>
              {editNodes ? "إغلاق مقابض نقاط الحرف" : "فتح محرر نقاط Bézier للحرف"}
            </button>
            {editNodes && (
              <div className="space-y-2 rounded-md border border-border p-2">
                <p className="text-[11px] leading-5 text-muted-foreground">
                  حدد نقطة من اللوحة أو من القائمة. يظهر افتراضيًا عدد أقل من المقابض لتسهيل اللمس.
                  عند اختيار نقطة تظهر مقابض المنحنى القريبة منها.
                </p>
                <label className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-border px-2 text-xs">
                  إظهار جميع النقاط والمقابض
                  <input type="checkbox" checked={showAllNodes} onChange={(e) => setShowAllNodes(e.target.checked)}
                    className="h-5 w-5 accent-[var(--color-primary)]" />
                </label>
                <label className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-border px-2 text-xs">
                  الحفاظ على مقابض المنحنى عند تحريك نقطة التثبيت
                  <input type="checkbox" checked={moveNodeHandles}
                    onChange={(e) => setMoveNodeHandles(e.target.checked)}
                    className="h-5 w-5 accent-[var(--color-primary)]" />
                </label>
                <p className="text-[11px] leading-5 text-muted-foreground">
                  عند التفعيل تتحرك المقابض المتصلة مع نقطة التثبيت، دون تغيير بقية الحروف.
                  ألغِ التفعيل لتعديل زاوية الضربة بحرية. يمكن تحريك كل مقبض بشكل مستقل في الحالتين.
                </p>
                <select className={input} value={node?.id ?? ""}
                  onChange={(e) => setSelectedNode(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">اختر نقطة المسار</option>
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.id + 1} · {n.role === "anchor" ? "نقطة تثبيت" : "مقبض منحنى"}
                    </option>
                  ))}
                </select>
                {node && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      {(["x", "y"] as const).map((axis) => (
                        <label key={axis} className="space-y-1 text-xs">
                          <span>الإحداثي {axis.toUpperCase()} بوحدات الخط</span>
                          <input type="number" step="1" className={input} value={Math.round(node[axis] * 100) / 100}
                            onChange={(e) => setNodeCoordinate(axis, Number(e.target.value))} />
                        </label>
                      ))}
                    </div>
                    {node.role === "control" && (
                      <CubicHandleLinkControls path={currentPath} nodeId={node.id} />
                    )}
                    {node.role === "anchor" && (
                      <GlyphNodeTopologyActions item={selected} nodeId={node.id} />
                    )}
                  </>
                )}
              </div>
            )}
            </div>
          </details>
          <GlyphContoursJoinPanel key={selected.id} selected={selected} siblings={siblings} part="contours" />
        </>
      )}

      {isOutline && activeTab === "joins" && <GlyphContoursJoinPanel key={selected.id} selected={selected} siblings={siblings} part="joins" />}
      {isOutline && activeTab === "alternates" && <>
        <AlternateBrowser key={selected.groupId ?? selected.id} glyph={selected} siblings={siblings} />
        <details className="rounded-xl border border-border bg-card p-3">
          <summary className="cursor-pointer text-xs font-semibold">
            مكتبتي الخاصة — حفظ المقاطع وإعادة استخدامها
          </summary>
          <div className="mt-3"><GlyphLibraryPanel /></div>
        </details>
      </>}
      {isCatalogSymbol && activeTab === "basic" && (
        <details className="rounded-xl border border-primary/30 bg-card p-3">
          <summary className="cursor-pointer text-xs font-semibold">حفظ الشكل المعدل في مكتبتي</summary>
          <div className="mt-3"><GlyphLibraryPanel /></div>
        </details>
      )}
      {activeTab === "basic" && <details className="rounded-lg border border-border p-3">
        <summary className="cursor-pointer text-xs font-bold">إدارة العنصر: نسخ، ترتيب، حذف</summary>
        <div className="mt-3 grid grid-cols-3 gap-2">
        <button type="button" className={button} onClick={() => duplicate(selected.id)}>
          <Copy className="h-4 w-4" />نسخ
        </button>
        <button type="button" className={button} onClick={() => reorder(selected.id, -1)}>للخلف</button>
        <button type="button" className={button} onClick={() => reorder(selected.id, 1)}>للأمام</button>
      </div>
      <button type="button" className={button + " mt-3 w-full border-destructive text-destructive"}
        onClick={() => remove(selected.id)}><Trash2 className="h-4 w-4" />حذف العنصر المحدد</button>
      </details>}
    </section>
  );
}
