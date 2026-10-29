import { describe, it, expect, beforeEach } from 'vitest';
import { type StoreApi } from 'zustand/vanilla';
import { createViewerStore, getCellInputValue } from '../ViewerContext';
import type { ViewerState, SheetData } from '../../types';

let store: StoreApi<ViewerState>;

const base = (): SheetData => ({
  data: [[1, 2, null]],
  rows: 1,
  cols: 3,
  merges: [],
  colWidths: [],
  formulas: { '0,2': '=A1+B1' },
});

function load(sheet: SheetData = base()) {
  store.getState().setFileData({ fileName: 'x.xlsx', sheetNames: ['S'], sheets: { S: sheet } });
}

const sheetS = () => store.getState().sheets.S;

beforeEach(() => {
  store = createViewerStore();
});

describe('formulas in the store', () => {
  it('evaluates formulas on load', () => {
    load();
    expect(sheetS().data[0][2]).toBe(3);
  });

  it('recalculates dependants when a value changes', () => {
    load();
    store.getState().setCellValue('S', 0, 0, 10);
    expect(sheetS().data[0][2]).toBe(12);
  });

  it('stores a typed "=" value as a formula', () => {
    load();
    store.getState().setCellValue('S', 0, 1, '=A1*5');
    expect(sheetS().formulas?.['0,1']).toBe('=A1*5');
    expect(sheetS().data[0][1]).toBe(5);
    expect(sheetS().data[0][2]).toBe(6);
  });

  it('a plain value replaces a formula', () => {
    load();
    store.getState().setCellValue('S', 0, 2, 'manual');
    expect(sheetS().formulas?.['0,2']).toBeUndefined();
    expect(sheetS().data[0][2]).toBe('manual');
  });

  it('undo restores a formula from its text', () => {
    load();
    const s = store.getState();
    const oldValue = getCellInputValue(sheetS(), 0, 2);
    expect(oldValue).toBe('=A1+B1');
    s.setCellValue('S', 0, 2, 99);
    s.pushUndo({ sheetName: 'S', cellChanges: [{ row: 0, col: 2, oldValue, newValue: 99 }], styleChanges: [] });
    store.getState().undo();
    expect(sheetS().formulas?.['0,2']).toBe('=A1+B1');
    expect(sheetS().data[0][2]).toBe(3);
    store.getState().redo();
    expect(sheetS().formulas?.['0,2']).toBeUndefined();
    expect(sheetS().data[0][2]).toBe(99);
  });

  it('custom functions recalculate every sheet when set', () => {
    load({ ...base(), formulas: { '0,2': '=DOUBLE(B1)' } });
    expect(String(sheetS().data[0][2])).toMatch(/^#NAME\?/);
    store.getState().setCustomFunctions({ double: (v) => Number(v) * 2 });
    expect(sheetS().data[0][2]).toBe(4);
  });

  it('setting the same custom functions again is a no-op', () => {
    const fn = (v: unknown) => v as number;
    store.getState().setCustomFunctions({ F: fn as never });
    const before = store.getState().customFunctions;
    store.getState().setCustomFunctions({ f: fn as never });
    expect(store.getState().customFunctions).toBe(before);
  });

  it('custom functions set before load are used on load', () => {
    store.getState().setCustomFunctions({ TEN: () => 10 });
    load({ ...base(), formulas: { '0,2': '=TEN()' } });
    expect(sheetS().data[0][2]).toBe(10);
  });
});

describe('lastCellChange', () => {
  it('names the edited cell and increments', () => {
    load();
    store.getState().setCellValue('S', 0, 0, 5);
    expect(store.getState().lastCellChange).toMatchObject({ sheetName: 'S', row: 0, col: 0, seq: 1 });
    store.getState().setCellValue('S', 0, 1, 5);
    expect(store.getState().lastCellChange).toMatchObject({ row: 0, col: 1, seq: 2 });
  });

  it('is untouched by silent updates', () => {
    load();
    store.getState().setCellValue('S', 0, 0, 5, { silent: true });
    expect(store.getState().lastCellChange).toBeNull();
    expect(sheetS().data[0][2]).toBe(7);
  });

  it('follows undo and redo', () => {
    load();
    store.getState().pushUndo({ sheetName: 'S', cellChanges: [{ row: 0, col: 1, oldValue: 2, newValue: 9 }], styleChanges: [] });
    store.getState().undo();
    expect(store.getState().lastCellChange).toMatchObject({ row: 0, col: 1 });
  });

  it('is cleared by a new load and by reset', () => {
    load();
    store.getState().setCellValue('S', 0, 0, 5);
    load();
    expect(store.getState().lastCellChange).toBeNull();
    store.getState().setCellValue('S', 0, 0, 5);
    store.getState().reset();
    expect(store.getState().lastCellChange).toBeNull();
  });
});

describe('updateCell', () => {
  it('applies several properties at once', () => {
    load();
    store.getState().updateCell('S', 0, 0, {
      value: 4,
      format: '0.00',
      style: { fontColor: '#FF0000' },
      meta: { page: 2 },
      comment: { text: 'low confidence' },
    });
    const s = sheetS();
    expect(s.data[0][0]).toBe(4);
    expect(s.data[0][2]).toBe(6);
    expect(s.formats?.['0,0']).toBe('0.00');
    expect(s.styles?.['0,0']).toEqual({ fontColor: '#FF0000' });
    expect(s.meta?.['0,0']).toEqual({ page: 2 });
    expect(s.comments?.['0,0']).toEqual({ text: 'low confidence' });
  });

  it('merges styles and clears with null', () => {
    load();
    const s = store.getState();
    s.updateCell('S', 0, 0, { style: { bold: true } });
    store.getState().updateCell('S', 0, 0, { style: { borders: { top: '1px solid #FF0000' } } });
    expect(sheetS().styles?.['0,0']).toEqual({ bold: true, borders: { top: '1px solid #FF0000' } });
    store.getState().updateCell('S', 0, 0, { style: undefined });
    expect(sheetS().styles?.['0,0']).toBeUndefined();
  });

  it('sets a formula', () => {
    load();
    store.getState().updateCell('S', 0, 0, { formula: 'B1*10' });
    expect(sheetS().formulas?.['0,0']).toBe('=B1*10');
    expect(sheetS().data[0][0]).toBe(20);
  });

  it('only value changes count as a cell change', () => {
    load();
    store.getState().updateCell('S', 0, 0, { meta: { a: 1 } });
    expect(store.getState().lastCellChange).toBeNull();
    store.getState().updateCell('S', 0, 0, { value: 3 });
    expect(store.getState().lastCellChange).toMatchObject({ row: 0, col: 0 });
    store.getState().updateCell('S', 0, 1, { value: 3 }, { silent: true });
    expect(store.getState().lastCellChange).toMatchObject({ row: 0, col: 0 });
  });
});
