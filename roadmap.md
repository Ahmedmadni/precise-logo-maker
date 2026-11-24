# Next improvements
- [x] Move drawing tools and properties into horizontal top bars with a collapsible desktop properties area; preserve tablet and mobile drawers.
- [x] Expand Arabic writing with caret-based tashkeel controls and 10 additional editable marks; 97 calligraphy tests pass and browser writing/insertion/undo verified.
- [x] Preview AI construction before insertion; allow regeneration.
- [x] Improve editable logo path controls.
- [x] Prepare Android configuration and packaging instructions; verify available tooling.
- [x] Verify tests and desktop/mobile flows: 94 tests pass; AI preview/insertion, path node editing/undo, page-hide autosave/restore, and Arabic mobile panel checked.
- [x] Build a real installable debug APK with Capacitor, native document saving and bundled offline assets; APK v2 signature and 294 tests verified.
- [ ] Verify autosave and .logo/SVG/PNG saving on a physical Android phone; the software emulator did not finish booting, so device confirmation remains with the user.

## Logo Studio — Phase A continuation (post #50)

Implementation order for the contextual editor UI. Do not remove existing vector, Arabic calligraphy, undo, or export functionality.

- [ ] Inventory existing editor toolbars, selection types, property controls, and responsive breakpoints before modifying components.
- [ ] Group tool entry points by user workflow: Writing, Drawing, Edit, Diacritics, Ornament, Layers, Export. Preserve keyboard shortcuts and underlying commands.
- [ ] Show contextual properties for selected text/glyph, path/node, shape, diacritic, and multi-selection; show artboard settings when nothing is selected.
- [ ] Make desktop side panels collapsible/resizable without covering the artboard; use a single accessible tool drawer on small screens.
- [ ] Verify tablet portrait/landscape, Android touch targets, stylus dragging, safe-area insets, and right-to-left layout.
- [ ] Add regression tests for tool switching, selection-to-properties mapping, undo/redo, project reload, and SVG export.
- [ ] Run lint, TypeScript checks, web/mobile builds, and Android packaging before merging implementation.

### Release gates

Do not mark the phase complete until the same design can be edited, saved, reopened, and exported on desktop and Android. Avoid claiming native offline support solely from the presence of bundled assets: confirm the installed APK actually works without network access.
