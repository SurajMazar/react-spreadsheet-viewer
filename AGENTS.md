# Sheet Viewer — Project Guide for AI Agents

> **Purpose of this file:** Provide any LLM or AI coding assistant with full context to understand, navigate, modify, and extend this project without needing to re-explore the codebase from scratch.

---

## 1. What This Project Is

**Sheet Viewer** is a reusable React component library that parses and renders Excel (`.xlsx`, `.xls`) and CSV files in a Google Sheets-like UI. It is published on npm as **`rc-sheet-viewer-17`**. It is designed to:

- Handle very large datasets (100k+ rows, 100+ columns) via virtualized rendering.
- Be embedded in any React application as a drop-in `<SheetViewer />` component.
- Support both **view** and **edit** modes.
- Accept data via props (URL string, `File`, `ArrayBuffer`, or `ArrayBufferView`) — not through an internal upload UI.
- Expose an imperative API via `React.forwardRef` for programmatic access to sheet data and navigation.

The project also includes a **demo application** (with file upload) and **Storybook** stories for component documentation and visual testing with **Chromatic**.

### Installation (for consumers)

```bash
npm install rc-sheet-viewer-17
# or
pnpm add rc-sheet-viewer-17
```

```tsx
import { SheetViewer } from 'rc-sheet-viewer-17';
import 'rc-sheet-viewer-17/style.css';
```

Full TypeScript support is included — all props, handle types, and data types are exported.

---

## 2. Tech Stack

| Concern | Library / Tool | Notes |
|---|---|---|
| Framework | React 17 / 18 / 19 | Uses `forwardRef`, `useImperativeHandle`; peer dep supports 17+ |
| Build | Vite 7 | Dual build: demo app + library package |
| Language | TypeScript (strict) | Full codebase, no JS files in `src/` |
| Type Generation | vite-plugin-dts | Generates rolled-up `.d.ts` declarations during library build |
| State | Zustand 5 (`zustand/vanilla` + `zustand/traditional`) | Instance-scoped stores; uses `use-sync-external-store` shim for React 17 compat |
| Virtualization | @tanstack/react-virtual 3 | Two `useVirtualizer` instances (rows + columns) |
| Excel Parsing | xlsx (SheetJS) 0.18 | Dynamic `import()` for code-splitting |
| CSV Parsing | Custom parser | In `useFileParser.ts`, no external dep for CSV |
| Charts | Chart.js 4 + react-chartjs-2 5 | Statically imported; tree-shakeable; bar, line, pie, area |
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
│   │   │   │   ├── VirtualGrid.tsx  # Virtualized spreadsheet grid (row + col virtualizers, resize handles)
│   │   │   │   ├── Cell.tsx         # Read-only cell renderer (wrapping, comments, conditional formatting)
│   │   │   │   └── EditableCell.tsx # Editable cell (with data validation: dropdowns, number/date rules)
│   │   │   ├── Toolbar.tsx          # Top toolbar (download, chart toggle)
│   │   │   ├── FormulaBar.tsx       # Cell reference input + cell value display
│   │   │   ├── SheetTabs.tsx        # Bottom sheet tab bar
│   │   │   ├── StatusBar.tsx        # Bottom status bar (row/col count, selection info)
│   │   │   ├── SearchBar.tsx        # Ctrl+F search overlay
│   │   │   ├── ChartPanel.tsx       # Side panel for creating charts from selection
│   │   │   └── ChartOverlays.tsx    # Floating chart overlays extracted from Excel
│   │   ├── formula/                 # Formula engine
│   │   │   ├── parser.ts           # Tokenizer + recursive descent AST parser
│   │   │   ├── evaluator.ts        # AST evaluator with cell reference resolution
│   │   │   ├── functions.ts        # 24 built-in functions (SUM, IF, VLOOKUP, etc.)
│   │   │   └── index.ts            # Public API
│   │   ├── conditionalFormat/
│   │   │   └── evaluator.ts        # Rule evaluator (greaterThan, colorScale, dataBar, etc.)
│   │   ├── validation/
│   │   │   └── validator.ts        # Data validation (list, number, date, custom)
│   │   ├── utils/
│   │   │   ├── rangeParser.ts       # A1-style reference parsing (A1, A1:B10, A:A, 1:1)
│   │   │   ├── clipboard.ts         # TSV + HTML copy/paste with style preservation
│   │   │   ├── download.ts          # Export as XLSX or CSV
│   │   │   ├── pivotReconstructor.ts # Reconstruct pivot tables from XLSX XML
│   │   │   ├── chartExtractor.ts    # Extract embedded charts from XLSX XML
│   │   │   └── styleExtractor.ts    # Extract cell styles from XLSX XML
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
├── vercel.json               # Vercel deployment config (SPA rewrites for demo app)
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
  ├── Toolbar (conditionally shows Charts button via `chartable` prop)
  ├── FormulaBar
  ├── VirtualGrid (row + col virtualizers from @tanstack/react-virtual)
  │   ├── Cell / EditableCell (with merged cell rendering)
  │   ├── ChartOverlays (floating)
  │   ├── Keyboard: Ctrl+C/V for clipboard (TSV, Excel-compatible)
  │   └── Wheel handler: nested-container-safe horizontal scroll
  ├── ChartPanel (side panel, hidden when chartable=false)
  ├── SearchBar
  ├── SheetTabs (scrollable with visible scrollbar)
  └── StatusBar
```

### Instance-Scoped State

Each `<SheetViewer />` instance gets its own Zustand store, created inside `ViewerProvider`. This means multiple viewers on the same page are fully isolated. The store is created via `createStore()` from `zustand/vanilla` (pure JS, no React dependency), and accessed through React Context with `useStoreWithEqualityFn` from `zustand/traditional` (which uses the `use-sync-external-store/shim` for React 17 compatibility):

- `useViewerStore(selector)` — reactive selector hook (wraps `useStoreWithEqualityFn`)
- `useViewerStoreApi()` — returns the raw `StoreApi` for imperative access (used in `useImperativeHandle`)

**React 17 Compatibility:** The standard `useStore` from `zustand` uses `React.useSyncExternalStore` (React 18+ only). By using `zustand/traditional` instead, the library uses the `use-sync-external-store/shim` which provides a backward-compatible implementation for React 17+. This shim is bundled into the library output — consumers do not need to install it.

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
  chartable?: boolean;           // Show Charts button in toolbar (default: true)
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
  getCellRangeData(range: string, sheetName?: string): CellValue[][] | null;
  getSelectedRangeData(): CellValue[][] | null;
  setActiveSheet(sheetName: string): void;
  setHighlight(range: string): void;
  setColumnWidth(colIndex: number, width: number, sheetName?: string): void;
  setRowHeight(rowIndex: number, height: number, sheetName?: string): void;
  getCellComment(cellRef: string, sheetName?: string): CellComment | null;
  setCellComment(cellRef: string, text: string | null, author?: string, sheetName?: string): void;
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
}
```

### Library Exports (`src/lib/index.ts`)

```typescript
export { SheetViewer } from './SheetViewer';
export type {
  SheetViewerProps, SheetViewerHandle, SheetViewerSource, SheetViewerMode,
  SheetData, CellRange, CellValue, CellComment, CellStyle,
  ChartOverlay, ChartSeries, ChartType,
  ConditionalFormatRule, ConditionalFormatRuleType,
  MergeCell, SelectionState,
  UndoEntry, ValidationRule, ValidationRuleType,
} from './types';
```

**CSS import:** Consumers must also import the stylesheet:
```typescript
import 'rc-sheet-viewer-17/style.css';
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
- ES module entry: `dist/sheet-viewer.js` (~0.1KB, re-exports from main chunk)
- Main chunk: `dist/index-*.js` (~70KB gzipped: ~18KB) — component code, virtualization, zustand, shim
- Chart chunk: `dist/index-*.js` (~255KB gzipped: ~73KB) — chart.js + react-chartjs-2, lazy-loaded
- Chart components: `dist/ChartPanel-*.js` + `dist/ChartOverlays-*.js` (~9KB) — lazy-loaded
- CSS output: `dist/sheet-viewer.css`
- TypeScript declarations: `dist/types/index.d.ts` (generated by `vite-plugin-dts` with `rollupTypes: true`)
- Externalizes: `react`, `react-dom`, `react/jsx-runtime` (consumers provide their own React)
- Code-split dynamic chunks: `xlsx`, `fflate` (browser), `chartExtractor`, `pivotReconstructor`, `styleExtractor`

**Initial load size:** Consumers only load ~70KB of JavaScript on first render. Chart.js (~255KB) and xlsx (~695KB) load lazily on demand.

### Dependency Strategy

```
peerDependencies:  react, react-dom           → Consumer provides (React 17, 18, or 19)
dependencies:      xlsx, zustand, fflate, etc. → Bundled into library output at build time
devDependencies:   react, react-dom, vite, ... → Local dev/test only, not shipped
```

**Important:** `react` and `react-dom` must remain as `peerDependencies` (not `dependencies`). If moved to `dependencies`, consumers get a duplicate React runtime which breaks hooks with "Invalid hook call" errors.

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

Test files follow the `__tests__/` directory convention next to the code they test. **421 tests** across **12 test files**:

- `src/lib/utils/__tests__/rangeParser.test.ts` — 21 tests for cell reference parsing
- `src/lib/utils/__tests__/clipboard.test.ts` — 42 tests for TSV/HTML serialization, style extraction, and roundtrips
- `src/lib/utils/__tests__/download.test.ts` — 8 tests for export utilities
- `src/lib/hooks/__tests__/useSourceLoader.test.ts` — 4 tests for source normalization
- `src/lib/__tests__/SheetViewer.test.tsx` — 28 integration tests for the root component and imperative handle
- `src/lib/components/Grid/__tests__/Cell.test.tsx` — 42 tests (rendering, selection, merged cells, text wrapping, comments)
- `src/lib/components/Grid/__tests__/EditableCell.test.tsx` — 14 tests for editable cell
- `src/lib/context/__tests__/ViewerContext.test.ts` — 41 tests for store actions (including setCellStyle, setColumnWidth, setRowHeight, setCellComment, undo/redo)
- `src/lib/formula/__tests__/parser.test.ts` — 39 tests for formula tokenizer and parser
- `src/lib/formula/__tests__/evaluator.test.ts` — 41 tests for formula evaluation and cell resolution
- `src/lib/formula/__tests__/functions.test.ts` — 94 tests for 24 formula functions (math, logical, text, lookup)
- `src/lib/validation/__tests__/validator.test.ts` — 27 tests for data validation (list, number, date, custom)
- `src/lib/conditionalFormat/__tests__/evaluator.test.ts` — 37 tests for conditional format rule evaluation

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

### React 17 Compatibility
The library supports React 17, 18, and 19. Key considerations:
- **Zustand:** Uses `zustand/vanilla` (pure JS store creation) + `zustand/traditional` (React hook with `use-sync-external-store/shim`). Do NOT switch to `useStore` from `zustand` — it uses `React.useSyncExternalStore` which is React 18+ only.
- **No React 18+ APIs:** The library must not use `useId`, `useTransition`, `useDeferredValue`, `useInsertionEffect`, or `startTransition`.
- **JSX transform:** Uses `"jsx": "react"` (classic transform) with explicit `import React from 'react'` in all JSX files. The build uses `jsxRuntime: 'classic'` in `vite.config.ts`.
- **`@tanstack/react-virtual`:** Does NOT use `useSyncExternalStore`; it uses `useState` + `onChange` internally, so it works with React 17. Virtual item `key` values are wrapped with `String()` because React 17's `Key` type does not include `bigint`.
- **Testing:** Uses `@testing-library/react@12` (the last version supporting React 17). A custom `renderHook` helper is used for hook tests since v12 does not export `renderHook`. The `react-chartjs-2` package is inlined via `server.deps.inline` in Vitest config to resolve `react/jsx-runtime` imports.

### Chart Components
`ChartPanel` and `ChartOverlays` are statically imported. The `chartable` prop (default: `true`) controls whether the Charts button appears in the toolbar. When `chartable={false}`, neither the chart button nor the chart panel renders.

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
pnpm test                   # Run all 421 tests
pnpm test:watch             # Watch mode

# Building
pnpm build                  # Build demo app → dist/
pnpm build:lib              # Build library → dist/sheet-viewer.js + .css + .d.ts

# Storybook
pnpm storybook              # Dev server at localhost:6006
pnpm build-storybook        # Static build
pnpm chromatic              # Visual regression (needs CHROMATIC_PROJECT_TOKEN)

# Publishing to npm (as rc-sheet-viewer-17)
# pnpm build:lib runs automatically via prepublishOnly script
npm publish --otp=<code>    # Requires 2FA OTP from authenticator app
```

---

## 13. File-by-File Reference

| File | Lines | Purpose |
|---|---|---|
| `src/lib/types.ts` | ~185 | All shared TypeScript types |
| `src/lib/index.ts` | ~12 | Public library entry point |
| `src/lib/SheetViewer.tsx` | ~236 | Root component with forwardRef |
| `src/lib/context/ViewerContext.tsx` | ~208 | Zustand store + provider |
| `src/lib/hooks/useSourceLoader.ts` | ~75 | Source → ArrayBuffer normalization |
| `src/lib/hooks/useFileParser.ts` | ~297 | Buffer → parsed sheet data |
| `src/lib/components/Grid/VirtualGrid.tsx` | ~550 | Virtualized grid (main render, merge handling, copy/paste, scroll fixes) |
| `src/lib/components/Grid/Cell.tsx` | ~87 | Read-only cell (with merged cell support) |
| `src/lib/components/Grid/EditableCell.tsx` | ~90 | Editable cell |
| `src/lib/components/Toolbar.tsx` | ~50 | Top toolbar |
| `src/lib/components/FormulaBar.tsx` | ~70 | Formula/range input bar |
| `src/lib/components/SheetTabs.tsx` | ~40 | Sheet tab bar |
| `src/lib/components/StatusBar.tsx` | ~40 | Bottom status bar |
| `src/lib/components/SearchBar.tsx` | ~100 | Ctrl+F search |
| `src/lib/components/ChartPanel.tsx` | ~130 | Chart creation panel |
| `src/lib/components/ChartOverlays.tsx` | ~100 | Floating embedded charts |
| `src/lib/utils/rangeParser.ts` | ~185 | Excel reference parsing |
| `src/lib/utils/clipboard.ts` | ~147 | TSV copy/paste utilities for Excel-compatible clipboard |
| `src/lib/utils/download.ts` | ~60 | XLSX/CSV export |
| `src/lib/utils/pivotReconstructor.ts` | ~438 | Pivot table reconstruction |
| `src/lib/utils/chartExtractor.ts` | ~315 | Embedded chart extraction |
| `src/lib/styles/sheet-viewer.css` | ~923 | All component styles (includes merged cell, selection highlight, sheet tab scrollbar) |
| `src/demo/DemoApp.tsx` | ~131 | Demo app with file upload |
| `stories/SheetViewer.stories.tsx` | ~230 | 10 Storybook stories |
| `vite.config.ts` | ~54 | Build config (dual mode + vite-plugin-dts) |
| `tsconfig.json` | ~20 | TypeScript config |
| `vitest.setup.ts` | ~30 | Test polyfills |
| `vercel.json` | ~8 | Vercel deployment config (SPA rewrites for demo) |

---

## 14. npm Package Details

| Field | Value |
|---|---|
| Package name | `rc-sheet-viewer-17` |
| Registry | https://registry.npmjs.org/ |
| Entry (ESM) | `./dist/sheet-viewer.js` |
| Types | `./dist/types/index.d.ts` |
| CSS | `./dist/sheet-viewer.css` (import as `rc-sheet-viewer-17/style.css`) |
| Peer deps | `react` (17, 18, or 19), `react-dom` (17, 18, or 19) |
| `files` field | `["dist"]` — only the `dist/` directory is included in the tarball |

### Publishing Checklist

1. Bump version in `package.json`
2. Run `pnpm build:lib` (generates JS, CSS, and `.d.ts` types — also runs automatically via `prepublishOnly`)
3. Verify `dist/types/index.d.ts` exists and exports `SheetViewer`
4. Run `npm publish --otp=<2FA code>` (account requires two-factor auth)

---

## 15. Known Limitations & Future Work

- **No Web Worker parsing** — parsing is main-thread with rAF yields. For truly massive files (500k+ rows), a Worker-based approach may be needed.
- **No dark mode** — CSS variables are defined but only light theme values exist.
- **No row/column freeze** — only sticky headers, no user-defined freeze panes.
- **No sort/filter** — data is displayed as-is from the file.
- **Image extraction** — SheetJS `!images` support is limited; images may not render for all files.
- **README.md** — comprehensive; update if the public API changes.

## 16. Recently Added Features

These features were added after the initial release:

### Copy & Paste with Style Preservation
Full clipboard support writing both HTML (with inline styles) and TSV formats via `navigator.clipboard.write()`. On paste, HTML is preferred (preserving colors, bold, italic); falls back to TSV for plain-text sources. Utility functions in `src/lib/utils/clipboard.ts`.

### Column/Row Resize
Draggable resize handles on column and row headers. Column handles on the right edge (7px grab zone), row handles on the bottom edge (7px grab zone). Minimum widths: column 30px, row 20px. Store actions: `setColumnWidth`, `setRowHeight`. Imperative API: `ref.setColumnWidth(col, width)`, `ref.setRowHeight(row, height)`. Virtualizer cache is invalidated via `measure()` when sizes change. Cursor locks to `col-resize`/`row-resize` during active drag.

### Text Wrapping
Cells with `wrapText: true` in their `CellStyle` render with `white-space: normal` and word wrapping. The `.sv-cell-text-wrap` CSS class enables multi-line display.

### Cell Comments
Red triangle indicator in the top-right corner of cells with comments. Hover shows author and text via native `title` attribute. Store action: `setCellComment`. Imperative API: `ref.getCellComment("A1")`, `ref.setCellComment("A1", "text", "author")`. Comment type exported as `CellComment`.

### Conditional Formatting
Rule-based cell styling evaluated at render time. Supports: `greaterThan`, `lessThan`, `between`, `equalTo`, `textContains`, `top10`, `bottom10`, `colorScale` (2/3-color gradients), `dataBar`. Rules stored in `SheetData.conditionalFormats`. Evaluator in `src/lib/conditionalFormat/evaluator.ts`.

### Data Validation
Cell input validation with UI feedback. Types: `list` (renders `<select>` dropdown), `number` (min/max range), `date` (range constraints), `custom`. Invalid input shows red border and error tooltip. Rules stored in `SheetData.validations`. Validator in `src/lib/validation/validator.ts`.

### Formula Engine
Recursive descent parser + evaluator for Excel-style formulas. 24 built-in functions: SUM, AVERAGE, COUNT, COUNTA, MIN, MAX, ABS, SQRT, POWER, ROUND, IF, AND, OR, NOT, CONCATENATE, LEFT, RIGHT, MID, LEN, UPPER, LOWER, TRIM, VLOOKUP, HLOOKUP, INDEX, MATCH. Supports cell references (A1, $A$1), ranges (A1:B10), arithmetic, comparisons, string concatenation, and nested function calls. Source in `src/lib/formula/`.

### Merged Cell Rendering
Cells that are merged in the source Excel file are rendered as a single visual cell spanning the merged area. Uses a `mergeMap` lookup in `VirtualGrid.tsx`.

### Chartable Prop
The `chartable` prop (default: `true`) controls visibility of the Charts button in the toolbar and the ChartPanel side panel.

### getCellRangeData Imperative Method
`ref.current.getCellRangeData('A1:C5')` returns a 2D array of cell values for any Excel-style range. Supports optional `sheetName` parameter.

### Scrollable Sheet Tabs
The sheet tab bar now has a visible thin scrollbar for workbooks with many sheets.

### Improved Selection Highlight
Google Sheets-style mutually exclusive selection: active cell outline OR range tint, never both. Marching ants copy indicator.

### Scroll-to-Center for Highlights
When `highlight` prop is set or `setHighlight` is called, the grid scrolls the range to the center of the viewport.

### Nested Container Horizontal Scroll
Trackpad/mouse horizontal scrolling works correctly even when the SheetViewer is embedded in nested scrollable containers.

### Undo/Redo
Ctrl+Z (undo) and Ctrl+Y or Ctrl+Shift+Z (redo) for cell edits and paste operations. Store holds `undoStack` and `redoStack` (max 100 entries). Each entry tracks cell value and style changes per sheet. Imperative API: `ref.undo()`, `ref.redo()`, `ref.canUndo()`, `ref.canRedo()`.

### Empty Cell Edit Fix
Editing cells beyond the current data bounds (in the extended "Google Sheets-like" empty area) now correctly persists. `setCellValue` extends the data array and updates `rows`/`cols` metadata as needed. Paste into empty areas also works.

### Large Cell Content (Google Sheets Behavior)
When the active cell has long content, the text expands to show the full value (overflow visible, `flex-shrink: 0` on the text span). Inactive cells remain truncated with ellipsis. The formula bar always shows the full value.
