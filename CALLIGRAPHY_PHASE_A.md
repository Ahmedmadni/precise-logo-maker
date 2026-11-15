# Arabic Calligraphy Composer — Phase A

This phase extends the existing logo editor; it does not replace the geometric drawing engine or change the Android hosting model.

## How to use

1. Open **كتابة** and convert an Arabic word into vector outlines. Choose a real, legally licensed font.
2. Select an outlined glyph, then open **زخارف**. Choosing a haraka attaches it to that glyph automatically and places it approximately above or below it.
3. Select the haraka, then open **تعديل > ربط الحركة بالحرف**. Choose another owner glyph, auto/manual positioning, or detach.
4. When you drag a glyph/word, its linked harakat follow. Drag the haraka itself to switch to manual positioning and keep that relative offset.
5. Select an outlined glyph, then **تعديل > موضع الحرف بالنسبة إلى السطر**. Enable baseline/upper/lower/ascender/descender guides, edit positions, opt into near-baseline snapping or set the glyph baseline offset.
6. Use **ميل الحرف أفقيًا/رأسيًا** under the normal transform controls. SVG output and Bézier hit-testing use the same transforms.
7. Undo/redo applies to both composition and guide changes; .logo stores attachment metadata. Printed SVG/PNG excludes construction baselines.

## What this is and isn't

- Harakat positioning uses current glyph outline bounds and simple stacking. It does not choose Arabic grammar/vowels or guarantee correct placement for every complex diwani/Thuluth ligature.
- OpenType reshaping can change the number of glyphs. Attachments remap by approximate glyph order; inspect the result visually.
- Editable **head/body/tail semantic segmentation**, join-node geometry, collision-free artistic composition and professional PDF export are future stages, not delivered in Phase A.
- The Android debug build still opens the hosted Lovable site. Native offline storage, gallery saving and app-store signing remain separate work.

## QA

The CI workflow runs Vitest, TypeScript type checking, web build, and a debug Android APK build. Real Android touch QA remains necessary.
