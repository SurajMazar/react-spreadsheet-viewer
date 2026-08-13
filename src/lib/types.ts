// ============================================================
// Shared type definitions for the SheetViewer component
// ============================================================

import type { ComponentType, HTMLAttributes, ReactElement, ReactNode, Ref } from 'react';

/**
 * Extra attributes applied to the highlight area element (the one
 * `highlightAreaRef` receives) — `id`, `data-*`, `aria-*`, `title`, `className`,
 * `style`, event handlers, and so on.
 *
 * `className` is appended to `sv-highlight-area` rather than replacing it, and
 * the element's computed geometry (top/left/width/height) always wins over any
 * `style` passed here — everything else in `style` is applied as given.
 */
export type HighlightAreaAttributes = HTMLAttributes<HTMLDivElement> & {
  [key: `data-${string}`]: string | number | boolean | undefined;
};

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

// ============================================================
// Tools
// ============================================================

/** Props an icon component is rendered with inside a tool button. */
export interface SheetViewerToolIconProps {
  /** Edge length the toolbar draws icons at, in pixels. */
  size: number;
}

/**
 * A tool's icon: either a component the toolbar renders at its own size, or a
 * ready-made element when the tool wants full control over it.
 */
export type SheetViewerToolIcon = ComponentType<SheetViewerToolIconProps> | ReactElement;

/**
 * The viewer state a tool is handed on every call.
 *
 * `viewer` is the same imperative surface the `ref` exposes, so a tool reads
 * and drives the sheet through the one documented API rather than reaching
 * into internals. Everything else is a snapshot, captured at call time.
 */
export interface SheetViewerToolContext {
  /** Imperative viewer API, identical to the one on the component ref. */
  viewer: SheetViewerHandle;
  /** Loaded file name, or null before a file has been parsed. */
  fileName: string | null;
  /** Every sheet in the workbook. */
  sheetNames: string[];
  /** Name of the sheet on screen. */
  activeSheet: string | null;
  /** Data for the active sheet. */
  sheetData: SheetData | null;
  /** Currently selected ranges — empty when there is no selection. */
  selection: CellRange[];
  /** Anchor cell of the selection, if any. */
  activeCell: ActiveCell | null;
  /** Current zoom factor (1 = 100%). */
  zoom: number;
  /** Whether the viewer is in view or edit mode. */
  mode: SheetViewerMode;
}

/** Context for a tool's click handler, which also gets its own button element. */
export interface SheetViewerToolClickContext extends SheetViewerToolContext {
  /** The tool's button, for anchoring a popover or menu to it. */
  element: HTMLButtonElement;
}

/**
 * A tool rendered in the toolbar's Tools section.
 *
 * Tools that need configuration should be built with `defineSheetViewerTool`,
 * which type-checks the config against the handler at the definition site and
 * binds it in — so this stays a single concrete type with no `any` in it, and
 * a `tools` array can mix tools that share nothing but this shape.
 */
export interface SheetViewerTool {
  /** Stable identifier, unique within a `tools` array. */
  id: string;
  /** Tooltip and accessible name. */
  label: string;
  /** Icon shown on the button. */
  icon: SheetViewerToolIcon;
  /** Invoked when the user activates the tool. */
  onClick: (context: SheetViewerToolClickContext) => void;
  /** Render the label next to the icon instead of tooltip-only. Default: false */
  showLabel?: boolean;
  /**
   * Pin this tool to one end of the formula bar row, overriding the viewer's
   * `toolsPlacement`. Leave unset to follow it — most tools should.
   */
  placement?: SheetViewerToolsPlacement;
  /** Grey the tool out. Re-evaluated whenever the viewer state changes. */
  isDisabled?: (context: SheetViewerToolContext) => boolean;
  /** Render the tool in its active/pressed state. */
  isActive?: (context: SheetViewerToolContext) => boolean;
}

/**
 * A tool plus its own configuration, for use with `defineSheetViewerTool`.
 *
 * `TConfig` is inferred from `config`, so each callback sees the exact config
 * type that tool declared — a misspelled or missing option is a compile error
 * where the tool is written, not a runtime surprise where it runs.
 */
export interface SheetViewerToolDefinition<TConfig> {
  id: string;
  label: string;
  icon: SheetViewerToolIcon;
  /** Options this tool needs, of whatever shape the tool defines. */
  config: TConfig;
  onClick: (context: SheetViewerToolClickContext, config: TConfig) => void;
  showLabel?: boolean;
  placement?: SheetViewerToolsPlacement;
  isDisabled?: (context: SheetViewerToolContext, config: TConfig) => boolean;
  isActive?: (context: SheetViewerToolContext, config: TConfig) => boolean;
}

/** Which end of the formula bar row a control sits at. */
export type SheetViewerToolsPlacement = 'left' | 'right';

/**
 * Progress of the load, handed to a custom loading renderer.
 *
 * Covers both phases the viewer goes through — fetching or reading the source,
 * then parsing it — so a renderer can show one continuous progress indicator.
 */
export interface SheetViewerLoadingState {
  /** Overall progress, 0–100. */
  progress: number;
  /** Human-readable step, e.g. `"Parsing workbook..."`. Empty while fetching. */
  status: string;
  /** Name of the file being loaded, when known. */
  fileName: string | null;
  /** True while the source is still being fetched or read, before parsing starts. */
  isFetching: boolean;
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
  /**
   * Ref that receives a single DOM element covering the entire active highlighted
   * area — the bounding box of all selected ranges, so one element contains every
   * highlighted cell. Set to null when there is no highlight. Useful for anchoring
   * a popover or toolbar to the highlighted section.
   *
   * Accepts an object ref or a callback ref. Populated for any non-empty selection
   * (setHighlight, the `highlight` prop, drag-selection, single-cell click), and
   * still provided when `highlightable` is false since it renders no visuals.
   *
   * Note: read it in an effect, not inside onSelectionChange — that callback fires
   * before React commits, so the element is not positioned yet.
   */
  highlightAreaRef?: Ref<HTMLDivElement>;
  /**
   * Extra HTML attributes for the highlight area element — `id`, `data-*`,
   * `aria-*`, `className`, `style`, event handlers, etc. Useful for hooking the
   * highlighted region up to `aria-describedby`, a test id, or a popover library
   * that resolves its anchor by id.
   *
   * `className` is appended to `sv-highlight-area` (never replaces it) and the
   * element's own geometry always wins over `style`. The element is
   * `pointer-events: none` by default; pass `style={{ pointerEvents: 'auto' }}`
   * to make it interactive.
   */
  highlightAreaProps?: HighlightAreaAttributes;
  /** Grid line configs: ranges with visible cell borders (like Excel's All Borders) */
  gridLines?: GridLineConfig[];
  /**
   * Tools to register in the formula bar's Tools section. The viewer renders
   * whatever is passed and knows nothing about what any of them do, so new
   * functionality is added here rather than inside the component.
   */
  tools?: SheetViewerTool[];
  /**
   * Which end of the formula bar row the tools sit at. Default: `'left'`.
   * Independent of `zoomPlacement`, so tools and the zoom control can sit at
   * opposite ends.
   */
  toolsPlacement?: SheetViewerToolsPlacement;
  /** Show the zoom control in the formula bar. Default: true */
  zoomable?: boolean;
  /** Which end of the formula bar row the zoom control sits at. Default: `'left'` */
  zoomPlacement?: SheetViewerToolsPlacement;
  /**
   * Zoom factor (1 = 100%). Changing it re-zooms the grid; the user can still
   * zoom from the control afterwards, which reports back via `onZoomChange`.
   */
  zoom?: number;
  /** Zoom factor to start at when `zoom` is not supplied. Default: 1 */
  defaultZoom?: number;
  /** Levels the zoom control offers. Default: [0.5, 0.75, 0.9, 1, 1.25, 1.5, 2] */
  zoomLevels?: number[];
  /** Lowest zoom the viewer will go to. Default: 0.25 */
  minZoom?: number;
  /** Highest zoom the viewer will go to. Default: 4 */
  maxZoom?: number;
  /** Called whenever the zoom factor changes, from the control or the API */
  onZoomChange?: (zoom: number) => void;
  /**
   * Replace the built-in loading UI shown while the file is fetched and parsed.
   *
   * Rendered inside the viewer's own full-bleed overlay, so the returned node
   * only has to describe the content — positioning and stacking are handled.
   * Return `null` to show nothing at all.
   *
   * ```tsx
   * renderLoading={({ progress, status }) => <MySpinner label={status} value={progress} />}
   * ```
   */
  renderLoading?: (state: SheetViewerLoadingState) => ReactNode;
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
  /** Enable Tab key to navigate between cells (default: true) */
  tabNavigation?: boolean;
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
  /** Remove the current highlight/selection. Pass `silent: true` to suppress onSelectionChange callback. */
  clearHighlight(options?: { silent?: boolean }): void;
  /** Get the current highlight/selection range as an Excel-style string (e.g. "A1:D10"), or null if none. */
  getHighlight(): string | null;
  /**
   * Get the single DOM element covering the active highlighted area (the bounding
   * box of all selected ranges), or null when there is no highlight. Scoped to this
   * viewer instance. Same element the `highlightAreaRef` prop receives.
   */
  getHighlightElement(): HTMLElement | null;
  /**
   * Scroll so the entire selection is visible, spanning the union of every selected
   * range. Moves the minimum amount needed on each axis, so a selection already
   * fully in view does not move; a selection larger than the viewport is aligned to
   * its top-left. Returns false when there is no selection to scroll to.
   *
   * Independent of the automatic scroll that already runs when the selection
   * changes — this is an explicit, on-demand call.
   */
  scrollToSelection(): boolean;
  /** Get cell values for a range expression (e.g. "A1:D10") from the active or named sheet */
  getCellRangeData(range: string, sheetName?: string): CellValue[][] | null;
  /** Get cell values for the currently selected range (drag/mouse selection). Returns null if no range is selected. */
  getSelectedRangeData(): CellValue[][] | null;
  /** Get the current zoom factor (1 = 100%). */
  getZoom(): number;
  /** Set the zoom factor. Clamped to `minZoom`/`maxZoom`. */
  setZoom(zoom: number): void;
  /** Step up to the next zoom level. */
  zoomIn(): void;
  /** Step down to the previous zoom level. */
  zoomOut(): void;
  /** Return to 100% zoom. */
  resetZoom(): void;
  /** Programmatically set a column width (in pixels). Minimum 30px. */
  setColumnWidth(colIndex: number, width: number, sheetName?: string): void;
  /**
   * Resize a column to fit its widest content, the same as double-clicking the
   * edge of its header. Returns the applied width, or null when the column is
   * empty and was therefore left alone.
   */
  autoFitColumn(colIndex: number, sheetName?: string): number | null;
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
  /** True when the current highlight was set via the imperative setHighlight API (not a user click) */
  isProgrammaticHighlight: boolean;
  /** The range that was last Ctrl+C copied (for marching ants indicator) */
  copiedRange: CellRange | null;
  /** All search match cell positions (row/col, 0-based) */
  searchMatches: { row: number; col: number }[];
  /** Index of the currently focused search match */
  searchActiveIndex: number;

  // Zoom
  /** Current zoom factor (1 = 100%) */
  zoom: number;
  /** Levels the zoom control offers */
  zoomLevels: number[];
  /** Lowest zoom the viewer allows */
  minZoom: number;
  /** Highest zoom the viewer allows */
  maxZoom: number;

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
  setProgrammaticHighlight: (value: boolean) => void;
  setSearchMatches: (matches: { row: number; col: number }[]) => void;
  setSearchActiveIndex: (index: number) => void;
  setCellStyle: (sheetName: string, row: number, col: number, style: CellStyle | null) => void;
  setColumnWidth: (sheetName: string, colIndex: number, width: number) => void;
  setRowHeight: (sheetName: string, rowIndex: number, height: number) => void;
  setCellComment: (sheetName: string, row: number, col: number, comment: CellComment | null) => void;
  setMode: (mode: SheetViewerMode) => void;
  /** Set the zoom factor. Clamped to the store's min/max. */
  setZoom: (zoom: number) => void;
  /** Replace the zoom bounds and level list, re-clamping the current zoom. */
  setZoomConfig: (config: { levels?: number[]; min?: number; max?: number }) => void;
  /** Step up to the next zoom level. */
  zoomIn: () => void;
  /** Step down to the previous zoom level. */
  zoomOut: () => void;
  getCurrentSheetData: () => SheetData | null;
  pushUndo: (entry: UndoEntry) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
}
