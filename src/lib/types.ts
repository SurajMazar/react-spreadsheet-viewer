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
  /** Per-row heights. Sparse: only rows with custom heights are set. Default is ROW_HEIGHT (26). */
  rowHeights?: number[];
  /** Sparse map of cell styles keyed by "row,col" (e.g. "0,0" = A1). Only cells with non-default styles are stored. */
  styles?: Record<string, CellStyle>;
  /** Sparse map of cell comments keyed by "row,col". */
  comments?: Record<string, CellComment>;
  /** Conditional formatting rules for the sheet */
  conditionalFormats?: ConditionalFormatRule[];
  /** Sparse map of data validation rules keyed by "row,col" */
  validations?: Record<string, ValidationRule>;
}

/** Style information for a single cell */
export interface CellStyle {
  bgColor?: string;
  fontColor?: string;
  bold?: boolean;
  italic?: boolean;
  fontSize?: number;
  textAlign?: 'left' | 'center' | 'right';
  wrapText?: boolean;
}

/** A cell comment */
export interface CellComment {
  author?: string;
  text: string;
}

/** Conditional formatting rule types */
export type ConditionalFormatRuleType =
  | 'greaterThan'
  | 'lessThan'
  | 'between'
  | 'equalTo'
  | 'textContains'
  | 'top10'
  | 'bottom10'
  | 'colorScale'
  | 'dataBar'
  | 'iconSet';

/** A conditional formatting rule applied to a range */
export interface ConditionalFormatRule {
  type: ConditionalFormatRuleType;
  range: CellRange;
  /** Threshold value(s) for comparison rules */
  values?: (number | string)[];
  /** Styles to apply when rule matches (for comparison rules) */
  style?: CellStyle;
  /** Color scale stops: [minColor, midColor?, maxColor] */
  colorScale?: string[];
  /** Data bar color */
  barColor?: string;
  /** Whether the rule is a percentage (for top10/bottom10) */
  percent?: boolean;
}

/** Data validation rule types */
export type ValidationRuleType = 'list' | 'number' | 'date' | 'custom';

/** A data validation rule for a cell or range */
export interface ValidationRule {
  type: ValidationRuleType;
  /** For 'list' type: allowed values */
  listItems?: string[];
  /** For 'number' type: min value */
  min?: number;
  /** For 'number' type: max value */
  max?: number;
  /** Whether the rule allows empty values */
  allowBlank?: boolean;
  /** Error message to display for invalid input */
  errorMessage?: string;
  /** Error title */
  errorTitle?: string;
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
  /** Show the Charts button in the toolbar (default: true) */
  chartable?: boolean;
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
  /** Get cell values for a range expression (e.g. "A1:D10") from the active or named sheet */
  getCellRangeData(range: string, sheetName?: string): CellValue[][] | null;
  /** Get cell values for the currently selected range (drag/mouse selection). Returns null if no range is selected. */
  getSelectedRangeData(): CellValue[][] | null;
  /** Programmatically set a column width (in pixels). Minimum 30px. */
  setColumnWidth(colIndex: number, width: number, sheetName?: string): void;
  /** Programmatically set a row height (in pixels). Minimum 20px. */
  setRowHeight(rowIndex: number, height: number, sheetName?: string): void;
  /** Get a cell comment for the given "A1" or "row,col" key. */
  getCellComment(cellRef: string, sheetName?: string): CellComment | null;
  /** Set a cell comment (edit mode). Pass null text to remove. */
  setCellComment(cellRef: string, text: string | null, author?: string, sheetName?: string): void;
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
  /** The range that was last Ctrl+C copied (for marching ants indicator) */
  copiedRange: CellRange | null;

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
  setCopiedRange: (range: CellRange | null) => void;
  setCellStyle: (sheetName: string, row: number, col: number, style: CellStyle | null) => void;
  setColumnWidth: (sheetName: string, colIndex: number, width: number) => void;
  setRowHeight: (sheetName: string, rowIndex: number, height: number) => void;
  setCellComment: (sheetName: string, row: number, col: number, comment: CellComment | null) => void;
  setMode: (mode: SheetViewerMode) => void;
  getCurrentSheetData: () => SheetData | null;
  reset: () => void;
}
