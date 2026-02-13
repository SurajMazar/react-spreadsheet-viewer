import { createContext, useContext, useRef, type ReactNode } from 'react';
import { createStore, useStore, type StoreApi } from 'zustand';
import type {
  ViewerState,
  SelectionState,
  SheetData,
  CellValue,
  ChartOverlay,
  SheetViewerMode,
  CellRange,
} from '../types';

/**
 * Stable empty objects to avoid creating new references in selectors.
 */
export const EMPTY_SELECTION: SelectionState = Object.freeze({
  ranges: [],
  rangeInput: '',
  scrollPos: null,
}) as SelectionState;

export const EMPTY_RANGES: CellRange[] = Object.freeze([]) as unknown as CellRange[];

const ViewerContext = createContext<StoreApi<ViewerState> | null>(null);

/**
 * Creates the initial store state + actions.
 * Each <SheetViewer /> instance gets its own isolated store.
 */
function createViewerStore(): StoreApi<ViewerState> {
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

    // Mode
    mode: 'view' as SheetViewerMode,

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
    }) =>
      set({
        fileName: payload.fileName,
        sheetNames: payload.sheetNames,
        sheets: payload.sheets,
        images: payload.images || {},
        chartOverlays: payload.chartOverlays || {},
        activeSheet: payload.sheetNames[0] || null,
        isParsing: false,
        parseProgress: 100,
        parseStatus: 'Complete',
        parseError: null,
        selections: {},
        activeCell: null,
      }),

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

    setCellValue: (sheetName: string, row: number, col: number, value: CellValue) => {
      const state = get();
      const sheet = state.sheets[sheetName];
      if (!sheet) return;
      const newData = sheet.data.map((r, ri) =>
        ri === row ? r.map((c, ci) => (ci === col ? value : c)) : r
      );
      set({
        sheets: {
          ...state.sheets,
          [sheetName]: { ...sheet, data: newData },
        },
      });
    },

    toggleChartPanel: () => set((s) => ({ showChartPanel: !s.showChartPanel })),
    setChartType: (chartType: string) => set({ chartType }),
    setMode: (mode: SheetViewerMode) => set({ mode }),

    getCurrentSheetData: (): SheetData | null => {
      const state = get();
      if (!state.activeSheet || !state.sheets[state.activeSheet]) return null;
      return state.sheets[state.activeSheet];
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
  return useStore(store, selector);
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
