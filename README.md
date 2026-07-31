# rc-sheet-viewer-17

A high-performance React component for viewing and editing Excel and CSV files with a Google Sheets-like interface. Handles 100k+ rows with virtualized rendering, embedded chart extraction, pivot table reconstruction, and a clean, familiar spreadsheet UI. Compatible with React 17, 18, and 19.

[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org/)
[![React 17+](https://img.shields.io/badge/React-17%20%7C%2018%20%7C%2019-61dafb)](https://react.dev/)
[![Storybook](https://img.shields.io/badge/Storybook-stories-ff4785)](https://storybook.js.org/)

---

## Features

- **File format support** — `.xlsx`, `.xls`, and `.csv` parsed entirely client-side
- **Virtualized grid** — row and column virtualization via TanStack Virtual; renders 100k+ rows smoothly
- **Google Sheets-like UI** — column headers (A, B, ... Z, AA ...), row numbers, sticky headers, sheet tabs, formula bar, status bar
- **View & edit modes** — read-only viewing or inline cell editing, controlled via props
- **Multiple sheets** — tab-based sheet switching with per-sheet selection state
- **Range highlighting** — pass Excel-style references like `A1:D10` to highlight and scroll into view
- **Clear highlight API** — remove the active range via `ref.current?.clearHighlight()` or `setHighlight('')`
- **Highlight area ref** — get one DOM element spanning the whole highlighted range via `highlightAreaRef`, for anchoring your own popovers
- **Single-cell focus without range tint** — clicking one cell focuses it and updates the formula bar, but does not create a visible 1x1 highlight
- **Custom highlight colors** — override the selection fill and border color via props
- **Separate search highlight** — Ctrl+F search uses its own independent highlight with customizable colors
- **Grid lines** — data-driven visible borders on arbitrary ranges (like Excel's "All Borders")
- **Theme system** — override the entire library color palette via a single `theme` prop object
- **Show/hide toolbar** — control full toolbar visibility with `showToolbar`, or hide only the filename with `showFileName`
- **Embedded charts** — extracts charts from Excel files and renders them as floating overlays using Chart.js
- **Pivot table reconstruction** — reads pivot table definitions from XLSX internals and reconstructs the output
- **Search** — Ctrl+F search across the active sheet with dedicated highlight colors
- **Download** — export the current data as `.xlsx` or `.csv`
- **Charts from selection** — select a data range and create bar, line, pie, or area charts dynamically
- **Copy & paste with formatting** — Ctrl+C/V with both HTML (preserving styles) and TSV clipboard formats
- **Undo/redo** — Ctrl+Z and Ctrl+Y (or Ctrl+Shift+Z) for cell edits and paste
- **Column/row resize** — drag column and row header edges to resize
- **Merged cells** — visually renders merged cell ranges from Excel files
- **Text wrapping** — cells with `wrapText` style render multi-line content
- **Cell comments** — red triangle indicator with hover tooltip for commented cells
- **Conditional formatting** — rule-based cell styling (value comparisons, color scales, data bars)
- **Data validation** — input validation with dropdown lists, number/date ranges, and error UI
- **Formula engine** — parse and evaluate Excel-style formulas (24 built-in functions: SUM, IF, VLOOKUP, etc.)
- **Imperative API** — access sheet data, navigate sheets, resize columns, manage comments, undo/redo, and more via ref
- **Selection callback with DOM info** — `onSelectionChange` provides the anchor cell's `HTMLElement` and `DOMRect`
- **Highlightable** — disable all cell/range highlight visuals with `highlightable={false}`
- **Sheet select callback** — `onSheetSelect` fires when the user clicks a sheet tab
- **Large cell content** — active cell expands to show full text (Google Sheets-style)
- **Instance isolation** — multiple `<SheetViewer />` components on the same page are fully independent
- **Nested container support** — horizontal trackpad/mouse scrolling works in nested scrollable containers
- **Zero global styles** — all CSS scoped under `.sheet-viewer` with `sv-` prefixed classes

---

## Installation

```bash
pnpm add rc-sheet-viewer-17
# or
npm install rc-sheet-viewer-17
# or
yarn add rc-sheet-viewer-17
```

**Peer dependencies:** `react >= 17` and `react-dom >= 17`

---

## Quick Start

```tsx
import { SheetViewer } from 'rc-sheet-viewer-17';
import 'rc-sheet-viewer-17/style.css';

function App() {
  return (
    <SheetViewer
      source="/path/to/spreadsheet.xlsx"
      mode="view"
      height="100vh"
      width="100%"
      downloadable
      searchable
    />
  );
}
```

---

## Source Types

The `source` prop accepts multiple formats:

```tsx
// URL string — fetched automatically
<SheetViewer source="https://example.com/data.xlsx" />

// File object — from an <input type="file"> or drag-and-drop
<SheetViewer source={fileFromInput} />

// ArrayBuffer — from any binary source
<SheetViewer source={arrayBuffer} />

// TypedArray (Uint8Array, etc.)
<SheetViewer source={uint8Array} />
```

---

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `source` | `string \| File \| ArrayBuffer \| ArrayBufferView` | — | Data source to load |
| `mode` | `'view' \| 'edit'` | `'view'` | View-only or editable mode |
| `activeSheet` | `string` | — | Controlled active sheet name |
| `highlight` | `string` | — | Excel-style range to highlight (e.g. `"A1:D10"`) |
| `highlightColor` | `string` | — | Custom fill color for the highlighted range (e.g. `"rgba(255,0,0,0.1)"`) |
| `highlightBorderColor` | `string` | — | Custom border color for the highlighted range (e.g. `"#ff0000"`) |
| `highlightable` | `boolean` | `true` | When `false`, all selection/highlight visuals are suppressed |
| `highlightAreaRef` | `Ref<HTMLDivElement>` | — | Receives one DOM element spanning the entire highlighted area; `null` when no highlight. See [Anchoring UI to the highlighted area](#anchoring-ui-to-the-highlighted-area) |
| `gridLines` | `GridLineConfig[]` | — | Draw visible cell borders on specific ranges (like Excel's All Borders) |
| `showToolbar` | `boolean` | `true` | Show or hide the entire toolbar row |
| `showFileName` | `boolean` | `true` | Show or hide only the filename/logo in the toolbar. Charts & Download remain visible |
| `theme` | `SheetViewerTheme` | — | Override the entire color palette of the library |
| `searchMatchColor` | `string` | — | Background color for search match cells (default: `rgba(255,213,79,0.35)`) |
| `searchActiveColor` | `string` | — | Background color for the active/current search match (default: `rgba(255,152,0,0.55)`) |
| `onSheetChange` | `(sheetName: string) => void` | — | Called when the user switches sheets |
| `onSheetSelect` | `(sheetName: string) => void` | — | Called when the user clicks a sheet tab |
| `onCellChange` | `(sheet, row, col, value) => void` | — | Called when a cell is edited |
| `onSelectionChange` | `(ranges: CellRange[], cellInfo?) => void` | — | Called when selection changes; includes anchor cell element + bounding rect |
| `downloadable` | `boolean` | `false` | Show a download button in the toolbar |
| `chartable` | `boolean` | `true` | Show Charts button in toolbar |
| `searchable` | `boolean` | `true` | Enable Ctrl+F search |
| `height` | `number \| string` | `'100%'` | Container height (px or CSS value) |
| `width` | `number \| string` | `'100%'` | Container width (px or CSS value) |
| `className` | `string` | `''` | Additional CSS class on the root element |

---

## Imperative API (Ref)

Access sheet data and control navigation programmatically:

```tsx
import { useRef } from 'react';
import { SheetViewer } from 'rc-sheet-viewer-17';
import type { SheetViewerHandle } from 'rc-sheet-viewer-17';

function App() {
  const ref = useRef<SheetViewerHandle>(null);

  const handleClick = () => {
    // Get all sheet names
    console.log(ref.current?.getSheetNames());

    // Get data for the active sheet
    const data = ref.current?.getSheetData();
    console.log(`${data?.rows} rows, ${data?.cols} cols`);

    // Get data for a specific cell range
    const rangeData = ref.current?.getCellRangeData('A1:C10');
    console.log(rangeData); // CellValue[][] | null

    // Get data for the current mouse/drag selection
    const selData = ref.current?.getSelectedRangeData();

    // Switch to a specific sheet
    ref.current?.setActiveSheet('Sheet2');

    // Highlight a range (triggers onSelectionChange)
    ref.current?.setHighlight('A1:F20');

    // Highlight silently (does NOT trigger onSelectionChange)
    ref.current?.setHighlight('A1:F20', { silent: true });

    // Clear the current highlight / selection
    ref.current?.clearHighlight();

    // Clear silently (does NOT trigger onSelectionChange)
    ref.current?.clearHighlight({ silent: true });

    // Get the current highlight/selection range string
    const range = ref.current?.getHighlight(); // e.g. "A1:D10" or null

    // Undo / redo
    if (ref.current?.canUndo()) ref.current.undo();
    if (ref.current?.canRedo()) ref.current.redo();
  };

  return (
    <>
      <button onClick={handleClick}>Inspect</button>
      <SheetViewer ref={ref} source={file} />
    </>
  );
}
```

### Handle Methods

| Method | Return | Description |
|---|---|---|
| `getSheetNames()` | `string[]` | All sheet names in the workbook |
| `getSheetData(name?)` | `SheetData \| null` | Data for a sheet (defaults to active) |
| `getActiveSheet()` | `string \| null` | Currently active sheet name |
| `getAllSheets()` | `Record<string, SheetData>` | All parsed sheets |
| `getFileName()` | `string \| null` | The loaded file name |
| `getCellRangeData(range, name?)` | `CellValue[][] \| null` | Get data for an Excel-style range |
| `getSelectedRangeData()` | `CellValue[][] \| null` | Get data for the current drag selection |
| `setActiveSheet(name)` | `void` | Switch to a sheet |
| `setHighlight(range, options?)` | `void` | Highlight a range. Pass `''` to clear. `{ silent: true }` suppresses `onSelectionChange` |
| `clearHighlight(options?)` | `void` | Remove the current highlight. `{ silent: true }` suppresses `onSelectionChange` |
| `getHighlight()` | `string \| null` | Current highlight/selection range string (e.g. `"A1:D10"`) |
| `getHighlightElement()` | `HTMLElement \| null` | The single element spanning the highlighted area (same one `highlightAreaRef` receives) |
| `scrollToSelection()` | `boolean` | Scroll so the whole selection is visible; `false` if nothing is selected |
| `setColumnWidth(col, width, name?)` | `void` | Set column width in pixels (min 30px) |
| `setRowHeight(row, height, name?)` | `void` | Set row height in pixels (min 20px) |
| `getCellComment(cellRef, name?)` | `CellComment \| null` | Get comment for a cell |
| `setCellComment(cellRef, text, author?, name?)` | `void` | Set or remove a cell comment |
| `undo()` | `void` | Undo the last cell edit or paste |
| `redo()` | `void` | Redo the last undone edit |
| `canUndo()` | `boolean` | Whether undo is available |
| `canRedo()` | `boolean` | Whether redo is available |

---

## Custom Highlight Colors

Override the default blue selection with any fill and border color:

```tsx
<SheetViewer
  source={file}
  highlight="B2:D10"
  highlightColor="rgba(255, 0, 0, 0.12)"
  highlightBorderColor="#e53935"
/>
```

To remove a highlight programmatically:

```tsx
ref.current?.clearHighlight();
ref.current?.clearHighlight({ silent: true });

// Equivalent clear via the existing API:
ref.current?.setHighlight('');
```

---

## Grid Lines

Draw visible Excel-style cell borders on arbitrary ranges:

```tsx
import type { GridLineConfig } from 'rc-sheet-viewer-17';

const gridLines: GridLineConfig[] = [
  // Bold blue header row with background
  { range: 'A1:F1', borderColor: '#1a73e8', borderWidth: 2, bgColor: '#e8f0fe' },
  // Light gray border for all data cells
  { range: 'A2:F50', borderColor: '#dadce0', borderWidth: 1 },
  // Dashed red highlight zone
  { range: 'C2:C50', borderColor: '#ea4335', borderWidth: 1, borderStyle: 'dashed' },
];

<SheetViewer source={file} gridLines={gridLines} />
```

### `GridLineConfig` fields

| Field | Type | Default | Description |
|---|---|---|---|
| `range` | `string` | required | Excel-style range e.g. `"A1:D10"` |
| `borderColor` | `string` | `var(--sv-color-border)` | Border color |
| `borderWidth` | `number` | `1` | Border width in pixels |
| `borderStyle` | `'solid' \| 'dashed' \| 'dotted'` | `'solid'` | Border style |
| `bgColor` | `string` | — | Optional background fill for cells in this range |

---

## Theme Customization

Override the entire library color palette with a `theme` prop:

```tsx
import type { SheetViewerTheme } from 'rc-sheet-viewer-17';

const darkTheme: SheetViewerTheme = {
  bgColor: '#1e1e2e',
  surfaceColor: '#181825',
  borderColor: '#313244',
  borderLightColor: '#45475a',
  textColor: '#cdd6f4',
  textSecondaryColor: '#a6adc8',
  textMutedColor: '#6c7086',
  primaryColor: '#89b4fa',
  primaryLightColor: '#313244',
  primaryBgColor: '#1e1e2e',
  selectionColor: 'rgba(137,180,250,0.15)',
  selectionHoverColor: 'rgba(137,180,250,0.25)',
  headerBgColor: '#181825',
  headerTextColor: '#a6adc8',
  hoverColor: '#313244',
};

<SheetViewer source={file} theme={darkTheme} />
```

### `SheetViewerTheme` fields

| Field | CSS Variable | Description |
|---|---|---|
| `bgColor` | `--sv-color-bg` | Main background color |
| `surfaceColor` | `--sv-color-surface` | Secondary background (toolbars, headers) |
| `borderColor` | `--sv-color-border` | Default border color |
| `borderLightColor` | `--sv-color-border-light` | Light border color |
| `textColor` | `--sv-color-text` | Primary text color |
| `textSecondaryColor` | `--sv-color-text-secondary` | Secondary text color |
| `textMutedColor` | `--sv-color-text-muted` | Muted/placeholder text |
| `primaryColor` | `--sv-color-primary` | Primary accent color |
| `primaryLightColor` | `--sv-color-primary-light` | Light primary variant |
| `primaryBgColor` | `--sv-color-primary-bg` | Very light primary background |
| `selectionColor` | `--sv-color-selection` | Range selection fill color |
| `selectionHoverColor` | `--sv-color-selection-hover` | Range selection fill on hover |
| `headerBgColor` | `--sv-color-header-bg` | Column/row header background |
| `headerTextColor` | `--sv-color-header-text` | Column/row header text |
| `hoverColor` | `--sv-color-hover` | Cell hover background |

You can also override these directly in CSS:

```css
.sheet-viewer {
  --sv-color-primary: #7c3aed;
  --sv-color-selection: rgba(124, 58, 237, 0.1);
}
```

---

## Search Highlight Colors

Customize the colors used to highlight search matches independently from the selection:

```tsx
<SheetViewer
  source={file}
  searchMatchColor="rgba(255, 213, 79, 0.45)"     // all matches — yellow
  searchActiveColor="rgba(255, 152, 0, 0.7)"      // current match — orange
/>
```

Press Ctrl+F (Cmd+F) to open search. Matches are shown with a dedicated highlight that does **not** interfere with the user's cell selection.

**Priority:** Search match highlights always take precedence over the range selection highlight — if a cell is both selected and a search match, the search color wins.

---

## Show / Hide Toolbar

```tsx
// Hide the entire toolbar row
<SheetViewer source={file} showToolbar={false} />

// Hide just the filename/logo, keep Charts and Download buttons
<SheetViewer source={file} showFileName={false} downloadable chartable />

// Show everything (defaults)
<SheetViewer source={file} showToolbar={true} showFileName={true} downloadable chartable />
```

`showToolbar={false}` removes the whole toolbar row. `showFileName={false}` keeps the toolbar but hides only the logo and filename text, leaving Charts and Download visible.

---

## Selection Callback with Cell DOM Info

`onSelectionChange` provides the DOM element and bounding rect of the anchor cell for drag selections and programmatic highlights, useful for positioning custom popovers or tooltips:

```tsx
<SheetViewer
  source={file}
  onSelectionChange={(ranges, cellInfo) => {
    console.log('Selected ranges:', ranges);
    if (cellInfo) {
      console.log('Anchor element:', cellInfo.element);
      console.log('Bounding rect:', cellInfo.rect);
      // e.g. position a tooltip at cellInfo.rect.bottom, cellInfo.rect.left
    }
  }}
/>
```

---

## Highlight Syntax

The `highlight` prop, `setHighlight` method, and `getHighlight` method all use Excel-style cell references:

| Expression | Meaning |
|---|---|
| `A1` | Single cell |
| `A1:D10` | Rectangular range |
| `B:B` | Entire column |
| `3:3` | Entire row |
| `A1:B5, D1:E5` | Multiple ranges (comma-separated) |

Notes:

- A plain single-cell click focuses the cell but does not create a visible highlighted range
- `setHighlight('')`, `clearHighlight()`, or clearing the controlled `highlight` prop removes the current highlight

---

## Anchoring UI to the highlighted area

`highlightAreaRef` gives you **one** DOM element that spans the entire highlighted area, so you can position your own popover, toolbar, or callout against it:

```tsx
import React, { useRef, useState, useEffect } from 'react';
import { SheetViewer } from 'rc-sheet-viewer-17';
import type { CellRange } from 'rc-sheet-viewer-17';

function Example() {
  const highlightAreaRef = useRef<HTMLDivElement>(null);
  const [ranges, setRanges] = useState<CellRange[]>([]);
  const [box, setBox] = useState<DOMRect | null>(null);

  // Read the rect in an effect — see the note below on why not in the callback
  useEffect(() => {
    setBox(highlightAreaRef.current?.getBoundingClientRect() ?? null);
  }, [ranges]);

  return (
    <>
      <SheetViewer
        source="/data.xlsx"
        highlightAreaRef={highlightAreaRef}
        onSelectionChange={(r) => setRanges(r)}
        height={600}
      />
      {box && (
        <div style={{ position: 'fixed', top: box.top - 32, left: box.left }}>
          {ranges.length} range(s) selected
        </div>
      )}
    </>
  );
}
```

The grid is virtualized, so the highlighted **cells** are not all in the DOM — most of a large range has no cell node at all. This element is a single invisible box covering the highlight's bounding rectangle instead, positioned in grid content coordinates. Behavior:

- **One element, always.** For a multi-range highlight like `"A1:B2, D1:E3"` you get a single element spanning the union (`A1:E3`) — which also covers column `C`, since it is one rectangle.
- **`null` when there is no highlight.** The element unmounts, so an object ref's `.current` becomes `null` and a callback ref is called with `null`.
- Populated for **any** selection: `setHighlight()`, the `highlight` prop, drag-selection, and a plain single-cell click (even though a single click draws no tint).
- Still provided when `highlightable={false}` — that prop suppresses *visuals*, and this element has none.
- Stays pinned to the content while scrolling, and repositions when columns or rows are resized.
- Invisible and `pointer-events: none`. You can style it via the `.sv-highlight-area` class if you want your own outline.

> **Do not read the ref inside `onSelectionChange`.** That callback fires synchronously while the store updates, *before* React commits, so the element is not yet positioned (or may not exist). Store the ranges in state as above and read the rect in a `useEffect` / `useLayoutEffect`. If you call `setHighlight()` from outside a React event handler on React 17, updates are unbatched — wrap it in `unstable_batchedUpdates` or read the rect in a `requestAnimationFrame`.

`ref.current?.getHighlightElement()` returns the same element if you already hold a `SheetViewerHandle` and would rather not pass a second ref.

### Scrolling the selection into view

`ref.current?.scrollToSelection()` scrolls so the **entire** selection is visible:

```tsx
viewerRef.current?.setHighlight('C400:F420');
viewerRef.current?.scrollToSelection();
```

- Spans the **union** of every selected range, so multi-range highlights like `A1:B5,D1:E5` are fully revealed.
- Moves the **minimum** amount needed on each axis — a selection already fully in view does not move, and an axis that is already visible is left alone.
- A selection larger than the viewport is aligned to its top-left corner.
- Returns `false` when there is no selection.

This is separate from the automatic scroll that already runs when the selection changes; calling it does not alter that behavior.

---

## Edit Mode

Enable inline cell editing:

```tsx
<SheetViewer
  source={file}
  mode="edit"
  onCellChange={(sheet, row, col, value) => {
    console.log(`${sheet}[${row},${col}] = ${value}`);
  }}
/>
```

Double-click a cell to start editing. Press Enter to confirm or Escape to cancel.

---

## Copy & Paste with Formatting

- **Ctrl+C** (Cmd+C on Mac) — copies the selected range as HTML (with inline styles) and TSV
- **Ctrl+V** (Cmd+V on Mac) — pastes HTML (preferred, preserves styles) or plain TSV
- **Escape** — clears the marching ants copy indicator

Paste requires `mode="edit"`.

---

## Large Cell Content

When a cell contains long text, inactive cells truncate with ellipsis. The formula bar always shows the complete value, and highlighted range anchor cells can expand to show full content.

---

## Undo & Redo

- **Ctrl+Z** (Cmd+Z) — undo
- **Ctrl+Y** or **Ctrl+Shift+Z** — redo

Also available via ref:

```tsx
if (ref.current?.canUndo()) ref.current.undo();
if (ref.current?.canRedo()) ref.current.redo();
```

---

## Column & Row Resizing

Drag the right edge of column headers or the bottom edge of row headers to resize. Minimum column: 30px, minimum row: 20px.

Programmatic control:

```tsx
ref.current?.setColumnWidth(0, 200);  // Column A → 200px
ref.current?.setRowHeight(0, 50);     // Row 1 → 50px
```

---

## Cell Comments

Cells with comments display a red triangle in the top-right corner. Hover to see the comment. Manage via ref:

```tsx
ref.current?.setCellComment('A1', 'Review this value', 'Alice');
const comment = ref.current?.getCellComment('A1');
ref.current?.setCellComment('A1', null);  // Remove
```

---

## Conditional Formatting

```typescript
const rules: ConditionalFormatRule[] = [
  {
    type: 'greaterThan',
    range: { startRow: 0, startCol: 0, endRow: 99, endCol: 0 },
    values: [100],
    style: { bgColor: '#e6f4ea', fontColor: '#137333' },
  },
  {
    type: 'colorScale',
    range: { startRow: 0, startCol: 1, endRow: 99, endCol: 1 },
    colorScale: ['#f4cccc', '#fce8b2', '#b7e1cd'],
  },
];
```

Supported rule types: `greaterThan`, `lessThan`, `between`, `equalTo`, `textContains`, `top10`, `bottom10`, `colorScale`, `dataBar`.

---

## Data Validation

```typescript
const validations: Record<string, ValidationRule> = {
  '0,0': { type: 'list', listItems: ['High', 'Medium', 'Low'] },
  '0,1': { type: 'number', min: 0, max: 100, errorMessage: 'Must be 0–100' },
};
```

---

## Formula Engine

Parse and evaluate Excel-style formulas. 24 built-in functions:

| Category | Functions |
|---|---|
| Math | `SUM`, `AVERAGE`, `COUNT`, `COUNTA`, `MIN`, `MAX`, `ABS`, `SQRT`, `POWER`, `ROUND` |
| Logical | `IF`, `AND`, `OR`, `NOT` |
| Text | `CONCATENATE`, `LEFT`, `RIGHT`, `MID`, `LEN`, `UPPER`, `LOWER`, `TRIM` |
| Lookup | `VLOOKUP`, `HLOOKUP`, `INDEX`, `MATCH` |

---

## Types

All types are exported:

```tsx
import type {
  SheetViewerProps,
  SheetViewerHandle,
  SheetViewerSource,
  SheetViewerMode,
  SheetViewerTheme,
  SheetData,
  CellRange,
  CellValue,
  CellComment,
  CellStyle,
  ChartOverlay,
  ChartSeries,
  ChartType,
  ConditionalFormatRule,
  ConditionalFormatRuleType,
  GridLineConfig,
  GridLineBorderStyle,
  ParsedGridLineConfig,
  MergeCell,
  SelectionState,
  UndoEntry,
  ValidationRule,
  ValidationRuleType,
} from 'rc-sheet-viewer-17';
```

---

## Multiple Instances

Each `<SheetViewer />` is fully isolated with its own state:

```tsx
<div style={{ display: 'flex', gap: 16 }}>
  <SheetViewer source={file1} height={400} width="50%" />
  <SheetViewer source={file2} height={400} width="50%" />
</div>
```

---

## Styling

Import the CSS once:

```tsx
import 'rc-sheet-viewer-17/style.css';
```

All classes are scoped under `.sheet-viewer` and prefixed with `sv-`. Override CSS variables via the `theme` prop or directly in CSS:

```css
.sheet-viewer {
  --sv-color-bg: #1e1e2e;
  --sv-color-primary: #89b4fa;
  --sv-search-match-color: rgba(137, 180, 250, 0.3);
  --sv-search-active-color: rgba(137, 180, 250, 0.6);
}
```

---

## Development

### Prerequisites

- Node.js 18+
- pnpm 8+

### Commands

```bash
pnpm dev              # Start demo app (dev server)
pnpm build            # Build demo app
pnpm build:lib        # Build library package
pnpm typecheck        # TypeScript type checking
pnpm test             # Run all tests
pnpm test:watch       # Tests in watch mode
pnpm lint             # ESLint
pnpm storybook        # Storybook at localhost:6006
pnpm build-storybook  # Static Storybook build
pnpm chromatic        # Visual regression tests
```

---

## Browser Support

Works in all modern browsers (Chrome, Firefox, Safari, Edge). No IE11 support.

---

## License

MIT
