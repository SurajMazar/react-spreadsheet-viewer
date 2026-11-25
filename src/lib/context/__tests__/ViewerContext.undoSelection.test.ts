import { describe, it, expect, beforeEach } from 'vitest';
import { type StoreApi } from 'zustand/vanilla';
import { createViewerStore } from '../ViewerContext';
import type { ViewerState, SheetData } from '../../types';

let store: StoreApi<ViewerState>;

const sheet = (): SheetData => ({
  data: [
    ['a', 'b', 'c'],
    ['d', 'e', 'f'],
    ['g', 'h', 'i'],
  ],
  rows: 3,
  cols: 3,
  merges: [],
  colWidths: [],
});

beforeEach(() => {
  store = createViewerStore();
  store.getState().setFileData({ fileName: 'x.xlsx', sheetNames: ['S', 'T'], sheets: { S: sheet(), T: sheet() } });
  store.getState().setActiveSheet('S');
});

const state = () => store.getState();
const selection = (name = 'S') => state().selections[name];

describe('undo and redo select the cells they change', () => {
  it('undo makes the changed cell active and selected, wherever the user had moved to', () => {
    state().setCellValue('S', 1, 2, 'X');
    state().pushUndo({ sheetName: 'S', cellChanges: [{ row: 1, col: 2, oldValue: 'f', newValue: 'X' }], styleChanges: [] });
    // The user moves on after the edit.
    state().setActiveCell(2, 0);
    state().setSelectionRanges('S', [{ startRow: 2, startCol: 0, endRow: 2, endCol: 0 }], 'A3');

    state().undo();

    expect(state().sheets.S.data[1][2]).toBe('f');
    expect(state().activeCell).toEqual({ row: 1, col: 2 });
    expect(selection().ranges).toEqual([{ startRow: 1, startCol: 2, endRow: 1, endCol: 2 }]);
    expect(selection().rangeInput).toBe('C2');
  });

  it('redo selects the same cell again', () => {
    state().pushUndo({ sheetName: 'S', cellChanges: [{ row: 0, col: 1, oldValue: 'b', newValue: 'Y' }], styleChanges: [] });
    state().undo();
    state().setActiveCell(2, 2);

    state().redo();

    expect(state().sheets.S.data[0][1]).toBe('Y');
    expect(state().activeCell).toEqual({ row: 0, col: 1 });
    expect(selection().rangeInput).toBe('B1');
  });

  it('a multi-cell change selects the box around it, top-left cell active', () => {
    state().pushUndo({
      sheetName: 'S',
      cellChanges: [
        { row: 2, col: 2, oldValue: 'i', newValue: '1' },
        { row: 1, col: 1, oldValue: 'e', newValue: '2' },
      ],
      styleChanges: [{ row: 1, col: 2, oldStyle: undefined, newStyle: { bold: true } }],
    });

    state().undo();

    expect(state().activeCell).toEqual({ row: 1, col: 1 });
    expect(selection().ranges).toEqual([{ startRow: 1, startCol: 1, endRow: 2, endCol: 2 }]);
    expect(selection().rangeInput).toBe('B2:C3');
  });

  it('a style-only change is selected too', () => {
    state().pushUndo({
      sheetName: 'S',
      cellChanges: [],
      styleChanges: [{ row: 0, col: 0, oldStyle: undefined, newStyle: { italic: true } }],
    });
    state().undo();
    expect(state().activeCell).toEqual({ row: 0, col: 0 });
    expect(selection().rangeInput).toBe('A1');
  });

  it('switches to the sheet the change was on', () => {
    state().pushUndo({ sheetName: 'T', cellChanges: [{ row: 2, col: 1, oldValue: 'h', newValue: 'Z' }], styleChanges: [] });
    expect(state().activeSheet).toBe('S');

    state().undo();

    expect(state().activeSheet).toBe('T');
    expect(state().activeCell).toEqual({ row: 2, col: 1 });
    expect(selection('T').rangeInput).toBe('B3');
  });

  it('turns off a programmatic highlight, as a user selection does', () => {
    state().pushUndo({ sheetName: 'S', cellChanges: [{ row: 0, col: 0, oldValue: 'a', newValue: 'Q' }], styleChanges: [] });
    state().setProgrammaticHighlight(true);
    state().undo();
    expect(state().isProgrammaticHighlight).toBe(false);
  });

  it('with nothing to undo, leaves the selection alone', () => {
    state().setActiveCell(2, 2);
    state().undo();
    state().redo();
    expect(state().activeCell).toEqual({ row: 2, col: 2 });
  });
});
