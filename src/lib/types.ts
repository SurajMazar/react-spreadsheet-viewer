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

// ============================================================
// Grid lines
// ============================================================

/** Border style for a grid line range */
export type GridLineBorderStyle = 'solid' | 'dashed' | 'dotted';

/** Defines visible borders drawn over a cell range (like Excel's "All Borders") */
export interface GridLineConfig {
  /** Excel-style range e.g. "A1:D10" */
  range: string;
  /** Border color. Default: var(--sv-color-border) */
  borderColor?: string;
  /** Border width in pixels. Default: 1 */
  borderWidth?: number;
  /** Border style. Default: 'solid' */
  borderStyle?: GridLineBorderStyle;
  /** Fill/background color for cells in this range. Optional. */
  bgColor?: string;
}

/** Parsed grid line config with resolved CellRange */
export interface ParsedGridLineConfig extends Omit<GridLineConfig, 'range'> {
  parsedRange: CellRange;
}

// ============================================================
// Theme
// ============================================================

/** Full theme object for customizing all library colors */
export interface SheetViewerTheme {
  /** Main background color */
  bgColor?: string;
  /** Surface/secondary background (toolbars, headers, status bar) */
  surfaceColor?: string;
  /** Default cell border color */
  borderColor?: string;
  /** Light cell border color */
  borderLightColor?: string;
  /** Primary text color */
  textColor?: string;
  /** Secondary text color */
  textSecondaryColor?: string;
  /** Muted/placeholder text color */
  textMutedColor?: string;
  /** Primary accent color (selection borders, buttons, active states) */
  primaryColor?: string;
  /** Light variant of primary (focus rings, etc.) */
  primaryLightColor?: string;
  /** Very light primary background (active button backgrounds) */
  primaryBgColor?: string;
  /** Range selection fill color */
  selectionColor?: string;
  /** Range selection fill color on hover */
  selectionHoverColor?: string;
  /** Column/row header background */
  headerBgColor?: string;
  /** Column/row header text color */
  headerTextColor?: string;
  /** Cell hover background */
  hoverColor?: string;
}

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
  /** Fill color for the selected/highlighted range (e.g. "rgba(255,0,0,0.1)"). Default: --sv-color-selection */
  highlightColor?: string;
  /** Border color for the selected/highlighted range (e.g. "#ff0000"). Default: --sv-color-primary */
  highlightBorderColor?: string;
  /** Enable cell/range highlighting visuals (default: true). When false, active cell outline, range tint, and range borders are suppressed. */
  highlightable?: boolean;
  /** Grid line configs: ranges with visible cell borders (like Excel's All Borders) */
  gridLines?: GridLineConfig[];
  /** Show the toolbar (filename, Charts, Download buttons). Default: true */
  showToolbar?: boolean;
  /** Show the filename in the toolbar. Default: true. When false the logo+name are hidden but Charts/Download remain. */
  showFileName?: boolean;
  /** Color theme overrides for the entire library */
  theme?: SheetViewerTheme;
  /** Background color for search match cells. Default: rgba(255,213,79,0.3) */
  searchMatchColor?: string;
  /** Background color for the currently active search match. Default: rgba(255,152,0,0.5) */
  searchActiveColor?: string;
  /** Callback when the user switches sheets */
  onSheetChange?: (sheetName: string) => void;
  /** Callback when the user selects a sheet tab. Receives the selected sheet name. */
  onSheetSelect?: (sheetName: string) => void;
  /** Callback when a cell is edited */
  onCellChange?: (sheet: string, row: number, col: number, value: CellValue) => void;
  /** Callback when selection changes, with the DOM element and bounding rect of the anchor cell */
  onSelectionChange?: (ranges: CellRange[], cellInfo?: { element: HTMLElement; rect: DOMRect }) => void;
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
  /** Programmatically highlight a range. Pass `silent: true` to suppress onSelectionChange callback. */
  setHighlight(range: string, options?: { silent?: boolean }): void;
  /** Get the current highlight/selection range as an Excel-style string (e.g. "A1:D10"), or null if none. */
  getHighlight(): string | null;
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
  /** Undo the last cell edit (value or style change). */
  undo(): void;
  /** Redo the last undone edit. */
  redo(): void;
  /** Returns true if there is at least one undoable action. */
  canUndo(): boolean;
  /** Returns true if there is at least one redoable action. */
  canRedo(): boolean;
}

// ============================================================
// Undo / Redo
// ============================================================

/** One cell-level change for undo/redo tracking */
export interface CellValueChange {
  row: number;
  col: number;
  oldValue: CellValue;
  newValue: CellValue;
}

/** One cell-style change for undo/redo tracking */
export interface CellStyleChange {
  row: number;
  col: number;
  oldStyle: CellStyle | undefined;
  newStyle: CellStyle | undefined;
}

/** A single undoable user action (may span multiple cells, e.g. paste) */
export interface UndoEntry {
  sheetName: string;
  cellChanges: CellValueChange[];
  styleChanges: CellStyleChange[];
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
  /** All search match cell positions (row/col, 0-based) */
  searchMatches: { row: number; col: number }[];
  /** Index of the currently focused search match */
  searchActiveIndex: number;

  // Mode
  mode: SheetViewerMode;

  // Undo / Redo
  undoStack: UndoEntry[];
  redoStack: UndoEntry[];

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
  setSearchMatches: (matches: { row: number; col: number }[]) => void;
  setSearchActiveIndex: (index: number) => void;
  setCellStyle: (sheetName: string, row: number, col: number, style: CellStyle | null) => void;
  setColumnWidth: (sheetName: string, colIndex: number, width: number) => void;
  setRowHeight: (sheetName: string, rowIndex: number, height: number) => void;
  setCellComment: (sheetName: string, row: number, col: number, comment: CellComment | null) => void;
  setMode: (mode: SheetViewerMode) => void;
  getCurrentSheetData: () => SheetData | null;
  pushUndo: (entry: UndoEntry) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
}
