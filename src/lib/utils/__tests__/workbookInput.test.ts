import { describe, it, expect } from 'vitest';
import { buildSheetFromRows, buildWorkbook, sheetToCellRows } from '../workbookInput';

describe('buildSheetFromRows', () => {
  it('accepts plain values', () => {
    const s = buildSheetFromRows({ name: 'S', rows: [['a', 1], [true, null]] });
    expect(s.data).toEqual([['a', 1], [true, null]]);
    expect(s.rows).toBe(2);
    expect(s.cols).toBe(2);
  });

  it('collects per-cell formulas, formats, styles, meta, validations and comments', () => {
    const s = buildSheetFromRows({
      name: 'S',
      rows: [
        [
          { value: 10, format: '0.00', style: { bold: true }, meta: { position: ['A', 27, 'H', 27], page: 1 } },
          { formula: 'A1*2' },
          { value: 'Cash', validation: { type: 'list', listItems: ['Cash', 'Debt'] }, comment: { text: 'check' } },
        ],
      ],
    });
    expect(s.data[0]).toEqual([10, null, 'Cash']);
    expect(s.formats).toEqual({ '0,0': '0.00' });
    expect(s.styles).toEqual({ '0,0': { bold: true } });
    expect(s.meta).toEqual({ '0,0': { position: ['A', 27, 'H', 27], page: 1 } });
    expect(s.formulas).toEqual({ '0,1': '=A1*2' });
    expect(s.validations?.['0,2']).toEqual({ type: 'list', listItems: ['Cash', 'Debt'] });
    expect(s.comments?.['0,2']).toEqual({ text: 'check' });
  });

  it('turns colSpan/rowSpan into merges and grows the used range', () => {
    const s = buildSheetFromRows({ name: 'S', rows: [[{ value: 'Title', colSpan: 3, rowSpan: 2 }]] });
    expect(s.merges).toEqual([{ s: { r: 0, c: 0 }, e: { r: 1, c: 2 } }]);
    expect(s.rows).toBe(2);
    expect(s.cols).toBe(3);
  });

  it('fills sparse rows with nulls', () => {
    // eslint-disable-next-line no-sparse-arrays
    const s = buildSheetFromRows({ name: 'S', rows: [[, , 'x']] });
    expect(s.data[0]).toEqual([null, null, 'x']);
  });

  it('carries sheet-level options', () => {
    const s = buildSheetFromRows({
      name: 'S',
      rows: [['a']],
      colWidths: [120],
      rowHeights: [40],
      hiddenCols: [3],
      readOnly: true,
    });
    expect(s.colWidths).toEqual([120]);
    expect(s.rowHeights).toEqual([40]);
    expect(s.hiddenCols).toEqual([3]);
    expect(s.readOnly).toBe(true);
  });

  it('carries frozen rows and columns, whole numbers only', () => {
    const s = buildSheetFromRows({ name: 'S', rows: [['a']], frozenRows: 2, frozenCols: 1.7 });
    expect(s.frozenRows).toBe(2);
    expect(s.frozenCols).toBe(1);
    const none = buildSheetFromRows({ name: 'S', rows: [['a']], frozenRows: 0 });
    expect(none.frozenRows).toBeUndefined();
  });

  it('omits empty optional maps', () => {
    const s = buildSheetFromRows({ name: 'S', rows: [['a']] });
    expect(s.formulas).toBeUndefined();
    expect(s.meta).toBeUndefined();
    expect(s.styles).toBeUndefined();
  });
});

describe('buildWorkbook', () => {
  it('keeps sheet order and makes names unique', () => {
    const wb = buildWorkbook({ sheets: [{ name: 'A', rows: [] }, { name: 'A', rows: [] }, { name: '', rows: [] }] });
    expect(wb.sheetNames).toEqual(['A', 'A (2)', 'Sheet3']);
    expect(wb.fileName).toBe('workbook.xlsx');
  });

  it('uses the given file name', () => {
    expect(buildWorkbook({ fileName: 'doc.xlsx', sheets: [] }).fileName).toBe('doc.xlsx');
  });
});

describe('sheetToCellRows', () => {
  it('round-trips through buildSheetFromRows', () => {
    const rows = [
      [
        { value: 10, format: '0.00', style: { bold: true }, meta: { id: 1 } },
        { value: 20, formula: '=A1*2' },
      ],
      [{ value: 'Merged', colSpan: 2 }, {}],
    ];
    const s = buildSheetFromRows({ name: 'S', rows });
    expect(sheetToCellRows(s)).toEqual(rows);
  });

  it('returns an object for every cell in the used range', () => {
    const s = buildSheetFromRows({ name: 'S', rows: [['a'], [null, 'b']] });
    expect(sheetToCellRows(s)).toEqual([
      [{ value: 'a' }, {}],
      [{}, { value: 'b' }],
    ]);
  });
});
