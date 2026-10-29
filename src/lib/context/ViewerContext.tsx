import React, { createContext, useContext, useRef, type ReactNode } from 'react';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import {
  clampZoom,
  stepZoom,
  DEFAULT_ZOOM,
  ZOOM_LEVELS,
  MIN_ZOOM,
  MAX_ZOOM,
} from '../utils/zoom';
import type {
  ViewerState,
  SelectionState,
  SheetData,
  CellValue,
  CellStyle,
  CellComment,
  ChartOverlay,
  SheetViewerMode,
  CellRange,
  UndoEntry,
  SheetCellInput,
  SheetViewerFormulaFunction,
} from '../types';
import { recalculateSheet as recalculateSheetData } from '../formula/recalculate';

/**
 * Stable empty objects to avoid creating new references in selectors.
 */
export const EMPTY_SELECTION: SelectionState = Object.freeze({
  ranges: [],
  rangeInput: '',
  scrollPos: null,
}) as SelectionState;

export const EMPTY_RANGES: CellRange[] = Object.freeze([]) as unknown as CellRange[];

/**
 * Write one value into a sheet, without recalculating. A string starting with
 * `=` (and longer than that) becomes the cell's formula; any other value
 * clears a formula the cell had.
 */
function writeCellValue(sheet: SheetData, row: number, col: number, value: CellValue): SheetData {
  const key = `${row},${col}`;
  const isFormula = typeof value === 'string' && value.length > 1 && value.startsWith('=');

  let formulas = sheet.formulas;
  if (isFormula) {
    formulas = { ...(formulas || {}), [key]: value as string };
  } else if (formulas && formulas[key] !== undefined) {
    const { [key]: _removed, ...rest } = formulas;
    formulas = rest;
  }

  // Extend data array to accommodate the target cell if needed
  const newData = sheet.data.slice();
  while (newData.length <= row) newData.push([]);
  const targetRow = [...newData[row]];
  while (targetRow.length <= col) targetRow.push(null);
  // A formula cell holds its result; until recalculation fills it in, keep
  // the previous value rather than flashing the formula text.
  targetRow[col] = isFormula ? (sheet.data[row]?.[col] ?? null) : value;
  newData[row] = targetRow;

  const next: SheetData = {
    ...sheet,
    data: newData,
    rows: Math.max(sheet.rows, row + 1),
    cols: Math.max(sheet.cols, col + 1),
  };
  if (formulas !== sheet.formulas) next.formulas = formulas;
  return next;
}

/**
 * The `lastCellChange` an undo/redo entry produces: its first value change,
 * or the previous one untouched when the entry only changed styles.
 */
function changeFor(
  entry: UndoEntry,
  prev: ViewerState['lastCellChange'],
): ViewerState['lastCellChange'] {
  const first = entry.cellChanges[0];
  if (!first) return prev;
  return { sheetName: entry.sheetName, row: first.row, col: first.col, seq: (prev?.seq ?? 0) + 1 };
}

/** Replace or remove one entry of a sparse "row,col" map. */
function withEntry<T>(map: Record<string, T> | undefined, key: string, value: T | null | undefined): Record<string, T> {
  if (value === null || value === undefined) {
    if (!map || map[key] === undefined) return map || {};
    const { [key]: _removed, ...rest } = map;
    return rest;
  }
  return { ...(map || {}), [key]: value };
}

/** The value a cell would show in an editor: its formula, else its value. */
export function getCellInputValue(sheet: SheetData, row: number, col: number): CellValue {
  return sheet.formulas?.[`${row},${col}`] ?? sheet.data[row]?.[col] ?? null;
}

const ViewerContext = createContext<StoreApi<ViewerState> | null>(null);

/**
 * Creates the initial store state + actions.
 * Each <SheetViewer /> instance gets its own isolated store.
 *
 * Exported so the store's actions can be unit-tested directly, without
 * standing up a React tree — and without a second copy of this factory that
 * would drift out of sync with it.
 */
export function createViewerStore(): StoreApi<ViewerState> {
  return createStore<ViewerState>((set, get) => ({
    // File state
    fileName: null,
    sheetNames: [],
    sheets: {},
    images: {},
    chartOverlays: {},
    activeSheet: null,

    // Parsing state
    isParsing: false,
    parseProgress: 0,
    parseStatus: '',
    parseError: null,

    // Selection state (per sheet)
    selections: {},
    activeCell: null,

    // UI state
    showChartPanel: false,
    chartType: 'bar',
    isProgrammaticHighlight: false,
    copiedRange: null,
    searchMatches: [],
    searchActiveIndex: 0,

    // Zoom
    zoom: DEFAULT_ZOOM,
    zoomLevels: [...ZOOM_LEVELS],
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,

    // Undo / Redo
    undoStack: [],
    redoStack: [],

    // Mode
    mode: 'view' as SheetViewerMode,

    // Formulas
    customFunctions: {},
    lastCellChange: null,

    // Actions
    setParseProgress: (progress: number, status?: string) =>
      set({ parseProgress: progress, parseStatus: status || '' }),

    startParsing: () =>
      set({ isParsing: true, parseProgress: 0, parseStatus: 'Starting...', parseError: null }),

    setParseError: (error: string) =>
      set({ isParsing: false, parseError: error }),

    setFileData: (payload: {
      fileName: string;
      sheetNames: string[];
      sheets: Record<string, SheetData>;
      images?: Record<string, unknown>;
      chartOverlays?: Record<string, ChartOverlay[]>;
    }) => {
      const { customFunctions } = get();
      const sheets: Record<string, SheetData> = {};
      for (const [name, sheet] of Object.entries(payload.sheets)) {
        sheets[name] = recalculateSheetData(sheet, customFunctions);
      }
      set({
        fileName: payload.fileName,
        sheetNames: payload.sheetNames,
        sheets,
        images: payload.images || {},
        chartOverlays: payload.chartOverlays || {},
        activeSheet: payload.sheetNames[0] || null,
        isParsing: false,
        parseProgress: 100,
        parseStatus: 'Complete',
        parseError: null,
        selections: {},
        activeCell: null,
        lastCellChange: null,
      });
    },

    setActiveSheet: (sheetName: string) => set({ activeSheet: sheetName }),

    setActiveCell: (row: number | null, col: number | null) =>
      set({ activeCell: row !== null && row !== undefined && col !== null && col !== undefined ? { row, col } : null }),

    setSelectionRanges: (sheetName: string, ranges: CellRange[], rangeInput?: string) => {
      const state = get();
      const prev = state.selections[sheetName] || EMPTY_SELECTION;
      set({
        selections: {
          ...state.selections,
          [sheetName]: {
            ...prev,
            ranges,
            rangeInput: rangeInput !== undefined ? rangeInput : prev.rangeInput,
          },
        },
      });
    },

    setRangeInput: (sheetName: string, rangeInput: string) => {
      const state = get();
      const prev = state.selections[sheetName] || EMPTY_SELECTION;
      set({
        selections: {
          ...state.selections,
          [sheetName]: { ...prev, rangeInput },
        },
      });
    },

    setScrollPosition: (sheetName: string, scrollPos: { top: number; left: number }) => {
      const state = get();
      const prev = state.selections[sheetName] || EMPTY_SELECTION;
      set({
        selections: {
          ...state.selections,
          [sheetName]: { ...prev, scrollPos },
        },
      });
    },

    setCellValue: (
      sheetName: string,
      row: number,
      col: number,
      value: CellValue,
      options?: { silent?: boolean },
    ) => {
      const state = get();
      const sheet = state.sheets[sheetName];
      if (!sheet) return;

      const next = recalculateSheetData(writeCellValue(sheet, row, col, value), state.customFunctions);
      const update: Partial<ViewerState> = { sheets: { ...state.sheets, [sheetName]: next } };
      if (!options?.silent) {
        update.lastCellChange = { sheetName, row, col, seq: (state.lastCellChange?.seq ?? 0) + 1 };
      }
      set(update);
    },

    updateCell: (
      sheetName: string,
      row: number,
      col: number,
      cellUpdate: SheetCellInput,
      options?: { silent?: boolean },
    ) => {
      const state = get();
      const sheet = state.sheets[sheetName];
      if (!sheet) return;
      const key = `${row},${col}`;

      let next = sheet;
      const touchesValue = 'value' in cellUpdate || 'formula' in cellUpdate;
      if (cellUpdate.formula) {
        const formula = cellUpdate.formula.startsWith('=') ? cellUpdate.formula : `=${cellUpdate.formula}`;
        next = writeCellValue(next, row, col, formula);
      } else if ('value' in cellUpdate) {
        next = writeCellValue(next, row, col, cellUpdate.value ?? null);
      } else if ('formula' in cellUpdate) {
        // `formula: ''`/`undefined` clears the formula and keeps its last result.
        next = writeCellValue(next, row, col, next.data[row]?.[col] ?? null);
      }
      if ('format' in cellUpdate) next = { ...next, formats: withEntry(next.formats, key, cellUpdate.format || null) };
      if ('style' in cellUpdate) {
        const merged = cellUpdate.style ? { ...(next.styles?.[key] || {}), ...cellUpdate.style } : null;
        next = { ...next, styles: withEntry(next.styles, key, merged) };
      }
      if ('meta' in cellUpdate) next = { ...next, meta: withEntry(next.meta, key, cellUpdate.meta ?? null) };
      if ('validation' in cellUpdate) {
        next = { ...next, validations: withEntry(next.validations, key, cellUpdate.validation ?? null) };
      }
      if ('comment' in cellUpdate) next = { ...next, comments: withEntry(next.comments, key, cellUpdate.comment ?? null) };
      if (next === sheet) return;

      if (touchesValue) next = recalculateSheetData(next, state.customFunctions);
      const update: Partial<ViewerState> = { sheets: { ...state.sheets, [sheetName]: next } };
      if (touchesValue && !options?.silent) {
        update.lastCellChange = { sheetName, row, col, seq: (state.lastCellChange?.seq ?? 0) + 1 };
      }
      set(update);
    },

    setCustomFunctions: (functions: Record<string, SheetViewerFormulaFunction> | undefined) => {
      const state = get();
      const normalized: Record<string, SheetViewerFormulaFunction> = {};
      for (const [name, fn] of Object.entries(functions || {})) {
        if (typeof fn === 'function') normalized[name.toUpperCase()] = fn;
      }
      const prevNames = Object.keys(state.customFunctions);
      const nextNames = Object.keys(normalized);
      const unchanged =
        prevNames.length === nextNames.length &&
        nextNames.every((name) => state.customFunctions[name] === normalized[name]);
      if (unchanged) return;

      let sheetsChanged = false;
      const sheets: Record<string, SheetData> = {};
      for (const [name, sheet] of Object.entries(state.sheets)) {
        sheets[name] = recalculateSheetData(sheet, normalized);
        if (sheets[name] !== sheet) sheetsChanged = true;
      }
      set(sheetsChanged ? { customFunctions: normalized, sheets } : { customFunctions: normalized });
    },

    recalculateSheet: (sheetName: string) => {
      const state = get();
      const sheet = state.sheets[sheetName];
      if (!sheet) return;
      const next = recalculateSheetData(sheet, state.customFunctions);
      if (next !== sheet) set({ sheets: { ...state.sheets, [sheetName]: next } });
    },

    toggleChartPanel: () => set((s) => ({ showChartPanel: !s.showChartPanel })),
    setChartType: (chartType: string) => set({ chartType }),
    setCopiedRange: (range: CellRange | null) => set({ copiedRange: range }),
    setProgrammaticHighlight: (value: boolean) => set({ isProgrammaticHighlight: value }),
    setSearchMatches: (matches: { row: number; col: number }[]) =>
      set({ searchMatches: matches, searchActiveIndex: 0 }),
    setSearchActiveIndex: (index: number) => set({ searchActiveIndex: index }),

    setColumnWidth: (sheetName: string, colIndex: number, width: number) => {
      const state = get();
      const sheet = state.sheets[sheetName];
      if (!sheet) return;
      const newWidths = [...(sheet.colWidths || [])];
      // Extend array if needed
      while (newWidths.length <= colIndex) newWidths.push(100);
      newWidths[colIndex] = Math.max(30, width); // 30px minimum
      set({ sheets: { ...state.sheets, [sheetName]: { ...sheet, colWidths: newWidths } } });
    },

    setRowHeight: (sheetName: string, rowIndex: number, height: number) => {
      const state = get();
      const sheet = state.sheets[sheetName];
      if (!sheet) return;
      const newHeights = [...(sheet.rowHeights || [])];
      while (newHeights.length <= rowIndex) newHeights.push(26); // default ROW_HEIGHT
      newHeights[rowIndex] = Math.max(20, height); // 20px minimum
      set({ sheets: { ...state.sheets, [sheetName]: { ...sheet, rowHeights: newHeights } } });
    },

    setCellComment: (sheetName: string, row: number, col: number, comment: CellComment | null) => {
      const state = get();
      const sheet = state.sheets[sheetName];
      if (!sheet) return;
      const key = `${row},${col}`;
      const prevComments = sheet.comments || {};
      let newComments: Record<string, CellComment>;
      if (comment === null) {
        const { [key]: _removed, ...rest } = prevComments;
        newComments = rest;
      } else {
        newComments = { ...prevComments, [key]: comment };
      }
      set({ sheets: { ...state.sheets, [sheetName]: { ...sheet, comments: newComments } } });
    },

    setCellStyle: (sheetName: string, row: number, col: number, style: CellStyle | null) => {
      const state = get();
      const sheet = state.sheets[sheetName];
      if (!sheet) return;
      const key = `${row},${col}`;
      const prevStyles = sheet.styles || {};
      let newStyles: Record<string, CellStyle>;
      if (style === null) {
        // Remove the style entry
        const { [key]: _removed, ...rest } = prevStyles;
        newStyles = rest;
      } else {
        // Merge with any existing style
        newStyles = {
          ...prevStyles,
          [key]: { ...(prevStyles[key] || {}), ...style },
        };
      }
      set({
        sheets: {
          ...state.sheets,
          [sheetName]: { ...sheet, styles: newStyles },
        },
      });
    },

    setMode: (mode: SheetViewerMode) => set({ mode }),

    setZoom: (zoom: number) => {
      const state = get();
      const next = clampZoom(zoom, state.minZoom, state.maxZoom);
      if (next !== state.zoom) set({ zoom: next });
    },

    setZoomConfig: (config: { levels?: number[]; min?: number; max?: number }) => {
      const state = get();
      const min = config.min ?? state.minZoom;
      const max = config.max ?? state.maxZoom;
      const levels = config.levels ?? state.zoomLevels;
      // Re-clamp the live zoom: narrowing the bounds must not leave the viewer
      // parked outside them.
      const zoom = clampZoom(state.zoom, min, max);

      // Compared by value, not identity: consumers pass `zoomLevels` as an
      // inline array literal, which is a fresh reference on every render. An
      // unconditional set would republish identical config each time and
      // re-render every zoom subscriber for nothing.
      const unchanged =
        min === state.minZoom &&
        max === state.maxZoom &&
        zoom === state.zoom &&
        levels.length === state.zoomLevels.length &&
        levels.every((level, i) => level === state.zoomLevels[i]);
      if (unchanged) return;

      set({ minZoom: min, maxZoom: max, zoomLevels: levels, zoom });
    },

    zoomIn: () => {
      const state = get();
      state.setZoom(stepZoom(state.zoom, 'in', state.zoomLevels, state.minZoom, state.maxZoom));
    },

    zoomOut: () => {
      const state = get();
      state.setZoom(stepZoom(state.zoom, 'out', state.zoomLevels, state.minZoom, state.maxZoom));
    },

    getCurrentSheetData: (): SheetData | null => {
      const state = get();
      if (!state.activeSheet || !state.sheets[state.activeSheet]) return null;
      return state.sheets[state.activeSheet];
    },

    pushUndo: (entry: UndoEntry) => {
      const state = get();
      const MAX_UNDO = 100;
      const newStack = [...state.undoStack, entry];
      if (newStack.length > MAX_UNDO) newStack.shift();
      set({ undoStack: newStack, redoStack: [] });
    },

    undo: () => {
      const state = get();
      if (state.undoStack.length === 0) return;
      const entry = state.undoStack[state.undoStack.length - 1];
      const sheet = state.sheets[entry.sheetName];
      if (!sheet) return;

      // Reverse value changes (formula text in an entry restores the formula)
      let nextSheet = sheet;
      for (const ch of entry.cellChanges) {
        nextSheet = writeCellValue(nextSheet, ch.row, ch.col, ch.oldValue);
      }

      // Reverse style changes
      const newStyles = { ...(nextSheet.styles || {}) };
      for (const ch of entry.styleChanges) {
        const key = `${ch.row},${ch.col}`;
        if (ch.oldStyle === undefined) {
          delete newStyles[key];
        } else {
          newStyles[key] = ch.oldStyle;
        }
      }

      set({
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, entry],
        sheets: {
          ...state.sheets,
          [entry.sheetName]: recalculateSheetData({ ...nextSheet, styles: newStyles }, state.customFunctions),
        },
        lastCellChange: changeFor(entry, state.lastCellChange),
      });
    },

    redo: () => {
      const state = get();
      if (state.redoStack.length === 0) return;
      const entry = state.redoStack[state.redoStack.length - 1];
      const sheet = state.sheets[entry.sheetName];
      if (!sheet) return;

      // Re-apply value changes (formula text in an entry restores the formula)
      let nextSheet = sheet;
      for (const ch of entry.cellChanges) {
        nextSheet = writeCellValue(nextSheet, ch.row, ch.col, ch.newValue);
      }

      // Re-apply style changes
      const newStyles = { ...(nextSheet.styles || {}) };
      for (const ch of entry.styleChanges) {
        const key = `${ch.row},${ch.col}`;
        if (ch.newStyle === undefined) {
          delete newStyles[key];
        } else {
          newStyles[key] = ch.newStyle;
        }
      }

      set({
        redoStack: state.redoStack.slice(0, -1),
        undoStack: [...state.undoStack, entry],
        sheets: {
          ...state.sheets,
          [entry.sheetName]: recalculateSheetData({ ...nextSheet, styles: newStyles }, state.customFunctions),
        },
        lastCellChange: changeFor(entry, state.lastCellChange),
      });
    },

    reset: () =>
      set({
        fileName: null,
        sheetNames: [],
        sheets: {},
        images: {},
        chartOverlays: {},
        activeSheet: null,
        isParsing: false,
        parseProgress: 0,
        parseStatus: '',
        parseError: null,
        selections: {},
        activeCell: null,
        showChartPanel: false,
        isProgrammaticHighlight: false,
        copiedRange: null,
        searchMatches: [],
        searchActiveIndex: 0,
        undoStack: [],
        redoStack: [],
        lastCellChange: null,
      }),
  }));
}

export function ViewerProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<StoreApi<ViewerState> | null>(null);
  if (!storeRef.current) {
    storeRef.current = createViewerStore();
  }
  return (
    <ViewerContext.Provider value={storeRef.current}>
      {children}
    </ViewerContext.Provider>
  );
}

/**
 * Hook to access the viewer store from any component inside <ViewerProvider>.
 * Usage: const value = useViewerStore((s) => s.someField);
 */
export function useViewerStore<T>(selector: (state: ViewerState) => T): T {
  const store = useContext(ViewerContext);
  if (!store) {
    throw new Error('useViewerStore must be used within a <ViewerProvider>');
  }
  return useStoreWithEqualityFn(store, selector);
}

/**
 * Hook to get the raw store reference (for imperative access).
 */
export function useViewerStoreApi(): StoreApi<ViewerState> {
  const store = useContext(ViewerContext);
  if (!store) {
    throw new Error('useViewerStoreApi must be used within a <ViewerProvider>');
  }
  return store;
}
