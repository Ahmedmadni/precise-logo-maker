# Logo Grid Studio — Phase 1 (Geometry Core)

Per your section 61, this first build stops after the core is functional and stable. No mock buttons: every control shipped is wired to real logic.

## What Phase 1 delivers

**Geometry core (headless, testable)**
- World / viewport / screen coordinate system with a single view transform (pan, zoom, rotation) and conversion helpers in both directions.
- Pure geometry math: points, vectors, lines, segments, circles, arcs, bounding boxes, and intersection solvers (line×line, line×circle, circle×circle, arc variants).
- Vector object model: `id`, `type`, `geometry`, `transform`, `style`, `layerId`, `visible`, `locked` — geometry stored in world units, never screen pixels.

**Artboard**
- Presets 512/1024/2048 + custom width/height, orientation, background color, units (px/mm/cm/in) with real unit conversion. Artboard is the design origin.

**SVG renderer**
- Single `<svg>` scene, layered groups in strict paint order: primary grid → secondary grid → construction → shapes → overlays (snap indicators, selection, handles).
- Grid strokes are non-scaling (constant screen width) so zoom does not thicken them; logo geometry always reads stronger than the grid.

**Viewport**
- Wheel zoom anchored to the cursor (exponential, delta-normalized, non-passive listener), Space+drag and middle-mouse pan, Fit Artboard, Fit Selection, Reset, 100/200/400/800%.

**Grid engine (multi-grid)**
- Square (spacing + subdivisions), concentric circles (center, radius, step, count), radial/angular (center, ray count, angle step, rotation).
- Each grid is an independent layer with visibility, lock, opacity, color, stroke width, rotation, scale, position. Grids generate geometry from parameters, so snapping and rendering read the same source.

**Smart snap engine**
- Candidate providers: grid point, endpoint, midpoint, center, intersection (grid×grid, grid×object, object×object), nearest-on-geometry.
- Priority resolution (intersection → endpoint → center → midpoint → nearest), screen-space tolerance, per-type on/off toggles, and distinct visual indicators per snap type.

**Tools**
- Select (click, shift-add, box select), Circle, Line, Arc (center + start/end angle, with numeric entry). Drawing consumes snap results, so shapes land on exact geometry.

**History**
- Command-based undo/redo over immutable state snapshots of the document slice, with a history list. Keyboard: Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z.

**UI shell (minimal, dark, high contrast)**
- Left tool rail, right panel (Properties / Grids), bottom status bar (zoom, cursor world coords, unit, snap status). Only Phase 1 features appear — no placeholder menus.

## Technical notes

- Stack is fixed by this project: React + TypeScript + Vite + TanStack Router, Tailwind, Zustand, Lucide, SVG rendering. Routing stays TanStack; the studio lives at `/` (replacing the placeholder index).
- Module layout follows your section 57: `src/core/{geometry,coordinates,snapping}`, `src/grids/*`, `src/objects/*`, `src/editor/{tools,selection,history}`, `src/store`, `src/components/{canvas,toolbar,panels}`.
- Zustand store split into slices (document, viewport, tools, snap settings, history) with atomic selectors; canvas subscribes per-object to avoid full-scene re-render on a single move.
- Strict TypeScript, no `any`; geometry modules are pure functions with no React or DOM dependency.
- Vitest unit tests for coordinate round-trips, intersection solvers, arc parameterization, snap priority, and grid generation. Test results reported at the end of the phase.
- Colors go through semantic tokens in `src/styles.css` (dark default), not hardcoded utilities.

## Explicitly out of scope this phase

Bézier/node editor, constraints, boolean ops, symmetry/radial repeat, C-shape builder, golden/hex/tri/iso grids, layers panel, typography, color system, measurement tool, analyzer, IndexedDB/`.logo` format, export engine, templates, preview mocks. These come in later phases in your stated order — no UI stubs for them will be added.

## After this phase

I report back with the project structure, the core architecture, and the test results, and wait for your go-ahead before Phase 2.
