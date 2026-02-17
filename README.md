# rc-sheet-viewer-17

A high-performance React component for viewing and editing Excel and CSV files with a Google Sheets-like interface. Handles 100k+ rows with virtualized rendering, embedded chart extraction, pivot table reconstruction, and a clean, familiar spreadsheet UI. Compatible with React 17, 18, and 19.

[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org/)
[![React 17+](https://img.shields.io/badge/React-17%20%7C%2018%20%7C%2019-61dafb)](https://react.dev/)
[![Storybook](https://img.shields.io/badge/Storybook-stories-ff4785)](https://storybook.js.org/)

---

## Features

- **File format support** — `.xlsx`, `.xls`, and `.csv` parsed entirely client-side
- **Virtualized grid** — row and column virtualization via TanStack Virtual; renders 100k+ rows smoothly
- **Google Sheets-like UI** — column headers (A, B, ... Z, AA, AB ...), row numbers, sticky headers, sheet tabs, formula bar, status bar
- **View & edit modes** — read-only viewing or inline cell editing, controlled via props
- **Multiple sheets** — tab-based sheet switching with per-sheet selection state
- **Range highlighting** — pass Excel-style references like `A1:D10` to highlight and scroll into view
- **Embedded charts** — extracts charts from Excel files and renders them as floating overlays using Chart.js
- **Pivot table reconstruction** — reads pivot table definitions from XLSX internals and reconstructs the output
- **Search** — Ctrl+F search across the active sheet
- **Download** — export the current data as `.xlsx` or `.csv`
- **Charts from selection** — select a data range and create bar, line, pie, or area charts dynamically
- **Copy & paste with formatting** — Ctrl+C/V with both HTML (preserving styles) and TSV clipboard formats
- **Column/row resize** — drag column and row header edges to resize
- **Merged cells** — visually renders merged cell ranges from Excel files
- **Text wrapping** — cells with `wrapText` style render multi-line content
- **Cell comments** — red triangle indicator with hover tooltip for commented cells
- **Conditional formatting** — rule-based cell styling (value comparisons, color scales, data bars)
- **Data validation** — input validation with dropdown lists, number/date ranges, and error UI
- **Formula engine** — parse and evaluate Excel-style formulas (24 built-in functions: SUM, IF, VLOOKUP, etc.)
- **Imperative API** — access sheet data, navigate sheets, resize columns, manage comments, and more via ref
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
| `highlight` | `string` | — | Excel-style range to highlight (e.g. `"A1:D10"`, `"B:B"`, `"3:3"`) |
| `onSheetChange` | `(sheetName: string) => void` | — | Called when the user switches sheets |
| `onCellChange` | `(sheet, row, col, value) => void` | — | Called when a cell is edited |
| `onSelectionChange` | `(ranges: CellRange[]) => void` | — | Called when selection changes |
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

    // Switch to a specific sheet
    ref.current?.setActiveSheet('Sheet2');

    // Highlight a range
    ref.current?.setHighlight('A1:F20');
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
| `getCellRangeData(range, name?)` | `CellValue[][] \| null` | Get data for an Excel-style range (e.g. `"A1:C10"`) |
| `getSelectedRangeData()` | `CellValue[][] \| null` | Get data for the current mouse/drag selection |
| `setActiveSheet(name)` | `void` | Switch to a sheet |
| `setHighlight(range)` | `void` | Highlight a cell range |
| `setColumnWidth(col, width, name?)` | `void` | Set column width in pixels (min 30px) |
| `setRowHeight(row, height, name?)` | `void` | Set row height in pixels (min 20px) |
| `getCellComment(cellRef, name?)` | `CellComment \| null` | Get comment for a cell (e.g. `"A1"`) |
| `setCellComment(cellRef, text, author?, name?)` | `void` | Set or remove a cell comment |

---

## Types

All types are exported for use in your application:

```tsx
import type {
  SheetViewerProps,
  SheetViewerHandle,
  SheetViewerSource,
  SheetViewerMode,
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
  MergeCell,
  SelectionState,
  ValidationRule,
  ValidationRuleType,
} from 'rc-sheet-viewer-17';
```

### `SheetData`

```typescript
interface SheetData {
  data: CellValue[][];                          // 2D array of cell values
  rows: number;                                 // Total row count
  cols: number;                                 // Total column count
  merges: MergeCell[];                          // Merged cell ranges
  colWidths: number[];                          // Column widths in pixels
  rowHeights?: number[];                        // Custom row heights (sparse)
  styles?: Record<string, CellStyle>;           // Cell styles keyed by "row,col"
  comments?: Record<string, CellComment>;       // Cell comments keyed by "row,col"
  conditionalFormats?: ConditionalFormatRule[];  // Conditional formatting rules
  validations?: Record<string, ValidationRule>; // Data validation rules keyed by "row,col"
}
```

### `CellRange`

```typescript
interface CellRange {
  startRow: number;   // 0-based, inclusive
  startCol: number;
  endRow: number;
  endCol: number;
}
```

---

## Highlight Syntax

The `highlight` prop (and `setHighlight` method) accept Excel-style cell references:

| Expression | Meaning |
|---|---|
| `A1` | Single cell |
| `A1:D10` | Rectangular range |
| `B:B` | Entire column |
| `3:3` | Entire row |
| `A1:B5, D1:E5` | Multiple ranges (comma-separated) |

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

The component supports Excel-compatible clipboard operations with style preservation:

- **Ctrl+C** (Cmd+C on Mac) — copies the selected range as both HTML (with inline styles for colors, bold, italic) and TSV (tab-separated values)
- **Ctrl+V** (Cmd+V on Mac) — pastes from clipboard. HTML is preferred (preserving styles); falls back to TSV for plain-text sources
- **Escape** — clears the marching ants copy indicator

No additional configuration needed. Copy works in both view and edit modes; paste requires `mode="edit"`.

## Column & Row Resizing

Drag the right edge of column headers or bottom edge of row headers to resize. Minimum column width: 30px, minimum row height: 20px. Also available programmatically via ref:

```tsx
ref.current?.setColumnWidth(0, 200);  // Set column A to 200px
ref.current?.setRowHeight(0, 50);     // Set row 1 to 50px
```

## Cell Comments

Cells with comments display a red triangle indicator in the top-right corner. Hover to see the comment text and author. Manage comments programmatically:

```tsx
ref.current?.setCellComment('A1', 'Review this value', 'Alice');
const comment = ref.current?.getCellComment('A1');
ref.current?.setCellComment('A1', null);  // Remove comment
```

## Conditional Formatting

Apply visual styles based on cell values. Rules are evaluated at render time and overlay the base cell style:

```typescript
const rules: ConditionalFormatRule[] = [
  { type: 'greaterThan', range: { startRow: 0, startCol: 0, endRow: 99, endCol: 0 }, values: [100], style: { bgColor: '#e6f4ea', fontColor: '#137333' } },
  { type: 'colorScale', range: { startRow: 0, startCol: 1, endRow: 99, endCol: 1 }, colorScale: ['#f4cccc', '#fce8b2', '#b7e1cd'] },
];
```

Supported rule types: `greaterThan`, `lessThan`, `between`, `equalTo`, `textContains`, `top10`, `bottom10`, `colorScale`, `dataBar`.

## Data Validation

Restrict cell input with validation rules. List validation renders a dropdown; invalid input shows a red border and error tooltip:

```typescript
const validations: Record<string, ValidationRule> = {
  '0,0': { type: 'list', listItems: ['High', 'Medium', 'Low'] },
  '0,1': { type: 'number', min: 0, max: 100, errorMessage: 'Must be 0-100' },
};
```

## Formula Engine

Parse and evaluate Excel-style formulas. 24 built-in functions:

| Category | Functions |
|---|---|
| Math | `SUM`, `AVERAGE`, `COUNT`, `COUNTA`, `MIN`, `MAX`, `ABS`, `SQRT`, `POWER`, `ROUND` |
| Logical | `IF`, `AND`, `OR`, `NOT` |
| Text | `CONCATENATE`, `LEFT`, `RIGHT`, `MID`, `LEN`, `UPPER`, `LOWER`, `TRIM` |
| Lookup | `VLOOKUP`, `HLOOKUP`, `INDEX`, `MATCH` |

```typescript
import { parseFormula, evaluate } from 'rc-sheet-viewer-17/formula'; // formula engine
```

---

## Merged Cells

Merged cell ranges from Excel files are automatically rendered as single visual cells spanning the appropriate rows and columns. No configuration is required — merges are detected from the file metadata and rendered in the grid.

---

## Multiple Instances

Each `<SheetViewer />` is fully isolated with its own state. You can render as many as you want on one page:

```tsx
<div style={{ display: 'flex', gap: 16 }}>
  <SheetViewer source={file1} height={400} width="50%" />
  <SheetViewer source={file2} height={400} width="50%" />
</div>
```

---

## Styling

The component ships with a single CSS file. Import it once:

```tsx
import 'rc-sheet-viewer-17/style.css';
```

All classes are scoped under `.sheet-viewer` and prefixed with `sv-`. The component uses CSS custom properties for theming. Override them on the `.sheet-viewer` selector:

```css
.sheet-viewer {
  --sv-color-bg: #1e1e1e;
  --sv-color-surface: #2d2d2d;
  --sv-color-text: #d4d4d4;
  --sv-color-border: #404040;
  --sv-color-primary: #569cd6;
  /* ... see sheet-viewer.css for all variables */
}
```

---

## Development

### Prerequisites

- Node.js 18+
- pnpm 8+

### Setup

```bash
git clone https://github.com/your-username/react-sheet-viewer.git
cd react-sheet-viewer
pnpm install
```

### Commands

```bash
pnpm dev              # Start demo app (dev server)
pnpm build            # Build demo app
pnpm build:lib        # Build library package (dist/sheet-viewer.js + .css)
pnpm typecheck        # TypeScript type checking (strict)
pnpm test             # Run all tests (Vitest)
pnpm test:watch       # Run tests in watch mode
pnpm lint             # ESLint
pnpm storybook        # Start Storybook at localhost:6006
pnpm build-storybook  # Build static Storybook
pnpm chromatic        # Visual regression tests (requires CHROMATIC_PROJECT_TOKEN)
```

### Project Structure

```
src/
├── lib/                    # The library (published package)
│   ├── index.ts            # Public exports
│   ├── SheetViewer.tsx     # Root component
│   ├── types.ts            # All TypeScript types
│   ├── context/            # Zustand store (instance-scoped)
│   ├── hooks/              # useSourceLoader, useFileParser
│   ├── components/         # UI components (Grid, Toolbar, Tabs, etc.)
│   ├── utils/              # Parsers, download, range logic
│   └── styles/             # CSS (sheet-viewer.css)
├── demo/                   # Demo app with file upload (not in the package)
└── main.tsx                # Demo entry point
stories/                    # Storybook stories
```

### Architecture

1. **Source loading** (`useSourceLoader`) — normalizes URL / File / ArrayBuffer into a raw buffer
2. **Parsing** (`useFileParser`) — main-thread async parsing with `requestAnimationFrame` yields for UI responsiveness. Dynamically imports `xlsx` for code-splitting
3. **State** (`ViewerContext`) — instance-scoped Zustand store via `createStore()` + React Context
4. **Rendering** (`VirtualGrid`) — dual row/column virtualization with `@tanstack/react-virtual`
5. **Advanced features** — pivot table reconstruction and chart extraction read raw XLSX XML via `fflate`

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | React 17 / 18 / 19 |
| Language | TypeScript (strict) |
| Build | Vite 7 |
| State | Zustand 5 |
| Virtualization | @tanstack/react-virtual 3 |
| Excel Parsing | xlsx (SheetJS) |
| Charts | Chart.js + react-chartjs-2 |
| ZIP | fflate |
| Testing | Vitest + React Testing Library |
| Visual Testing | Storybook + Chromatic |

---

## Browser Support

Works in all modern browsers (Chrome, Firefox, Safari, Edge). No IE11 support.

---

## License

MIT
