// ============================================================
// Shared type definitions for the SheetViewer component
// ============================================================

/** A single cell value in a sheet */
export type CellValue = string | number | boolean | null | undefined;

/** Data for one parsed sheet */
export interface SheetData {
  data: CellValue[][];
  rows: number;
  cols: number;
  merges: MergeCell[];
  colWidths: number[];
  /** Sparse map of cell styles keyed by "row,col" (e.g. "0,0" = A1). Only cells with non-default styles are stored. */
  styles?: Record<string, CellStyle>;
}

/** Style information for a single cell */
export interface CellStyle {
  bgColor?: string;
  fontColor?: string;
  bold?: boolean;
  italic?: boolean;
  fontSize?: number;
  textAlign?: 'left' | 'center' | 'right';
}

/** A merge definition mirroring Excel's merge ranges */
export interface MergeCell {
  s: { r: number; c: number };
  e: { r: number; c: number };
}

/** A cell range (0-based, inclusive) */
export interface CellRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

/** Per-sheet selection state */
export interface SelectionState {
  ranges: CellRange[];
  rangeInput: string;
  scrollPos: { top: number; left: number } | null;
}

/** A chart overlay extracted from Excel drawing XML */
export interface ChartOverlay {
  anchorCol: number;
  anchorRow: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  chartType: ChartType;
  series: ChartSeries[];
  title: string;
}

export type ChartType = 'bar' | 'line' | 'pie' | 'area' | 'scatter';

/** One data series inside a chart */
export interface ChartSeries {
  name: string;
  categories: (string | number)[];
  values: number[];
}

/** Acceptable source types for the SheetViewer */
export type SheetViewerSource = string | File | ArrayBuffer | ArrayBufferView;

/** Viewer mode */
export type SheetViewerMode = 'view' | 'edit';

/** Props for the SheetViewer component */
export interface SheetViewerProps {
  /** URL, File, ArrayBuffer, or TypedArray to load */
  source?: SheetViewerSource;
  /** View-only or edit mode (default: "view") */
  mode?: SheetViewerMode;
  /** Controlled active sheet name */
  activeSheet?: string;
  /** Cell range expression to highlight (e.g. "A1:D10") */
  highlight?: string;
  /** Callback when the user switches sheets */
  onSheetChange?: (sheetName: string) => void;
  /** Callback when a cell is edited */
  onCellChange?: (sheet: string, row: number, col: number, value: CellValue) => void;
  /** Callback when selection changes */
  onSelectionChange?: (ranges: CellRange[]) => void;
  /** Show a download button in the toolbar */
  downloadable?: boolean;
  /** Enable Ctrl+F search (default: true) */
  searchable?: boolean;
  /** Container height (CSS value or number of pixels) */
  height?: number | string;
  /** Container width (CSS value or number of pixels) */
  width?: number | string;
  /** Additional CSS class on the container */
  className?: string;
}

/** Imperative handle exposed via React ref */
export interface SheetViewerHandle {
  /** Get all sheet names */
  getSheetNames(): string[];
  /** Get data for a specific sheet (or active sheet if omitted) */
  getSheetData(sheetName?: string): SheetData | null;
  /** Get the currently active sheet name */
  getActiveSheet(): string | null;
  /** Get all parsed sheets as a record */
  getAllSheets(): Record<string, SheetData>;
  /** Get the file name */
  getFileName(): string | null;
  /** Programmatically switch to a sheet */
  setActiveSheet(sheetName: string): void;
  /** Programmatically highlight a range */
  setHighlight(range: string): void;
}

// ============================================================
// Internal store types (used by ViewerContext)
// ============================================================

export interface ActiveCell {
  row: number;
  col: number;
}

export interface ViewerState {
  // File state
  fileName: string | null;
  sheetNames: string[];
  sheets: Record<string, SheetData>;
  images: Record<string, unknown>;
  chartOverlays: Record<string, ChartOverlay[]>;
  activeSheet: string | null;

  // Parsing state
  isParsing: boolean;
  parseProgress: number;
  parseStatus: string;
  parseError: string | null;

  // Selection state (per sheet)
  selections: Record<string, SelectionState>;
  activeCell: ActiveCell | null;

  // UI state
  showChartPanel: boolean;
  chartType: string;

  // Mode
  mode: SheetViewerMode;

  // Actions
  setParseProgress: (progress: number, status?: string) => void;
  startParsing: () => void;
  setParseError: (error: string) => void;
  setFileData: (payload: {
    fileName: string;
    sheetNames: string[];
    sheets: Record<string, SheetData>;
    images?: Record<string, unknown>;
    chartOverlays?: Record<string, ChartOverlay[]>;
  }) => void;
  setActiveSheet: (sheetName: string) => void;
  setActiveCell: (row: number | null, col: number | null) => void;
  setSelectionRanges: (sheetName: string, ranges: CellRange[], rangeInput?: string) => void;
  setRangeInput: (sheetName: string, rangeInput: string) => void;
  setScrollPosition: (sheetName: string, scrollPos: { top: number; left: number }) => void;
  setCellValue: (sheetName: string, row: number, col: number, value: CellValue) => void;
  toggleChartPanel: () => void;
  setChartType: (chartType: string) => void;
  setMode: (mode: SheetViewerMode) => void;
  getCurrentSheetData: () => SheetData | null;
  reset: () => void;
}
