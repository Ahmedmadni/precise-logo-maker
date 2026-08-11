# Geometric Harmony Studio

Logo Grid Studio — Master Development Prompt

0. ROLE & OBJECTIVE

قم ببناء تطبيق ويب احترافي كامل باسم:

Logo Grid Studio

التطبيق عبارة عن Professional Geometric Logo Construction & Vector Design Studio، وليس مجرد أداة لعرض Grid.

الهدف هو إنشاء بيئة متخصصة لبناء الشعارات الهندسية بدقة عالية باستخدام:

- Geometric Grids

- Vector Paths

- Smart Snapping

- Bézier Curves

- Arcs

- Circles

- Symmetry

- Radial Repetition

- Geometric Constraints

- Boolean Operations

- Node Editing

- Measurements

- Optical Alignment

- Professional SVG Export

يجب أن يكون التطبيق Functional حقيقيًا وليس Prototype بصريًا.

أي زر أو أداة تظهر في الواجهة يجب أن تكون مرتبطة بمنطق حقيقي وقابلة للاستخدام.

---

1. CORE PRINCIPLE — IMPORTANT

لا تبنِ التطبيق باعتباره UI فوق Canvas فقط.

يجب أن تكون الأولوية المعمارية:

Geometry Engine

        ↓

Coordinate System

        ↓

Snap Engine

        ↓

Vector/Object Model

        ↓

Constraint System

        ↓

Editor

        ↓

UI

        ↓

Export Engine

الـUI ليس هو قلب التطبيق.

Geometry Engine هو قلب التطبيق.

يجب أن تكون جميع العناصر مبنية على إحداثيات هندسية مستقلة عن إحداثيات الشاشة.

---

2. TECHNOLOGY STACK

استخدم:

- React

- TypeScript

- Vite

- SVG as the primary rendering system

- Zustand لإدارة الحالة

- Tailwind CSS

- Lucide Icons

استخدم مكتبات هندسية مناسبة فقط عند الحاجة، ولا تعتمد على مكتبة واحدة لتنفيذ كامل النظام.

يمكن استخدام مكتبات متخصصة في:

- SVG Path manipulation

- Boolean geometry

- Bézier calculations

- Polygon operations

لكن يجب أن يبقى الـdata model الخاص بالتطبيق واضحًا ومستقلًا.

---

3. VECTOR-FIRST ARCHITECTURE

يجب أن يكون SVG هو النظام الأساسي للرسم والتصدير.

لا تعتمد على Canvas كصيغة نهائية للتصميم.

كل عنصر يجب أن يمتلك بيانات هندسية حقيقية.

مثال:

interface VectorObject {

  id: string;

  type: "circle" | "line" | "arc" | "path" | "polygon" | "rect" | "group";

  transform: Transform;

  style: Style;

  geometry: Geometry;

  visible: boolean;

  locked: boolean;

}

يجب فصل:

Geometry

Style

Transform

Layer

Constraints

Metadata

---

4. WORLD COORDINATE SYSTEM

أنشئ نظام إحداثيات مستقلًا عن الشاشة:

World Coordinates

Viewport Coordinates

Screen Coordinates

كل التصميمات يجب أن تعتمد على World Coordinates.

يجب ألا تتأثر العلاقات الهندسية عند:

- Zoom

- Pan

- Resize

- Rotate

- تغيير حجم النافذة

---

5. ARTBOARD

أضف Artboard حقيقي.

الأحجام الجاهزة:

512 × 512

1024 × 1024

2048 × 2048

Custom

Units:

PX

MM

CM

IN

يجب دعم:

- Square

- Portrait

- Landscape

- Custom

مع إمكانية تغيير:

- Width

- Height

- Background

- Orientation

يجب أن يكون Artboard هو المرجع الأساسي لكل التصميم.

---

6. VIEWPORT SYSTEM

أضف نظام احترافي:

- Pan

- Zoom

- Rotate View

- Fit Artboard

- Fit Selection

- Reset View

- 100%

- 200%

- 400%

- 800%

الـZoom يجب أن يعمل toward cursor.

أي أن النقطة الموجودة تحت المؤشر تبقى ثابتة أثناء التكبير.

اختصارات:

Space + Drag = Pan

Mouse Wheel = Zoom

Middle Mouse = Pan

---

7. GRID ENGINE

يجب دعم أنواع Grid التالية:

7.1 Square Grid

- Horizontal

- Vertical

- Adjustable spacing

- Adjustable subdivisions

7.2 Concentric Circle Grid

- Multiple circles

- Adjustable radius

- Radius step

- Center position

7.3 Radial / Angular Grid

- Center point

- Number of rays

- Custom angle

- Rotation

- 15°

- 30°

- 45°

- Custom

7.4 Golden Ratio Grid

استخدم القيمة الرياضية الحقيقية:

φ = 1.61803398875

دعم:

- Golden rectangles

- Fibonacci construction

- Golden spiral

7.5 Hexagonal Grid

7.6 Triangular Grid

7.7 Isometric Grid

7.8 Custom Grid

السماح للمستخدم بإنشاء Grid مخصص.

---

8. MULTI-GRID SYSTEM

يجب السماح بتشغيل أكثر من Grid في الوقت نفسه.

مثال:

Square Grid

+

Concentric Circles

+

Radial Grid

كل Grid يجب أن يكون Layer مستقلًا.

لكل Grid:

Visibility

Lock

Opacity

Color

Stroke Width

Rotation

Scale

Position

---

9. GRID PRESETS

السماح بحفظ إعدادات Grid كـPreset.

أمثلة:

Basic Logo

Golden Ratio

Circular Logo

Radial Logo

C Geometry

Custom

يمكن:

- Save Preset

- Rename

- Duplicate

- Delete

- Apply Preset

---

10. SMART SNAP ENGINE

هذه من أهم أجزاء التطبيق.

لا تجعل Snap يعتمد فقط على أقرب نقطة.

يجب إنشاء Smart Snap Engine حقيقي.

يدعم:

Grid Point

Intersection

Endpoint

Midpoint

Center

Tangent Point

Perpendicular Point

Symmetry Point

Nearest Geometry

Circle Intersection

Line Intersection

Arc Intersection

يجب إظهار Snap Indicator بصريًا عند العثور على نقطة Snap.

مثال:

● Intersection

◆ Midpoint

○ Center

△ Tangent

مع إمكانية تشغيل وإيقاف كل نوع.

---

11. SNAP PRIORITY

عند وجود أكثر من Snap Point، استخدم Priority System.

مثال:

Exact Intersection

↓

Endpoint

↓

Center

↓

Midpoint

↓

Tangent

↓

Nearest Geometry

يجب أن يكون هذا قابلًا للتخصيص من Settings.

---

12. PRECISION MODE

أضف:

Normal

Fine

Ultra Fine

واختصارات:

Shift = Fine movement

Ctrl = Constrain

Alt = Duplicate

---

13. GEOMETRY PRIMITIVES

دعم:

- Line

- Circle

- Ellipse

- Rectangle

- Rounded Rectangle

- Polygon

- Triangle

- Star

- Arc

- Bézier Path

كل عنصر يجب أن يكون Vector Object حقيقي.

---

14. ARC ENGINE

دعم:

Arc by Center

Arc by 3 Points

Arc by Radius

Arc by Start/End Angle

Circle → Arc

Arc → Path

يجب أن يستطيع المستخدم إدخال:

Radius

Start Angle

End Angle

Rotation

مثال:

Radius = 120

Start = 15°

End = 285°

---

15. C-SHAPE BUILDER

أضف أداة متخصصة لإنشاء حرف C هندسي.

Parameters:

Outer Radius

Inner Radius

Start Angle

End Angle

Gap

Rotation

Center

يجب أن ينتج:

Clean SVG Geometry

وليس صورة.

---

16. BÉZIER SYSTEM

دعم:

Quadratic Bézier

Cubic Bézier

Node Types:

Corner

Smooth

Symmetric

Handle Types:

Independent

Mirrored

Aligned

يجب السماح بتحرير:

- Anchor Points

- Control Points

- Handles

---

17. NODE EDITOR

عند تحديد Path:

أظهر:

Anchor Points

Control Handles

Path Segments

السماح بـ:

- Move Node

- Add Node

- Delete Node

- Convert Corner → Smooth

- Convert Smooth → Corner

- Edit Handles

يجب أن يكون Node Editor حقيقيًا.

---

18. CONSTRUCTION GEOMETRY

فرّق بين:

Grid

و:

Construction Geometry

Construction Geometry يمكن أن تحتوي على:

- Circles

- Lines

- Axes

- Tangents

- Guides

- Intersections

- Measurement guides

ويجب أن تكون قابلة للإخفاء بشكل مستقل عن Grid.

---

19. GEOMETRIC CONSTRAINTS

أضف Constraint Engine.

يدعم:

Horizontal

Vertical

Parallel

Perpendicular

Equal Distance

Equal Radius

Equal Length

Concentric

Tangent

Symmetric

Fixed Angle

Fixed Length

Aligned

عند تطبيق Constraint، يجب أن تبقى العلاقة محفوظة أثناء التعديل.

---

20. SYMMETRY SYSTEM

دعم:

Vertical

Horizontal

Diagonal

Custom Axis

Radial

N-fold Symmetry

أمثلة:

2-fold

3-fold

4-fold

6-fold

8-fold

12-fold

يجب أن يستطيع المستخدم تحديد مركز ومحور التناظر.

---

21. RADIAL REPEAT

السماح بتكرار عنصر حول مركز.

Parameters:

Copies

Angle

Rotation

Center of Rotation

مثال:

Copies = 8

Angle = 45°

مراكز الدوران:

Artboard Center

Object Center

Grid Center

Custom Point

---

22. TRANSFORM SYSTEM

لكل عنصر:

X

Y

Width

Height

Rotation

Scale X

Scale Y

وللعناصر الهندسية:

Radius

Diameter

Angle

Length

يجب إمكانية إدخال القيم يدويًا.

---

23. BOOLEAN OPERATIONS

أضف:

Union

Subtract

Intersect

Exclude

Divide

Trim

مثال:

Circle

+

Circle

→ Boolean Subtract

→ C Shape

يجب إنتاج Path حقيقي.

---

24. STROKE & FILL

Fill

دعم:

Solid

Linear Gradient

Radial Gradient

None

Stroke

دعم:

Color

Width

Cap

Join

Dash

Miter Limit

Caps:

Butt

Round

Square

Joins:

Miter

Round

Bevel

---

25. STROKE TO PATH

أضف:

Stroke → Outline

لتحويل الـStroke إلى Vector Path قابل للتحرير.

---

26. SELECTION SYSTEM

دعم:

- Single Select

- Multi Select

- Box Selection

- Shift Select

- Select All

- Select Same

- Invert Selection

---

27. TRANSFORM CONTROLS

عند تحديد عنصر أظهر Bounding Box.

يدعم:

- Resize

- Rotate

- Scale

- Move

- Duplicate

مع إمكانية المحافظة على النسب.

---

28. GROUP SYSTEM

دعم:

Group

Ungroup

Nested Groups

ويمكن تطبيق Transform على Group كامل.

---

29. LAYERS

Layers:

Grid

Construction

Geometry

Shapes

Text

Colors

Guides

كل Layer يدعم:

Visible

Locked

Rename

Delete

Duplicate

دعم Drag & Drop لترتيب الطبقات.

---

30. TYPOGRAPHY / WORDMARK

إضافة Wordmark.

دعم:

- Font Family

- Font Size

- Letter Spacing

- Line Height

- Alignment

- Tracking

- Rotation

ويجب أن يكون النص Vector-compatible عند التصدير.

أضف:

Text → Outlines

عند الحاجة.

---

31. COLOR SYSTEM

دعم:

HEX

RGB

HSL

CMYK

Pantone reference

مع Brand Palette.

يمكن:

- Add Color

- Remove Color

- Rename Color

- Save Palette

- Reuse Palette

---

32. MEASUREMENT SYSTEM

أداة قياس حقيقية.

عرض:

Distance

Angle

Radius

Diameter

Width

Height

Gap

مع خطوط قياس مؤقتة.

---

33. OPTICAL ALIGNMENT

أضف أدوات Optical Correction.

يجب التفريق بين:

Mathematical Alignment

Optical Alignment

دعم:

Optical Center

Optical Alignment

Curve Compensation

Stroke Compensation

لا تستخدم AI score وهميًا.

إذا تم عرض نسبة أو تقييم، يجب أن يكون مبنيًا على قياسات فعلية.

---

34. LOGO CONSTRUCTION ANALYZER

أضف Analyzer اختياري.

يمكنه تحليل:

Symmetry

Circle Consistency

Alignment

Spacing

Ratio Consistency

Grid Alignment

وإظهار الملاحظات بطريقة مفيدة.

مثال:

Symmetry: Excellent

Alignment: Good

Spacing: Needs Adjustment

لا تعرض أرقامًا عشوائية.

---

35. CONSTRUCTION MODE

أضف وضعين رئيسيين:

Construction Mode

يعرض:

- Grid

- Construction Geometry

- Measurements

- Axes

- Intersections

- Ratios

- Guides

Final Mode

يخفي كل أدوات البناء.

ويعرض:

Logo Only

مع عدم حذف أي بيانات.

---

36. LOGO PREVIEW

دعم:

Transparent

White

Black

Brand Color

Preview Templates:

Website Header

Business Card

Social Avatar

App Icon

يجب أن تكون هذه معاينات فقط ولا تغير بيانات الشعار.

---

37. SAFE AREA

أداة:

Clear Space

Safe Area

Minimum Size

السماح بتحديد مقدار المساحة الآمنة.

---

38. LOGO VARIATIONS

إنشاء Variations:

Primary

Monochrome

Black

White

Icon Only

Horizontal

Vertical

كل Variation يجب أن تبقى مرتبطة بالمشروع الأساسي.

---

39. EXPORT ENGINE

SVG

يجب أن يكون:

- Clean SVG

- Vector

- Editable

- No Grid

- No hidden construction objects

- Preserve paths

- Preserve groups

- Preserve fills

- Preserve strokes

مهم جدًا:

لا تكتفِ بـ"opacity: 0".

يجب استبعاد Grid وConstruction Geometry من SVG النهائي.

---

PNG

دعم:

Transparent

1x

2x

3x

4x

Custom Resolution

---

PDF

يجب أن يكون:

Vector PDF

قدر الإمكان.

---

40. BRAND PACKAGE EXPORT

أضف زر:

Export Brand Package

ينتج:

Logo.svg

Logo.png

Logo-black.svg

Logo-white.svg

Logo-transparent.png

Construction.svg

Preview.pdf

اختياريًا:

Favicon

App Icon

Social Avatar

---

41. CONSTRUCTION SHEET

أضف:

Generate Construction Sheet

تحتوي الصفحة على:

- Final Logo

- Grid

- Construction Geometry

- Circles

- Axes

- Measurements

- Ratios

- Colors

- Clear Space

وتكون قابلة للتصدير كـPDF.

---

42. PROJECT FILE FORMAT

لا تعتمد فقط على Auto-save.

أنشئ صيغة مشروع:

.logo

مثال منطقي:

{

  "version": 1,

  "document": {},

  "artboard": {},

  "viewport": {},

  "grids": [],

  "construction": [],

  "objects": [],

  "layers": [],

  "constraints": [],

  "colors": [],

  "guides": [],

  "metadata": {}

}

يجب دعم:

New Project

Open Project

Save Project

Save As

Duplicate Project

Import Project

Export Project

---

43. LOCAL-FIRST STORAGE

لا تستخدم Database أو Login لبنية التطبيق الأساسية.

استخدم:

IndexedDB

لحفظ المشاريع محليًا.

يجب دعم:

- Auto-save

- Recovery

- Project History

- Multiple Projects

ويجب أن يعمل التطبيق حتى بدون اتصال بالإنترنت بعد تحميله.

---

44. UNDO / REDO

يجب أن يكون هناك History Engine حقيقي.

يدعم:

Undo

Redo

History

مع History Panel تعرض:

Create Circle

Move Node

Create Arc

Mirror

Boolean Subtract

Change Radius

...

يمكن العودة إلى حالة سابقة.

---

45. KEYBOARD SHORTCUTS

دعم اختصارات احترافية.

مثال:

V = Select

P = Pen

R = Rectangle

C = Circle

L = Line

A = Arc

T = Text

G = Grid

M = Measure

Z = Zoom

H = Pan

و:

Ctrl/Cmd + Z = Undo

Ctrl/Cmd + Shift + Z = Redo

Ctrl/Cmd + S = Save

Ctrl/Cmd + C = Copy

Ctrl/Cmd + V = Paste

Ctrl/Cmd + D = Duplicate

Delete = Delete

Space = Pan

Shift = Fine

Alt = Duplicate

Ctrl/Cmd = Constrain

يمكن تعديل الاختصارات من Settings.

---

46. TOUCH SUPPORT

دعم كامل:

1 Finger = Select / Draw

2 Fingers = Pan

Pinch = Zoom

Rotate Gesture = View Rotation

يجب أن تكون الواجهة مناسبة للـTablet.

---

47. RESPONSIVE UI

Desktop-first ولكن Responsive.

الشاشات:

Desktop

Laptop

Tablet

Mobile

على الشاشات الصغيرة يجب تحويل الأدوات الجانبية إلى Panels قابلة للفتح والإغلاق.

---

48. UI STRUCTURE

Top Toolbar

يحتوي على:

File

Edit

View

Grid

Object

Path

Align

Export

Left Toolbar

أدوات الرسم:

Select

Pen

Line

Circle

Rectangle

Polygon

Arc

Text

Measure

Right Panel

Tabs:

Properties

Layers

Grid

Constraints

Colors

Bottom Bar

يعرض:

Zoom

Coordinates

Unit

Snap Status

Grid Status

---

49. DARK MODE

Dark Mode هو الوضع الافتراضي.

يجب أن تكون الواجهة:

- Professional

- Minimal

- High Contrast

- Low Visual Noise

لا تجعل Grid أقوى بصريًا من الشعار.

الشعار هو العنصر الرئيسي.

---

50. GRID VISUAL HIERARCHY

يجب أن يكون هناك تدرج بصري:

Primary Grid

Secondary Grid

Construction Geometry

Measurements

Final Logo

الشعار النهائي يجب أن يكون دائمًا أوضح من Grid.

---

51. PROJECT TEMPLATES

أضف Templates جاهزة:

Circular Logo

C Logo

Monogram

Badge

Geometric Symbol

Golden Ratio

Radial Logo

Minimal Icon

لكن القوالب يجب أن تكون Vector Geometry حقيقية.

---

52. PERFORMANCE

التطبيق يجب أن يكون سريعًا حتى مع:

- Hundreds of objects

- Multiple grids

- Many nodes

- Complex SVG paths

استخدم:

- Memoization

- Efficient Zustand selectors

- SVG grouping

- Minimal re-rendering

لا تعيد Render لكل المشروع عند تحريك Node واحد.

---

53. ACCESSIBILITY

دعم:

- Keyboard navigation

- Focus states

- Tooltips

- Accessible labels

- High contrast

---

54. ERROR HANDLING

لا تسمح بانهيار المشروع عند:

- Boolean failure

- Invalid SVG

- Corrupted project

- Unsupported geometry

- Export failure

اعرض رسالة واضحة للمستخدم.

مثال:

Unable to perform Boolean operation.

Try simplifying the selected paths.

---

55. AUTOSAVE & RECOVERY

Auto-save بشكل مستمر ولكن ذكي.

لا تحفظ في كل Mouse Move.

استخدم debounce.

مثلاً:

500–1000ms after meaningful change

مع:

Last Saved: 23:41

---

56. DATA INTEGRITY

كل Object يجب أن يمتلك:

Unique ID

Type

Geometry

Transform

Style

Layer ID

Constraints

Visibility

Lock State

لا تعتمد على ترتيب العناصر في DOM كمعرف.

---

57. ARCHITECTURE

قسّم المشروع إلى Modules:

src/

  core/

    geometry/

    coordinates/

    snapping/

    constraints/

    boolean/

    transforms/

  editor/

    selection/

    nodes/

    tools/

    history/

  grids/

    square/

    circular/

    radial/

    golden/

    hex/

    triangular/

    isometric/

  objects/

    circle/

    line/

    arc/

    path/

    polygon/

    text/

  layers/

  colors/

  typography/

  export/

  storage/

  preview/

  components/

    toolbar/

    panels/

    canvas/

    dialogs/

  store/

---

58. IMPORTANT DEVELOPMENT RULE

لا تنفذ كل المميزات كـMock UI.

إذا لم تكن ميزة قابلة للتنفيذ في المرحلة الحالية:

لا تضع زرًا وهميًا لها.

إما:

1. تنفيذها فعليًا

2. أو وضعها في Roadmap داخليًا بدون UI مضلل

---

59. DEVELOPMENT PHASES

لا تحاول بناء كل شيء دفعة واحدة.

نفذ بالترتيب التالي:

Phase 1 — Geometry Core

- Coordinate System

- Artboard

- SVG Renderer

- Zoom

- Pan

- Basic Shapes

- Grid Engine

Phase 2 — Precision Engine

- Smart Snap

- Intersections

- Measurements

- Transform

- Constraints

- Precision Mode

Phase 3 — Vector Editor

- Paths

- Bézier

- Node Editor

- Arcs

- Stroke

- Fill

Phase 4 — Advanced Geometry

- Boolean

- Mirror

- Symmetry

- Radial Repeat

- C Builder

- Golden Ratio

Phase 5 — Editor System

- Layers

- Groups

- History

- Typography

- Colors

Phase 6 — Project System

- IndexedDB

- Auto-save

- Recovery

- ".logo" format

Phase 7 — Export

- SVG

- PNG

- PDF

- Brand Package

- Construction Sheet

Phase 8 — UX

- Keyboard Shortcuts

- Touch

- Responsive

- Preview

- Templates

- Accessibility

---

60. ACCEPTANCE CRITERIA

قبل اعتبار التطبيق مكتملًا، يجب اختبار:

Grid

- هل يمكن إنشاء أكثر من Grid؟

- هل يمكن تدويرها؟

- هل يمكن إخفاؤها؟

- هل يمكن قفلها؟

Snap

- هل Snap يعمل فعليًا؟

- هل يتعرف على intersections؟

- هل يتعرف على centers؟

- هل يتعرف على tangents؟

Geometry

- هل الدوائر دقيقة؟

- هل الأقواس دقيقة؟

- هل Bézier قابل للتحرير؟

- هل العلاقات الهندسية محفوظة؟

Boolean

- هل Union يعمل؟

- هل Subtract يعمل؟

- هل Intersect يعمل؟

Vector

- هل كل العناصر SVG حقيقية؟

- هل يمكن تعديل Nodes؟

Export

- هل SVG نظيف؟

- هل Grid مستبعد فعلًا؟

- هل PNG شفاف؟

- هل PDF Vector؟

Project

- هل يمكن إغلاق التطبيق وإعادة فتح المشروع؟

- هل Auto-save يعمل؟

- هل ".logo" يحفظ كل البيانات؟

---

61. FIRST BUILD REQUIREMENT

ابدأ أولًا ببناء:

Artboard

+

SVG Renderer

+

Coordinate System

+

Square Grid

+

Concentric Circle Grid

+

Radial Grid

+

Zoom

+

Pan

+

Selection

+

Smart Snap

+

Circle

+

Line

+

Arc

+

Undo/Redo

ثم توقف.

اعرض لي بنية المشروع والـCore Architecture وحالة الاختبارات قبل الانتقال إلى المرحلة التالية.

لا تنتقل تلقائيًا إلى بناء جميع المراحل إذا كانت المرحلة الحالية غير مستقرة.

---

62. FINAL PRODUCT VISION

النتيجة النهائية يجب أن تكون أداة تشبه من حيث فلسفة الاستخدام:

Professional Logo Construction Software

وليست:

Drawing App with Grid Background

المستخدم يجب أن يستطيع بدء مشروع فارغ ثم:

Create Artboard

        ↓

Choose Grid

        ↓

Configure Geometry

        ↓

Draw

        ↓

Snap

        ↓

Apply Constraints

        ↓

Edit Nodes

        ↓

Boolean Operations

        ↓

Symmetry / Repeat

        ↓

Align

        ↓

Add Wordmark

        ↓

Apply Colors

        ↓

Analyze Geometry

        ↓

Preview

        ↓

Generate Construction Sheet

        ↓

Export Professional Logo

---

63. SPECIAL TEST CASE — COZMIA PHARMA

بعد استقرار الـCore، استخدم هذا السيناريو لاختبار النظام:

إنشاء شعار هندسي لشركة:

Cozmia Pharma

يجب أن يستطيع التطبيق بناء:

- Open C circular structure

- Inner geometric shape

- Symmetry

- Concentric circles

- Controlled gap

- Custom rotation

- Boolean subtraction

- Precise stroke/fill

- Wordmark

لا تجعل هذا التصميم جزءًا ثابتًا من التطبيق.

استخدمه فقط كـTest Case للتأكد من أن Geometry Engine قادر على التعامل مع هذا النوع من الشعارات.

---

64. CRITICAL IMPLEMENTATION RULES

1. لا تستخدم Raster Images كأساس للشعار.

2. لا تعتمد على Canvas pixels كبيانات التصميم.

3. لا تجعل Grid جزءًا من Final SVG.

4. لا تستخدم "opacity: 0" كبديل عن استبعاد العناصر من التصدير.

5. لا تستخدم تقييمات أو نسبًا وهمية.

6. لا تنشئ أزرارًا لا تعمل.

7. لا تجعل Geometry مرتبطة بإحداثيات الشاشة.

8. لا تضحي بالدقة الهندسية لصالح المؤثرات البصرية.

9. لا تجعل UI معقدًا على حساب مساحة العمل.

10. يجب أن يكون Final Logo دائمًا أوضح عنصر في المشهد.

---

65. FINAL INSTRUCTION TO LOVABLE

ابدأ بتحليل المتطلبات السابقة وتحويلها إلى Architecture عملية.

قبل كتابة كمية كبيرة من UI، قم ببناء:

Geometry Core + Coordinate System + SVG Renderer + Grid Engine + Smart Snap Engine

ثم ابنِ الواجهة فوقها.

يجب أن تكون جميع البيانات قابلة للتحرير وليست مجرد رسومات مرئية.

اكتب TypeScript قويًا مع Types واضحة.

تجنب "any" قدر الإمكان.

استخدم Components صغيرة وقابلة لإعادة الاستخدام.

استخدم Zustand بحذر لتجنب إعادة Render غير ضرورية.

احرص على أن يكون التطبيق:

Fast

Precise

Vector-based

Offline-capable

Responsive

Maintainable

Extensible

Professional

والأهم:

لا تنتقل إلى المرحلة التالية قبل أن تكون المرحلة الحالية Functional ومستقرة.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://precise-logo-maker.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/591d61c1-1917-4e74-b5d5-0dfe9a4fe18c).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
