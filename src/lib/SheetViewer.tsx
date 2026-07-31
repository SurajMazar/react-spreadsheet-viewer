import React, { useEffect, useMemo, useRef as useReactRef, forwardRef, useImperativeHandle, type Ref, type CSSProperties } from 'react';
import { ViewerProvider, useViewerStore, useViewerStoreApi } from './context/ViewerContext';
import { useSourceLoader } from './hooks/useSourceLoader';
import { useFileParser } from './hooks/useFileParser';
import { parseRangeExpression } from './utils/rangeParser';
import VirtualGrid, { type VirtualGridApi } from './components/Grid/VirtualGrid';
import Toolbar from './components/Toolbar';
import FormulaBar from './components/FormulaBar';
import SheetTabs from './components/SheetTabs';
import StatusBar from './components/StatusBar';
import ChartPanel from './components/ChartPanel';
import SearchBar from './components/SearchBar';
import type { SheetViewerProps, SheetViewerHandle, SheetViewerMode, CellValue, CellComment, ParsedGridLineConfig } from './types';
import './styles/sheet-viewer.css';

/**
 * SheetViewer -- a reusable, prop-driven spreadsheet viewer component.
 * Supports forwarding a ref to access sheet data and navigation imperatively.
 */
const SheetViewer = forwardRef<SheetViewerHandle, SheetViewerProps>(
  function SheetViewer(props, ref) {
    return (
      <ViewerProvider>
        <SheetViewerInner {...props} forwardedRef={ref} />
      </ViewerProvider>
    );
  }
);

export default SheetViewer;

// ============================================================
// Inner component that has access to the ViewerContext
// ============================================================

interface SheetViewerInnerProps extends SheetViewerProps {
  forwardedRef: Ref<SheetViewerHandle>;
}

function SheetViewerInner({
  source,
  mode = 'view',
  activeSheet: controlledSheet,
  highlight,
  highlightColor,
  highlightBorderColor,
  highlightable = true,
  highlightAreaRef,
  highlightAreaProps,
  gridLines,
  showToolbar = true,
  showFileName = true,
  theme,
  searchMatchColor,
  searchActiveColor,
  onSheetChange,
  onSheetSelect,
  onCellChange,
  onSelectionChange,
  downloadable = false,
  chartable = true,
  searchable = true,
  tabNavigation = true,
  height = '100%',
  width = '100%',
  className = '',
  forwardedRef,
}: SheetViewerInnerProps) {
  const storeApi = useViewerStoreApi();
  const { buffer, fileName, isLoading: sourceLoading, error: sourceError } = useSourceLoader(source);
  const { parseBuffer } = useFileParser();

  const storeFileName = useViewerStore((s) => s.fileName);
  const isParsing = useViewerStore((s) => s.isParsing);
  const parseProgress = useViewerStore((s) => s.parseProgress);
  const parseStatus = useViewerStore((s) => s.parseStatus);
  const parseError = useViewerStore((s) => s.parseError);
  const internalActiveSheet = useViewerStore((s) => s.activeSheet);
  const setActiveSheet = useViewerStore((s) => s.setActiveSheet);
  const setSelectionRanges = useViewerStore((s) => s.setSelectionRanges);
  const sheetData = useViewerStore((s) => (s.activeSheet ? s.sheets[s.activeSheet] : null));
  const setMode = useViewerStore((s) => s.setMode);

  // Flag to suppress onSelectionChange for silent setHighlight calls
  const suppressSelectionCb = useReactRef(false);

  // Root element, so getHighlightElement() stays scoped to this viewer instance
  const rootRef = useReactRef<HTMLDivElement>(null);

  // VirtualGrid owns the scroll container; this is how the handle reaches it
  const gridApiRef = useReactRef<VirtualGridApi | null>(null);

  const withOptionalSilentSelection = (
    options: { silent?: boolean } | undefined,
    callback: () => void
  ) => {
    if (options?.silent) suppressSelectionCb.current = true;
    callback();
    if (options?.silent) suppressSelectionCb.current = false;
  };

  const clearHighlightInStore = (options?: { silent?: boolean }) => {
    const state = storeApi.getState();
    if (!state.activeSheet) return;
    withOptionalSilentSelection(options, () => {
      state.setSelectionRanges(state.activeSheet!, [], '');
      state.setActiveCell(null, null);
    });
  };

  // Parse gridLines prop into resolved CellRange configs
  const parsedGridLines = useMemo<ParsedGridLineConfig[]>(() => {
    if (!gridLines || !sheetData) return [];
    const result: ParsedGridLineConfig[] = [];
    for (const glc of gridLines) {
      const ranges = parseRangeExpression(glc.range, sheetData.rows, sheetData.cols);
      if (ranges.length > 0) {
        result.push({
          parsedRange: ranges[0],
          borderColor: glc.borderColor,
          borderWidth: glc.borderWidth,
          borderStyle: glc.borderStyle,
          bgColor: glc.bgColor,
        });
      }
    }
    return result;
  }, [gridLines, sheetData]);

  // Build CSS variable overrides from theme + highlight/search colors
  const themeStyle = useMemo<CSSProperties>(() => {
    const vars: Record<string, string> = {};
    if (theme?.bgColor) vars['--sv-color-bg'] = theme.bgColor;
    if (theme?.surfaceColor) vars['--sv-color-surface'] = theme.surfaceColor;
    if (theme?.borderColor) vars['--sv-color-border'] = theme.borderColor;
    if (theme?.borderLightColor) vars['--sv-color-border-light'] = theme.borderLightColor;
    if (theme?.textColor) vars['--sv-color-text'] = theme.textColor;
    if (theme?.textSecondaryColor) vars['--sv-color-text-secondary'] = theme.textSecondaryColor;
    if (theme?.textMutedColor) vars['--sv-color-text-muted'] = theme.textMutedColor;
    if (theme?.primaryColor) vars['--sv-color-primary'] = theme.primaryColor;
    if (theme?.primaryLightColor) vars['--sv-color-primary-light'] = theme.primaryLightColor;
    if (theme?.primaryBgColor) vars['--sv-color-primary-bg'] = theme.primaryBgColor;
    if (theme?.selectionColor) vars['--sv-color-selection'] = theme.selectionColor;
    if (theme?.selectionHoverColor) vars['--sv-color-selection-hover'] = theme.selectionHoverColor;
    if (theme?.headerBgColor) vars['--sv-color-header-bg'] = theme.headerBgColor;
    if (theme?.headerTextColor) vars['--sv-color-header-text'] = theme.headerTextColor;
    if (theme?.hoverColor) vars['--sv-color-hover'] = theme.hoverColor;
    if (searchMatchColor) vars['--sv-search-match-color'] = searchMatchColor;
    if (searchActiveColor) vars['--sv-search-active-color'] = searchActiveColor;
    // Highlight fill color via CSS variable (overrides the !important in .sv-cell-in-range)
    if (highlightColor) vars['--sv-highlight-color'] = highlightColor;
    if (highlightBorderColor) vars['--sv-highlight-border-color'] = highlightBorderColor;
    return vars as CSSProperties;
  }, [theme, searchMatchColor, searchActiveColor, highlightColor, highlightBorderColor]);

  // Expose imperative handle via ref
  useImperativeHandle(forwardedRef, () => ({
    getSheetNames: () => storeApi.getState().sheetNames,
    getSheetData: (name?: string) => {
      const s = storeApi.getState();
      const key = name ?? s.activeSheet ?? '';
      return s.sheets[key] ?? null;
    },
    getActiveSheet: () => storeApi.getState().activeSheet,
    getAllSheets: () => storeApi.getState().sheets,
    getFileName: () => storeApi.getState().fileName,
    setActiveSheet: (name: string) => storeApi.getState().setActiveSheet(name),
    setHighlight: (range: string, options?: { silent?: boolean }) => {
      const s = storeApi.getState();
      if (!s.activeSheet) return;
      const activeSheet = s.activeSheet;
      const sheet = s.sheets[activeSheet];
      if (!sheet) return;
      const ranges = parseRangeExpression(range, sheet.rows, sheet.cols);
      if (ranges.length === 0) {
        clearHighlightInStore(options);
        return;
      }
      withOptionalSilentSelection(options, () => {
        s.setProgrammaticHighlight(true);
        s.setSelectionRanges(activeSheet, ranges, range);
        s.setActiveCell(ranges[0].startRow, ranges[0].startCol);
      });
    },
    clearHighlight: (options?: { silent?: boolean }) => {
      clearHighlightInStore(options);
    },
    getHighlight: () => {
      const s = storeApi.getState();
      if (!s.activeSheet) return null;
      const sel = s.selections[s.activeSheet];
      if (!sel || sel.ranges.length === 0) return null;
      return sel.rangeInput || null;
    },
    // Scoped to this instance's root: an unscoped document lookup would resolve
    // the wrong viewer when several are mounted on the same page.
    getHighlightElement: () =>
      rootRef.current?.querySelector<HTMLElement>('.sv-highlight-area') ?? null,
    scrollToSelection: () => gridApiRef.current?.scrollSelectionIntoView() ?? false,
    getCellRangeData: (range: string, sheetName?: string) => {
      const s = storeApi.getState();
      const key = sheetName ?? s.activeSheet ?? '';
      const sheet = s.sheets[key];
      if (!sheet) return null;
      const ranges = parseRangeExpression(range, sheet.rows, sheet.cols);
      if (ranges.length === 0) return null;
      const r = ranges[0];
      const result: CellValue[][] = [];
      for (let row = r.startRow; row <= r.endRow; row++) {
        const rowData: CellValue[] = [];
        for (let col = r.startCol; col <= r.endCol; col++) {
          rowData.push(sheet.data[row]?.[col] ?? null);
        }
        result.push(rowData);
      }
      return result;
    },
    getCellComment: (cellRef: string, sheetName?: string) => {
      const s = storeApi.getState();
      const key = sheetName ?? s.activeSheet ?? '';
      const sheet = s.sheets[key];
      if (!sheet) return null;
      const ranges = parseRangeExpression(cellRef, sheet.rows, sheet.cols);
      if (ranges.length === 0) return null;
      const r = ranges[0];
      const commentKey = `${r.startRow},${r.startCol}`;
      return sheet.comments?.[commentKey] ?? null;
    },
    setCellComment: (cellRef: string, text: string | null, author?: string, sheetName?: string) => {
      const s = storeApi.getState();
      const key = sheetName ?? s.activeSheet ?? '';
      const sheet = s.sheets[key];
      if (!sheet || !key) return;
      const ranges = parseRangeExpression(cellRef, sheet.rows, sheet.cols);
      if (ranges.length === 0) return;
      const r = ranges[0];
      if (text === null) {
        s.setCellComment(key, r.startRow, r.startCol, null);
      } else {
        const comment: CellComment = { text };
        if (author) comment.author = author;
        s.setCellComment(key, r.startRow, r.startCol, comment);
      }
    },
    setColumnWidth: (colIndex: number, width: number, sheetName?: string) => {
      const s = storeApi.getState();
      const key = sheetName ?? s.activeSheet ?? '';
      if (key) s.setColumnWidth(key, colIndex, width);
    },
    setRowHeight: (rowIndex: number, height: number, sheetName?: string) => {
      const s = storeApi.getState();
      const key = sheetName ?? s.activeSheet ?? '';
      if (key) s.setRowHeight(key, rowIndex, height);
    },
    undo: () => storeApi.getState().undo(),
    redo: () => storeApi.getState().redo(),
    canUndo: () => storeApi.getState().undoStack.length > 0,
    canRedo: () => storeApi.getState().redoStack.length > 0,
    getSelectedRangeData: () => {
      const s = storeApi.getState();
      if (!s.activeSheet) return null;
      const sel = s.selections[s.activeSheet];
      if (!sel || sel.ranges.length === 0) return null;
      const sheet = s.sheets[s.activeSheet];
      if (!sheet) return null;
      const r = sel.ranges[0];
      const result: CellValue[][] = [];
      for (let row = r.startRow; row <= r.endRow; row++) {
        const rowData: CellValue[] = [];
        for (let col = r.startCol; col <= r.endCol; col++) {
          rowData.push(sheet.data[row]?.[col] ?? null);
        }
        result.push(rowData);
      }
      return result;
    },
  }));

  // Sync mode prop to store
  useEffect(() => {
    setMode(mode as SheetViewerMode);
  }, [mode, setMode]);

  // Parse buffer when source is loaded
  useEffect(() => {
    if (buffer && fileName) {
      parseBuffer(buffer, fileName);
    }
  }, [buffer, fileName, parseBuffer]);

  // Sync controlled activeSheet prop
  useEffect(() => {
    if (controlledSheet && controlledSheet !== internalActiveSheet) {
      setActiveSheet(controlledSheet);
    }
  }, [controlledSheet, internalActiveSheet, setActiveSheet]);

  // Track previous highlight prop to detect prop-driven transitions only
  const prevHighlightRef = useReactRef<string | undefined>(highlight);

  // Sync highlight prop — only reacts to prop changes, never clears imperative highlights
  useEffect(() => {
    if (!internalActiveSheet || !sheetData) return;
    const prev = prevHighlightRef.current;
    prevHighlightRef.current = highlight;

    if (!highlight) {
      // Only clear if highlight prop transitioned from a value to empty/undefined
      if (prev) {
        clearHighlightInStore();
      }
      return;
    }
    const ranges = parseRangeExpression(highlight, sheetData.rows, sheetData.cols);
    if (ranges.length > 0) {
      storeApi.getState().setProgrammaticHighlight(true);
      setSelectionRanges(internalActiveSheet, ranges, highlight);
    }
  }, [highlight, internalActiveSheet, sheetData, setSelectionRanges, storeApi]);

  // Listen for cell changes in edit mode and forward to callback
  useEffect(() => {
    if (!onCellChange) return;
    const unsub = storeApi.subscribe((state, prevState) => {
      if (state.sheets !== prevState.sheets && state.activeSheet) {
        const sheet = state.sheets[state.activeSheet];
        const prevSheet = prevState.sheets[state.activeSheet];
        if (sheet && prevSheet && sheet.data !== prevSheet.data) {
          const cell = state.activeCell;
          if (cell) {
            const val: CellValue = sheet.data[cell.row]?.[cell.col];
            onCellChange(state.activeSheet!, cell.row, cell.col, val);
          }
        }
      }
    });
    return unsub;
  }, [onCellChange, storeApi]);

  // Listen for selection changes and forward to callback (with optional cell DOM info)
  useEffect(() => {
    if (!onSelectionChange) return;
    const unsub = storeApi.subscribe((state, prevState) => {
      if (suppressSelectionCb.current) return;
      if (state.selections !== prevState.selections && state.activeSheet) {
        const sel = state.selections[state.activeSheet];
        if (sel?.ranges) {
          const cell = state.activeCell;
          if (cell) {
            const el = document.querySelector<HTMLElement>(
              `[data-cell="${cell.row},${cell.col}"]`
            );
            if (el) {
              onSelectionChange(sel.ranges, { element: el, rect: el.getBoundingClientRect() });
            } else {
              onSelectionChange(sel.ranges);
            }
          } else {
            onSelectionChange(sel.ranges);
          }
        }
      }
    });
    return unsub;
  }, [onSelectionChange, storeApi]);

  const hasData = !!storeFileName && !isParsing;
  const isLoadingAny = sourceLoading || isParsing;
  const error = sourceError || parseError;

  const containerStyle: CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    ...themeStyle,
  };

  return (
    <div ref={rootRef} className={`sheet-viewer ${className}`.trim()} style={containerStyle}>
      {isLoadingAny && (
        <div className="sv-loading-overlay">
          <div className="sv-loading-card">
            <div className="sv-loading-spinner" />
            <div className="sv-progress-bar-container">
              <div
                className="sv-progress-bar-fill"
                style={{ width: `${parseProgress}%` }}
              />
            </div>
            <p className="sv-loading-status">{parseStatus || 'Loading...'}</p>
            <p className="sv-loading-percent">{Math.round(parseProgress)}%</p>
          </div>
        </div>
      )}

      {error && !isLoadingAny && (
        <div className="sv-error-overlay">
          <div className="sv-error-card">
            <p>Error: {error}</p>
          </div>
        </div>
      )}

      {!source && !isLoadingAny && !hasData && (
        <div className="sv-empty-overlay">
          <p className="sv-empty-text">No source provided</p>
        </div>
      )}

      {hasData && (
        <>
          {showToolbar && <Toolbar downloadable={downloadable} chartable={chartable} showFileName={showFileName} />}
          <FormulaBar />
          <div className="sv-main-content">
            <div className="sv-grid-wrapper">
              <VirtualGrid
                highlightable={highlightable}
                highlightColor={highlightColor}
                highlightBorderColor={highlightBorderColor}
                highlightAreaRef={highlightAreaRef}
                highlightAreaProps={highlightAreaProps}
                gridApiRef={gridApiRef}
                parsedGridLines={parsedGridLines.length > 0 ? parsedGridLines : undefined}
                tabNavigation={tabNavigation}
              />
              {searchable && <SearchBar />}
            </div>
            {chartable && <ChartPanel />}
          </div>
          <SheetTabs onSheetChange={onSheetChange} onSheetSelect={onSheetSelect} />
          <StatusBar />
        </>
      )}
    </div>
  );
}
