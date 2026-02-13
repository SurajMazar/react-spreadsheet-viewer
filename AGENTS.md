# Sheet Viewer — Project Guide for AI Agents

> **Purpose of this file:** Provide any LLM or AI coding assistant with full context to understand, navigate, modify, and extend this project without needing to re-explore the codebase from scratch.

---

## 1. What This Project Is

**Sheet Viewer** is a reusable React component library that parses and renders Excel (`.xlsx`, `.xls`) and CSV files in a Google Sheets-like UI. It is designed to:

- Handle very large datasets (100k+ rows, 100+ columns) via virtualized rendering.
- Be embedded in any React application as a drop-in `<SheetViewer />` component.
- Support both **view** and **edit** modes.
- Accept data via props (URL string, `File`, `ArrayBuffer`, or `ArrayBufferView`) — not through an internal upload UI.
- Expose an imperative API via `React.forwardRef` for programmatic access to sheet data and navigation.

The project also includes a **demo application** (with file upload) and **Storybook** stories for component documentation and visual testing with **Chromatic**.

---

## 2. Tech Stack

| Concern | Library / Tool | Notes |
|---|---|---|
| Framework | React 19 | Uses `forwardRef`, `useImperativeHandle` |
| Build | Vite 7 | Dual build: demo app + library package |
| Language | TypeScript (strict) | Full codebase, no JS files in `src/` |
| State | Zustand 5 | Instance-scoped stores via `createStore` + React Context |
| Virtualization | @tanstack/react-virtual 3 | Two `useVirtualizer` instances (rows + columns) |
| Excel Parsing | xlsx (SheetJS) 0.18 | Dynamic `import()` for code-splitting |
| CSV Parsing | Custom parser | In `useFileParser.ts`, no external dep for CSV |
| Charts | Chart.js 4 + react-chartjs-2 5 | Tree-shakeable; bar, line, pie, area |
| ZIP/Decompression | fflate | For reading XLSX internal XML (charts, pivots) |
| Styling | Plain CSS | All classes prefixed `sv-` or scoped under `.sheet-viewer` |
| Testing | Vitest 4 + React Testing Library | JSDOM environment |
| Visual Testing | Storybook 10 + Chromatic | Visual regression |
| Package Manager | pnpm | `pnpm-lock.yaml` is the lockfile |
| Linting | ESLint 9 (flat config) | React Hooks + React Refresh plugins |

---

## 3. Directory Structure

```
sheet-viewer/
├── .storybook/
│   ├── main.ts              # Storybook config (stories path, addons, framework)
│   └── preview.ts            # Storybook preview (fullscreen layout)
├── public/
│   └── vite.svg
├── src/
│   ├── assets/
│   │   └── react.svg
│   ├── demo/                 # Demo app (not part of the library package)
│   │   ├── DemoApp.tsx       # File upload wrapper + SheetViewer usage
│   │   └── demo.css          # Demo-specific styles
│   ├── lib/                  # === THE LIBRARY (published package) ===
│   │   ├── index.ts          # Public entry point — re-exports component + types
│   │   ├── SheetViewer.tsx   # Root component (forwardRef, ViewerProvider, inner logic)
│   │   ├── types.ts          # All shared TypeScript types and interfaces
│   │   ├── context/
│   │   │   └── ViewerContext.tsx  # Zustand store (instance-scoped), Provider, hooks
│   │   ├── hooks/
│   │   │   ├── useSourceLoader.ts   # Normalizes source prop → ArrayBuffer
│   │   │   └── useFileParser.ts     # Parses buffer → sheet data (main thread, async)
│   │   ├── components/
│   │   │   ├── Grid/
│   │   │   │   ├── VirtualGrid.tsx  # Virtualized spreadsheet grid (row + col virtualizers)
│   │   │   │   ├── Cell.tsx         # Read-only cell renderer
│   │   │   │   └── EditableCell.tsx # Editable cell (edit mode)
│   │   │   ├── Toolbar.tsx          # Top toolbar (download, chart toggle)
│   │   │   ├── FormulaBar.tsx       # Cell reference input + cell value display
│   │   │   ├── SheetTabs.tsx        # Bottom sheet tab bar
│   │   │   ├── StatusBar.tsx        # Bottom status bar (row/col count, selection info)
│   │   │   ├── SearchBar.tsx        # Ctrl+F search overlay
│   │   │   ├── ChartPanel.tsx       # Side panel for creating charts from selection
│   │   │   └── ChartOverlays.tsx    # Floating chart overlays extracted from Excel
│   │   ├── utils/
│   │   │   ├── rangeParser.ts       # A1-style reference parsing (A1, A1:B10, A:A, 1:1)
│   │   │   ├── download.ts          # Export as XLSX or CSV
│   │   │   ├── pivotReconstructor.ts # Reconstruct pivot tables from XLSX XML
│   │   │   └── chartExtractor.ts    # Extract embedded charts from XLSX XML
│   │   ├── styles/
│   │   │   └── sheet-viewer.css     # All component styles (CSS custom properties)
│   │   └── __tests__/
│   │       └── SheetViewer.test.tsx  # Integration tests for the root component
│   └── main.tsx              # Demo app entry point (renders DemoApp in StrictMode)
├── stories/
│   └── SheetViewer.stories.tsx  # 10 Storybook stories (view, edit, highlight, ref, etc.)
├── index.html                # Demo HTML (loads /src/main.tsx)
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json             # TypeScript config (strict, ES2020, React JSX)
├── vite.config.ts            # Vite + Vitest config (dual build modes)
├── vitest.setup.ts           # Test setup (polyfills for JSDOM: ResizeObserver, File.arrayBuffer)
└── eslint.config.js          # ESLint flat config
```

---

## 4. Architecture Overview

### Data Flow

```
Source Prop (URL | File | ArrayBuffer | ArrayBufferView)
  │
  ▼
useSourceLoader (hook)
  │  Normalizes to { buffer: ArrayBuffer, fileName }
  ▼
useFileParser (hook)
  │  Main-thread async parsing with requestAnimationFrame yields
  │  Dynamic import('xlsx') for code-splitting
  │  Progress reported to Zustand store
  ▼
Zustand Store (ViewerContext)
  │  Instance-scoped via createStore + React Context
  │  Holds: sheets, sheetNames, selections, parseState, mode
  ▼
SheetViewer (component tree)
  ├── Toolbar
  ├── FormulaBar
  ├── VirtualGrid (row + col virtualizers from @tanstack/react-virtual)
  │   ├── Cell / EditableCell
  │   └── ChartOverlays (floating)
  ├── ChartPanel (side panel)
  ├── SearchBar
  ├── SheetTabs
  └── StatusBar
```

### Instance-Scoped State

Each `<SheetViewer />` instance gets its own Zustand store, created inside `ViewerProvider`. This means multiple viewers on the same page are fully isolated. The store is created via `createStore()` (not the global `create()`), and accessed through React Context:

- `useViewerStore(selector)` — reactive selector hook
- `useViewerStoreApi()` — returns the raw `StoreApi` for imperative access (used in `useImperativeHandle`)

### Parsing Strategy

Parsing runs on the **main thread** (not a Web Worker) using `async/await` with `requestAnimationFrame` yields between steps. This keeps the UI responsive during parsing while avoiding Worker complexity. The `useFileParser` hook:

1. Dynamically imports `xlsx` (code-split)
2. Reads the workbook
3. Processes each sheet (converts to `CellValue[][]`, handles offsets, merges, column widths)
4. Reconstructs pivot tables from XLSX internal XML (`pivotReconstructor.ts`)
5. Extracts embedded chart overlays from XLSX internal XML (`chartExtractor.ts`)
6. Reports progress (0-100%) to the store at each step

### Virtualization

`VirtualGrid.tsx` creates two `useVirtualizer` instances:
- **Row virtualizer** — virtualizes data rows
- **Column virtualizer** — virtualizes data columns

Constants: `ROW_HEIGHT = 26px`, `COL_WIDTH = 100px`, `ROW_HEADER_WIDTH = 50px`, `COL_HEADER_HEIGHT = 28px`.

Column headers use `colIndexToLetter()` from `rangeParser.ts` for A, B, ..., Z, AA, AB, ... style labels.

---

## 5. Public API

### Component Props (`SheetViewerProps`)

```typescript
interface SheetViewerProps {
  source?: string | File | ArrayBuffer | ArrayBufferView;  // Data source
  mode?: 'view' | 'edit';       // Default: 'view'
  activeSheet?: string;          // Controlled sheet selection
  highlight?: string;            // Excel-style range to highlight (e.g. "A1:D10")
  onSheetChange?: (sheetName: string) => void;
  onCellChange?: (sheet: string, row: number, col: number, value: CellValue) => void;
  onSelectionChange?: (ranges: CellRange[]) => void;
  downloadable?: boolean;        // Show download button
  searchable?: boolean;          // Enable Ctrl+F search (default: true)
  height?: number | string;      // Container height
  width?: number | string;       // Container width
  className?: string;            // Extra CSS class
}
```

### Imperative Handle (`SheetViewerHandle`)

Access via `React.useRef<SheetViewerHandle>()`:

```typescript
interface SheetViewerHandle {
  getSheetNames(): string[];
  getSheetData(sheetName?: string): SheetData | null;
  getActiveSheet(): string | null;
  getAllSheets(): Record<string, SheetData>;
  getFileName(): string | null;
  setActiveSheet(sheetName: string): void;
  setHighlight(range: string): void;
}
```

### Library Exports (`src/lib/index.ts`)

```typescript
export { SheetViewer } from './SheetViewer';     // The component
export type {
  SheetViewerProps, SheetViewerHandle, SheetViewerSource, SheetViewerMode,
  SheetData, CellRange, CellValue, ChartOverlay, ChartSeries, ChartType,
  MergeCell, SelectionState,
} from './types';
```

---

## 6. Build Modes

Vite is configured with two build modes in `vite.config.ts`:

### Demo App Build (`pnpm build`)
- Entry: `index.html` → `src/main.tsx`
- Bundles everything including React, xlsx, Chart.js
- Manual chunks: `xlsx`, `chartjs`, `react-vendor`
- Output: `dist/` (deployable static site)

### Library Build (`pnpm build:lib`)
- Entry: `src/lib/index.ts`
- ES module output: `dist/sheet-viewer.js`
- CSS output: `dist/sheet-viewer.css`
- Externalizes: `react`, `react-dom`, `react/jsx-runtime`
- TypeScript declarations: `dist/types/index.d.ts`

---

## 7. NPM Scripts

| Script | Command | Purpose |
|---|---|---|
| `dev` | `vite` | Start dev server (demo app) |
| `build` | `vite build` | Build demo app |
| `build:lib` | `vite build --mode lib` | Build library package |
| `preview` | `vite preview` | Preview built demo |
| `typecheck` | `tsc --noEmit` | TypeScript type checking |
| `test` | `vitest run` | Run all tests once |
| `test:watch` | `vitest` | Run tests in watch mode |
| `lint` | `eslint .` | Lint the codebase |
| `storybook` | `storybook dev -p 6006` | Start Storybook dev server |
| `build-storybook` | `storybook build` | Build static Storybook |
| `chromatic` | `chromatic --exit-zero-on-changes` | Run Chromatic visual tests |

---

## 8. Testing

### Unit Tests (Vitest + React Testing Library)

Test files follow the `__tests__/` directory convention next to the code they test:

- `src/lib/utils/__tests__/rangeParser.test.ts` — 21 tests for cell reference parsing
- `src/lib/hooks/__tests__/useSourceLoader.test.ts` — 4 tests for source normalization
- `src/lib/__tests__/SheetViewer.test.tsx` — 5 integration tests for the component + imperative handle

**Test environment:** JSDOM with polyfills in `vitest.setup.ts`:
- `ResizeObserver` mock (needed by `@tanstack/react-virtual`)
- `File.prototype.arrayBuffer` polyfill (not available in JSDOM)
- `@testing-library/jest-dom/vitest` matchers

**Note:** `requestAnimationFrame` is mocked in `SheetViewer.test.tsx` to run callbacks synchronously (JSDOM doesn't process rAF automatically).

### Visual Tests (Storybook + Chromatic)

10 stories in `stories/SheetViewer.stories.tsx`:
`FromFile`, `ViewMode`, `EditMode`, `WithHighlight`, `WithDownload`, `CustomSize`, `MultipleInstances`, `ControlledSheet`, `WithRef`, `NoSource`

Stories use `createMockCsvFile()` to generate test data inline (no external fixture files needed).

---

## 9. Styling Conventions

- All styles in `src/lib/styles/sheet-viewer.css`
- CSS custom properties defined on `.sheet-viewer` root (colors, dimensions, fonts)
- All class names prefixed with `sv-` (e.g. `sv-toolbar`, `sv-grid-wrapper`, `sv-cell`)
- No CSS modules, no Tailwind, no CSS-in-JS
- Layout uses CSS Grid for the main shell; the virtual grid uses absolute positioning

---

## 10. Key Design Decisions & Gotchas

### React StrictMode Compatibility
Effects must not use ref-based deduplication patterns like:
```typescript
// BAD — breaks under StrictMode double-fire
if (source === prevRef.current) return;
prevRef.current = source;
```
Instead, rely on the dependency array + cleanup cancellation pattern. This was a real bug that caused the loading UI to freeze at 0%.

### Main Thread Parsing (Not Web Workers)
Parsing runs on the main thread with `requestAnimationFrame` yields. This was a deliberate choice to avoid Worker complexity and serialization overhead. The trade-off is acceptable because parsing is I/O-bound and the rAF yields keep the UI at ~60fps.

### XLSX Internal XML Access
For features that SheetJS doesn't expose (pivot tables, embedded charts), the raw `.xlsx` ZIP is decompressed with `fflate` and the internal XML files are parsed manually:
- `pivotReconstructor.ts` reads `xl/pivotTables/*.xml` and `xl/pivotCache/*.xml`
- `chartExtractor.ts` reads `xl/charts/*.xml` and `xl/drawings/*.xml`

### Column Labels
`colIndexToLetter()` in `rangeParser.ts` generates Excel-style column labels: A, B, ..., Z, AA, AB, ..., up to any column count. The inverse is `colLetterToIndex()`.

### Zustand Store Shape
The store holds everything: file data, parsing state, selections (per-sheet), UI state, and mode. Actions are colocated in the store (not separate action creators). Selectors should be granular to avoid unnecessary re-renders.

### CSS Scoping
All styles are scoped to `.sheet-viewer` or prefixed with `sv-`. The component does not use global styles and should not conflict with host application styles.

---

## 11. How to Add Features

### Adding a new component
1. Create `src/lib/components/MyComponent.tsx`
2. Define a `Props` interface in the file
3. Use `useViewerStore(selector)` to read from the store
4. Import and render it in `SheetViewer.tsx` inside `SheetViewerInner`
5. Add styles to `sheet-viewer.css` with `sv-` prefix

### Adding a new store field
1. Add the field to the `ViewerState` interface in `types.ts`
2. Add the initial value and any actions in `createViewerStore()` in `ViewerContext.tsx`
3. Use `useViewerStore((s) => s.yourField)` in components

### Adding a new prop
1. Add to `SheetViewerProps` in `types.ts`
2. Destructure in `SheetViewerInner` in `SheetViewer.tsx`
3. If it needs imperative access, add to `SheetViewerHandle` in `types.ts` and the `useImperativeHandle` block

### Adding a new utility
1. Create `src/lib/utils/myUtil.ts`
2. Add tests in `src/lib/utils/__tests__/myUtil.test.ts`
3. If it should be publicly exported, add to `src/lib/index.ts`

### Adding a Storybook story
1. Add a new exported function in `stories/SheetViewer.stories.tsx`
2. Use `createMockCsvFile()` for inline test data
3. Add `chromatic: { delay: 1000 }` in parameters if the story needs time to render

---

## 12. Common Commands

```bash
# Install dependencies
pnpm install

# Development
pnpm dev                    # Start demo app at localhost:5173+

# Type checking
pnpm typecheck              # Must pass with 0 errors

# Testing
pnpm test                   # Run all 30 tests
pnpm test:watch             # Watch mode

# Building
pnpm build                  # Build demo app → dist/
pnpm build:lib              # Build library → dist/sheet-viewer.js + .css

# Storybook
pnpm storybook              # Dev server at localhost:6006
pnpm build-storybook        # Static build
pnpm chromatic              # Visual regression (needs CHROMATIC_PROJECT_TOKEN)
```

---

## 13. File-by-File Reference

| File | Lines | Purpose |
|---|---|---|
| `src/lib/types.ts` | ~170 | All shared TypeScript types |
| `src/lib/index.ts` | ~12 | Public library entry point |
| `src/lib/SheetViewer.tsx` | ~218 | Root component with forwardRef |
| `src/lib/context/ViewerContext.tsx` | ~208 | Zustand store + provider |
| `src/lib/hooks/useSourceLoader.ts` | ~75 | Source → ArrayBuffer normalization |
| `src/lib/hooks/useFileParser.ts` | ~297 | Buffer → parsed sheet data |
| `src/lib/components/Grid/VirtualGrid.tsx` | ~432 | Virtualized grid (main render) |
| `src/lib/components/Grid/Cell.tsx` | ~80 | Read-only cell |
| `src/lib/components/Grid/EditableCell.tsx` | ~90 | Editable cell |
| `src/lib/components/Toolbar.tsx` | ~50 | Top toolbar |
| `src/lib/components/FormulaBar.tsx` | ~70 | Formula/range input bar |
| `src/lib/components/SheetTabs.tsx` | ~40 | Sheet tab bar |
| `src/lib/components/StatusBar.tsx` | ~40 | Bottom status bar |
| `src/lib/components/SearchBar.tsx` | ~100 | Ctrl+F search |
| `src/lib/components/ChartPanel.tsx` | ~130 | Chart creation panel |
| `src/lib/components/ChartOverlays.tsx` | ~100 | Floating embedded charts |
| `src/lib/utils/rangeParser.ts` | ~185 | Excel reference parsing |
| `src/lib/utils/download.ts` | ~60 | XLSX/CSV export |
| `src/lib/utils/pivotReconstructor.ts` | ~438 | Pivot table reconstruction |
| `src/lib/utils/chartExtractor.ts` | ~315 | Embedded chart extraction |
| `src/lib/styles/sheet-viewer.css` | ~900 | All component styles |
| `src/demo/DemoApp.tsx` | ~131 | Demo app with file upload |
| `stories/SheetViewer.stories.tsx` | ~230 | 10 Storybook stories |
| `vite.config.ts` | ~46 | Build config (dual mode) |
| `tsconfig.json` | ~20 | TypeScript config |
| `vitest.setup.ts` | ~30 | Test polyfills |

---

## 14. Known Limitations & Future Work

- **No Web Worker parsing** — parsing is main-thread with rAF yields. For truly massive files (500k+ rows), a Worker-based approach may be needed.
- **No dark mode** — CSS variables are defined but only light theme values exist.
- **No keyboard navigation** — arrow key cell navigation is not implemented.
- **No copy/paste** — clipboard integration is not implemented.
- **No column resize** — column widths come from the file or use the default 100px.
- **No row/column freeze** — only sticky headers, no user-defined freeze panes.
- **No sort/filter** — data is displayed as-is from the file.
- **Image extraction** — SheetJS `!images` support is limited; images may not render for all files.
- **PapaParser unused** — listed as a dependency but CSV parsing uses a custom implementation. Could be removed or integrated.
- **README.md** — comprehensive; update if the public API changes.
