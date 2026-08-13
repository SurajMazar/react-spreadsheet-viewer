import { describe, it, expect, beforeEach } from 'vitest';
import { type StoreApi } from 'zustand/vanilla';
import { createViewerStore } from '../ViewerContext';
import type { ViewerState, SheetData, CellRange } from '../../types';

/**
 * Exercises the real store factory used by <SheetViewer />, so these tests
 * cannot drift away from the implementation they cover.
 */

const mockSheet: SheetData = {
  data: [
    ['Name', 'Age', 'City'],
    ['Alice', 30, 'NYC'],
    ['Bob', 25, 'SF'],
  ],
  rows: 3,
  cols: 3,
  merges: [],
  colWidths: [100, 100, 100],
};

let store: StoreApi<ViewerState>;

beforeEach(() => {
  store = createViewerStore();
});

// =============================================
// Initial State
// =============================================
describe('ViewerStore — Initial state', () => {
  it('starts with default values', () => {
    const s = store.getState();
    expect(s.fileName).toBeNull();
    expect(s.sheetNames).toEqual([]);
    expect(s.sheets).toEqual({});
    expect(s.activeSheet).toBeNull();
    expect(s.isParsing).toBe(false);
    expect(s.parseProgress).toBe(0);
    expect(s.parseError).toBeNull();
    expect(s.activeCell).toBeNull();
    expect(s.showChartPanel).toBe(false);
    expect(s.copiedRange).toBeNull();
    expect(s.mode).toBe('view');
    expect(s.chartType).toBe('bar');
  });
});

// =============================================
// Parsing Actions
// =============================================
describe('ViewerStore — Parsing actions', () => {
  it('startParsing sets isParsing and resets progress', () => {
    store.getState().startParsing();
    const s = store.getState();
    expect(s.isParsing).toBe(true);
    expect(s.parseProgress).toBe(0);
    expect(s.parseStatus).toBe('Starting...');
    expect(s.parseError).toBeNull();
  });

  it('setParseProgress updates progress and status', () => {
    store.getState().setParseProgress(50, 'Processing Sheet1...');
    const s = store.getState();
    expect(s.parseProgress).toBe(50);
    expect(s.parseStatus).toBe('Processing Sheet1...');
  });

  it('setParseProgress defaults status to empty string', () => {
    store.getState().setParseProgress(75);
    expect(store.getState().parseStatus).toBe('');
  });

  it('setParseError stops parsing and records error', () => {
    store.getState().startParsing();
    store.getState().setParseError('Invalid file');
    const s = store.getState();
    expect(s.isParsing).toBe(false);
    expect(s.parseError).toBe('Invalid file');
  });
});

// =============================================
// setFileData
// =============================================
describe('ViewerStore — setFileData', () => {
  it('populates file data and auto-selects first sheet', () => {
    store.getState().startParsing();
    store.getState().setFileData({
      fileName: 'test.xlsx',
      sheetNames: ['Sheet1', 'Sheet2'],
      sheets: { Sheet1: mockSheet, Sheet2: { ...mockSheet, rows: 1, cols: 1, data: [['X']] } },
    });
    const s = store.getState();
    expect(s.fileName).toBe('test.xlsx');
    expect(s.sheetNames).toEqual(['Sheet1', 'Sheet2']);
    expect(s.activeSheet).toBe('Sheet1');
    expect(s.isParsing).toBe(false);
    expect(s.parseProgress).toBe(100);
    expect(s.parseStatus).toBe('Complete');
  });

  it('resets selections and activeCell', () => {
    store.getState().setActiveCell(1, 1);
    store.getState().setFileData({
      fileName: 'test.csv',
      sheetNames: ['Sheet1'],
      sheets: { Sheet1: mockSheet },
    });
    expect(store.getState().activeCell).toBeNull();
    expect(store.getState().selections).toEqual({});
  });
});

// =============================================
// Sheet Navigation
// =============================================
describe('ViewerStore — setActiveSheet', () => {
  it('switches the active sheet', () => {
    store.getState().setFileData({
      fileName: 'test.xlsx',
      sheetNames: ['A', 'B'],
      sheets: { A: mockSheet, B: mockSheet },
    });
    store.getState().setActiveSheet('B');
    expect(store.getState().activeSheet).toBe('B');
  });
});

// =============================================
// Active Cell
// =============================================
describe('ViewerStore — setActiveCell', () => {
  it('sets active cell', () => {
    store.getState().setActiveCell(5, 3);
    expect(store.getState().activeCell).toEqual({ row: 5, col: 3 });
  });

  it('clears active cell when passed null', () => {
    store.getState().setActiveCell(1, 1);
    store.getState().setActiveCell(null, null);
    expect(store.getState().activeCell).toBeNull();
  });
});

// =============================================
// Selection Ranges
// =============================================
describe('ViewerStore — Selection ranges', () => {
  it('sets selection ranges for a sheet', () => {
    const range: CellRange = { startRow: 0, startCol: 0, endRow: 2, endCol: 2 };
    store.getState().setSelectionRanges('Sheet1', [range], 'A1:C3');
    const sel = store.getState().selections['Sheet1'];
    expect(sel.ranges).toEqual([range]);
    expect(sel.rangeInput).toBe('A1:C3');
  });

  it('clears ranges when empty array is passed', () => {
    const range: CellRange = { startRow: 0, startCol: 0, endRow: 2, endCol: 2 };
    store.getState().setSelectionRanges('Sheet1', [range], 'A1:C3');
    store.getState().setSelectionRanges('Sheet1', [], '');
    expect(store.getState().selections['Sheet1'].ranges).toEqual([]);
  });

  it('preserves rangeInput when not provided', () => {
    store.getState().setSelectionRanges('Sheet1', [], 'A1');
    store.getState().setSelectionRanges('Sheet1', [{ startRow: 0, startCol: 0, endRow: 0, endCol: 0 }]);
    expect(store.getState().selections['Sheet1'].rangeInput).toBe('A1');
  });

  it('setRangeInput updates only the input text', () => {
    store.getState().setRangeInput('Sheet1', 'B2:D4');
    expect(store.getState().selections['Sheet1'].rangeInput).toBe('B2:D4');
  });

  it('maintains independent selections per sheet', () => {
    store.getState().setSelectionRanges('Sheet1', [], 'A1');
    store.getState().setSelectionRanges('Sheet2', [], 'Z99');
    expect(store.getState().selections['Sheet1'].rangeInput).toBe('A1');
    expect(store.getState().selections['Sheet2'].rangeInput).toBe('Z99');
  });
});

// =============================================
// Scroll Position
// =============================================
describe('ViewerStore — setScrollPosition', () => {
  it('stores scroll position per sheet', () => {
    store.getState().setScrollPosition('Sheet1', { top: 100, left: 50 });
    expect(store.getState().selections['Sheet1'].scrollPos).toEqual({ top: 100, left: 50 });
  });
});

// =============================================
// Cell Value Editing
// =============================================
describe('ViewerStore — setCellValue', () => {
  beforeEach(() => {
    store.getState().setFileData({
      fileName: 'test.csv',
      sheetNames: ['Sheet1'],
      sheets: { Sheet1: mockSheet },
    });
  });

  it('updates a cell value immutably', () => {
    store.getState().setCellValue('Sheet1', 1, 0, 'Charlie');
    expect(store.getState().sheets['Sheet1'].data[1][0]).toBe('Charlie');
    // Original row should not be mutated
    expect(mockSheet.data[1][0]).toBe('Alice');
  });

  it('does nothing for non-existent sheet', () => {
    store.getState().setCellValue('NonExistent', 0, 0, 'X');
    expect(store.getState().sheets['NonExistent']).toBeUndefined();
  });
});

// =============================================
// UI State
// =============================================
describe('ViewerStore — UI state', () => {
  it('toggleChartPanel toggles between true and false', () => {
    expect(store.getState().showChartPanel).toBe(false);
    store.getState().toggleChartPanel();
    expect(store.getState().showChartPanel).toBe(true);
    store.getState().toggleChartPanel();
    expect(store.getState().showChartPanel).toBe(false);
  });

  it('setChartType updates chart type', () => {
    store.getState().setChartType('line');
    expect(store.getState().chartType).toBe('line');
  });

  it('setCopiedRange sets and clears copied range', () => {
    const range: CellRange = { startRow: 0, startCol: 0, endRow: 1, endCol: 1 };
    store.getState().setCopiedRange(range);
    expect(store.getState().copiedRange).toEqual(range);
    store.getState().setCopiedRange(null);
    expect(store.getState().copiedRange).toBeNull();
  });

  it('setMode switches between view and edit', () => {
    store.getState().setMode('edit');
    expect(store.getState().mode).toBe('edit');
    store.getState().setMode('view');
    expect(store.getState().mode).toBe('view');
  });
});

// =============================================
// setColumnWidth / setRowHeight
// =============================================
describe('ViewerStore — setColumnWidth', () => {
  beforeEach(() => {
    store.getState().setFileData({
      fileName: 'test.csv',
      sheetNames: ['Sheet1'],
      sheets: { Sheet1: mockSheet },
    });
  });

  it('sets a column width', () => {
    store.getState().setColumnWidth('Sheet1', 0, 200);
    expect(store.getState().sheets['Sheet1'].colWidths[0]).toBe(200);
  });

  it('enforces minimum 30px width', () => {
    store.getState().setColumnWidth('Sheet1', 0, 10);
    expect(store.getState().sheets['Sheet1'].colWidths[0]).toBe(30);
  });

  it('extends array if column index is beyond current length', () => {
    store.getState().setColumnWidth('Sheet1', 10, 150);
    const widths = store.getState().sheets['Sheet1'].colWidths;
    expect(widths[10]).toBe(150);
    expect(widths.length).toBe(11);
  });

  it('does nothing for non-existent sheet', () => {
    store.getState().setColumnWidth('NoSheet', 0, 200);
    expect(store.getState().sheets['NoSheet']).toBeUndefined();
  });
});

describe('ViewerStore — setRowHeight', () => {
  beforeEach(() => {
    store.getState().setFileData({
      fileName: 'test.csv',
      sheetNames: ['Sheet1'],
      sheets: { Sheet1: mockSheet },
    });
  });

  it('sets a row height', () => {
    store.getState().setRowHeight('Sheet1', 0, 50);
    expect(store.getState().sheets['Sheet1'].rowHeights?.[0]).toBe(50);
  });

  it('enforces minimum 20px height', () => {
    store.getState().setRowHeight('Sheet1', 0, 5);
    expect(store.getState().sheets['Sheet1'].rowHeights?.[0]).toBe(20);
  });

  it('extends array if row index is beyond current length', () => {
    store.getState().setRowHeight('Sheet1', 5, 40);
    const heights = store.getState().sheets['Sheet1'].rowHeights;
    expect(heights?.[5]).toBe(40);
    expect(heights?.length).toBe(6);
  });

  it('does nothing for non-existent sheet', () => {
    store.getState().setRowHeight('NoSheet', 0, 50);
    expect(store.getState().sheets['NoSheet']).toBeUndefined();
  });

  it('preserves existing widths when setting heights', () => {
    store.getState().setColumnWidth('Sheet1', 0, 200);
    store.getState().setRowHeight('Sheet1', 0, 50);
    expect(store.getState().sheets['Sheet1'].colWidths[0]).toBe(200);
    expect(store.getState().sheets['Sheet1'].rowHeights?.[0]).toBe(50);
  });
});

// =============================================
// setCellStyle
// =============================================
describe('ViewerStore — setCellStyle', () => {
  beforeEach(() => {
    store.getState().setFileData({
      fileName: 'test.csv',
      sheetNames: ['Sheet1'],
      sheets: { Sheet1: mockSheet },
    });
  });

  it('sets a new style on a cell', () => {
    store.getState().setCellStyle('Sheet1', 0, 0, { bgColor: '#ff0000' });
    const styles = store.getState().sheets['Sheet1'].styles;
    expect(styles?.['0,0']).toEqual({ bgColor: '#ff0000' });
  });

  it('merges with existing style (partial update)', () => {
    store.getState().setCellStyle('Sheet1', 0, 0, { bgColor: '#ff0000' });
    store.getState().setCellStyle('Sheet1', 0, 0, { bold: true });
    const styles = store.getState().sheets['Sheet1'].styles;
    expect(styles?.['0,0']).toEqual({ bgColor: '#ff0000', bold: true });
  });

  it('clears style when passed null', () => {
    store.getState().setCellStyle('Sheet1', 0, 0, { bgColor: '#ff0000' });
    store.getState().setCellStyle('Sheet1', 0, 0, null);
    const styles = store.getState().sheets['Sheet1'].styles;
    expect(styles?.['0,0']).toBeUndefined();
  });

  it('multiple cells have independent styles', () => {
    store.getState().setCellStyle('Sheet1', 0, 0, { bgColor: '#f00' });
    store.getState().setCellStyle('Sheet1', 1, 1, { fontColor: '#0f0' });
    const styles = store.getState().sheets['Sheet1'].styles;
    expect(styles?.['0,0']).toEqual({ bgColor: '#f00' });
    expect(styles?.['1,1']).toEqual({ fontColor: '#0f0' });
  });

  it('styles persist after cell value changes', () => {
    store.getState().setCellStyle('Sheet1', 0, 0, { bold: true });
    store.getState().setCellValue('Sheet1', 0, 0, 'new value');
    expect(store.getState().sheets['Sheet1'].styles?.['0,0']).toEqual({ bold: true });
    expect(store.getState().sheets['Sheet1'].data[0][0]).toBe('new value');
  });

  it('does nothing for non-existent sheet', () => {
    store.getState().setCellStyle('NonExistent', 0, 0, { bgColor: '#f00' });
    expect(store.getState().sheets['NonExistent']).toBeUndefined();
  });
});

// =============================================
// getCurrentSheetData
// =============================================
describe('ViewerStore — getCurrentSheetData', () => {
  it('returns null when no active sheet', () => {
    expect(store.getState().getCurrentSheetData()).toBeNull();
  });

  it('returns sheet data for the active sheet', () => {
    store.getState().setFileData({
      fileName: 'test.csv',
      sheetNames: ['Sheet1'],
      sheets: { Sheet1: mockSheet },
    });
    expect(store.getState().getCurrentSheetData()).toEqual(mockSheet);
  });
});

// =============================================
// Reset
// =============================================
describe('ViewerStore — reset', () => {
  it('restores all state to defaults', () => {
    store.getState().setFileData({
      fileName: 'test.csv',
      sheetNames: ['Sheet1'],
      sheets: { Sheet1: mockSheet },
    });
    store.getState().setActiveCell(1, 1);
    store.getState().toggleChartPanel();
    store.getState().setCopiedRange({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 });

    store.getState().reset();

    const s = store.getState();
    expect(s.fileName).toBeNull();
    expect(s.sheetNames).toEqual([]);
    expect(s.sheets).toEqual({});
    expect(s.activeSheet).toBeNull();
    expect(s.activeCell).toBeNull();
    expect(s.showChartPanel).toBe(false);
    expect(s.copiedRange).toBeNull();
    expect(s.selections).toEqual({});
  });
});

// =============================================
// Zoom
// =============================================
describe('ViewerStore — Zoom', () => {
  it('starts at 100% with the default levels and bounds', () => {
    const s = store.getState();
    expect(s.zoom).toBe(1);
    expect(s.minZoom).toBe(0.25);
    expect(s.maxZoom).toBe(4);
    expect(s.zoomLevels).toEqual([0.5, 0.75, 0.9, 1, 1.25, 1.5, 2]);
  });

  it('setZoom clamps to the current bounds', () => {
    store.getState().setZoom(0.75);
    expect(store.getState().zoom).toBe(0.75);

    store.getState().setZoom(99);
    expect(store.getState().zoom).toBe(4);

    store.getState().setZoom(0.001);
    expect(store.getState().zoom).toBe(0.25);
  });

  it('zoomIn / zoomOut walk the level list', () => {
    store.getState().zoomIn();
    expect(store.getState().zoom).toBe(1.25);

    store.getState().zoomOut();
    expect(store.getState().zoom).toBe(1);

    store.getState().zoomOut();
    expect(store.getState().zoom).toBe(0.9);
  });

  it('zoomIn at the ceiling is a no-op', () => {
    store.getState().setZoom(4);
    store.getState().zoomIn();
    expect(store.getState().zoom).toBe(4);
  });

  it('stepping stays within the levels the picker offers', () => {
    // 200% is the top of the default list; zoomIn must not run on to maxZoom.
    store.getState().setZoom(2);
    store.getState().zoomIn();
    expect(store.getState().zoom).toBe(2);

    store.getState().setZoom(0.5);
    store.getState().zoomOut();
    expect(store.getState().zoom).toBe(0.5);
  });

  it('setZoomConfig re-clamps a zoom left outside the new bounds', () => {
    store.getState().setZoom(2);
    store.getState().setZoomConfig({ min: 0.5, max: 1.5 });

    const s = store.getState();
    expect(s.zoom).toBe(1.5);
    expect(s.minZoom).toBe(0.5);
    expect(s.maxZoom).toBe(1.5);
  });

  it('setZoomConfig leaves unspecified settings untouched', () => {
    store.getState().setZoomConfig({ levels: [1, 2] });

    const s = store.getState();
    expect(s.zoomLevels).toEqual([1, 2]);
    expect(s.minZoom).toBe(0.25);
    expect(s.maxZoom).toBe(4);
  });

  it('setZoomConfig ignores a re-set of identical config', () => {
    store.getState().setZoomConfig({ levels: [1, 2], min: 0.5, max: 2 });
    const after = store.getState();

    // A fresh array with the same values, as an inline prop would be.
    store.getState().setZoomConfig({ levels: [1, 2], min: 0.5, max: 2 });

    expect(store.getState().zoomLevels).toBe(after.zoomLevels);
  });

  it('steps through a custom level list', () => {
    store.getState().setZoomConfig({ levels: [1, 3] });
    store.getState().zoomIn();
    expect(store.getState().zoom).toBe(3);
  });
});

// =============================================
// Store Isolation (multiple instances)
// =============================================
describe('ViewerStore — Instance isolation', () => {
  it('two stores are fully independent', () => {
    const store2 = createViewerStore();

    store.getState().setFileData({
      fileName: 'file1.csv',
      sheetNames: ['S1'],
      sheets: { S1: mockSheet },
    });

    expect(store.getState().fileName).toBe('file1.csv');
    expect(store2.getState().fileName).toBeNull();
  });
});
