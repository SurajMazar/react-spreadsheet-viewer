import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, screen, act } from '@testing-library/react';
import React, { createRef } from 'react';
import { SheetViewer } from '../index';
import Cell from '../components/Grid/Cell';
import { withPinned } from '../components/Grid/VirtualGrid';
import type { SheetViewerHandle, WorkbookInput, SheetViewerFormulaFunction } from '../types';

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// A cleaned P&L sheet in the shape the review screen keeps today: header row,
// source positions in cell metadata, a COA lookup formula per row.
const workbook: WorkbookInput = {
  fileName: 'pnl.xlsx',
  sheets: [
    {
      name: 'Cleaned',
      hiddenCols: [3],
      rows: [
        [{ value: 'Label', style: { bold: true } }, { value: 'FY24' }, { value: 'COA' }, { value: 'internal' }],
        [
          { value: 'Revenue', meta: { position: ['A', 27, 'H', 27], page: 1 } },
          { value: 1234.5, format: '#,##0.00' },
          { formula: '=LOOKUP(A2,"label","category")' },
          'x',
        ],
        [
          { value: 'Rent', meta: { position: ['A', 28, 'H', 28], page: 1, low_confidence: true } },
          { value: -200, format: '0.00' },
          { formula: '=LOOKUP(A3,"label","category")' },
          'y',
        ],
      ],
    },
  ],
};

const coa: Record<string, string> = { Revenue: 'Income', Rent: 'Operating expense' };
const customFunctions: Record<string, SheetViewerFormulaFunction> = {
  LOOKUP: (value) => coa[String(value)] ?? '',
};

async function renderWorkbook(props: Partial<React.ComponentProps<typeof SheetViewer>> = {}) {
  const ref = createRef<SheetViewerHandle>();
  const utils = render(
    <SheetViewer ref={ref} data={workbook} customFunctions={customFunctions} height={600} width={800} {...props} />,
  );
  await waitFor(() => expect(ref.current?.getSheetNames()).toEqual(['Cleaned']));
  return { ref, ...utils };
}

describe('SheetViewer — data prop', () => {
  it('loads a workbook from data, with custom formulas evaluated', async () => {
    const { ref } = await renderWorkbook();
    expect(ref.current!.getFileName()).toBe('pnl.xlsx');
    expect(ref.current!.getCellRangeData('C2:C3')).toEqual([['Income'], ['Operating expense']]);
    expect(screen.queryByText('No source provided')).toBeNull();
  });

  it('keeps metadata, formats and hidden columns on the sheet', async () => {
    const { ref } = await renderWorkbook();
    expect(ref.current!.getCellMeta('A3')).toEqual({ position: ['A', 28, 'H', 28], page: 1, low_confidence: true });
    expect(ref.current!.getCellMeta('B2')).toBeNull();
    const sheet = ref.current!.getSheetData()!;
    expect(sheet.formats?.['1,1']).toBe('#,##0.00');
    expect(sheet.hiddenCols).toEqual([3]);
  });

  it('takes precedence over source', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await renderWorkbook({ source: 'https://example.com/file.xlsx' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reloads when a new data object is passed', async () => {
    const { ref, rerender } = await renderWorkbook();
    rerender(
      <SheetViewer
        ref={ref}
        data={{ sheets: [{ name: 'Other', rows: [['a']] }] }}
        customFunctions={customFunctions}
        height={600}
        width={800}
      />,
    );
    await waitFor(() => expect(ref.current!.getSheetNames()).toEqual(['Other']));
  });

  it('recalculates when customFunctions change', async () => {
    const { ref, rerender } = await renderWorkbook();
    rerender(
      <SheetViewer ref={ref} data={workbook} customFunctions={{ LOOKUP: () => 'Other' }} height={600} width={800} />,
    );
    await waitFor(() => expect(ref.current!.getCellRangeData('C2')).toEqual([['Other']]));
  });
});

describe('SheetViewer — programmatic updates', () => {
  it('setCellValue updates the value and dependent formulas, without onCellChange', async () => {
    const onCellChange = vi.fn();
    const { ref } = await renderWorkbook({ onCellChange });
    act(() => ref.current!.setCellValue('A2', 'Rent'));
    expect(ref.current!.getCellRangeData('C2')).toEqual([['Operating expense']]);
    expect(onCellChange).not.toHaveBeenCalled();
  });

  it('setCellValue with "=" sets a formula', async () => {
    const { ref } = await renderWorkbook();
    act(() => ref.current!.setCellValue('E2', '=B2*2'));
    expect(ref.current!.getCellRangeData('E2')).toEqual([[2469]]);
  });

  it('setCellStyle styles a whole range (error / low-confidence flags)', async () => {
    const { ref } = await renderWorkbook();
    act(() => ref.current!.setCellStyle('A2:B2', { borders: { bottom: '2px solid #FF0000' } }));
    const styles = ref.current!.getSheetData()!.styles!;
    expect(styles['1,0']).toEqual({ borders: { bottom: '2px solid #FF0000' } });
    expect(styles['1,1']).toEqual({ borders: { bottom: '2px solid #FF0000' } });
    act(() => ref.current!.setCellStyle('A2', null));
    expect(ref.current!.getSheetData()!.styles!['1,0']).toBeUndefined();
  });

  it('updateCell applies value, style and metadata together', async () => {
    const { ref } = await renderWorkbook();
    act(() =>
      ref.current!.updateCell('B3', { value: -250, style: { bgColor: '#FFFF00' }, meta: { reviewed: true } }),
    );
    expect(ref.current!.getCellRangeData('B3')).toEqual([[-250]]);
    expect(ref.current!.getCellMeta('B3')).toEqual({ reviewed: true });
    expect(ref.current!.getSheetData()!.styles!['2,1']).toEqual({ bgColor: '#FFFF00' });
  });

  it('getCellRows serialises the sheet for saving', async () => {
    const { ref } = await renderWorkbook();
    const rows = ref.current!.getCellRows();
    expect(rows).toHaveLength(3);
    expect(rows[1][0]).toEqual({ value: 'Revenue', meta: { position: ['A', 27, 'H', 27], page: 1 } });
    expect(rows[1][1]).toEqual({ value: 1234.5, format: '#,##0.00' });
    expect(rows[1][2]).toEqual({ value: 'Income', formula: '=LOOKUP(A2,"label","category")' });
  });

  it('recalculate picks up data a custom function reads later', async () => {
    const table: Record<string, string> = {};
    const lateLookup: Record<string, SheetViewerFormulaFunction> = { LOOKUP: (v) => table[String(v)] ?? '' };
    const { ref } = await renderWorkbook({ customFunctions: lateLookup });
    expect(ref.current!.getCellRangeData('C2')).toEqual([['']]);
    table.Revenue = 'Income';
    act(() => ref.current!.recalculate());
    expect(ref.current!.getCellRangeData('C2')).toEqual([['Income']]);
  });
});

describe('Cell rendering', () => {
  const baseProps = {
    rowIndex: 0,
    columnIndex: 0,
    ranges: [],
    activeCell: null,
    onCellClick: () => undefined,
    onCellMouseDown: () => undefined,
    onCellMouseEnter: () => undefined,
    style: {},
  };

  it('displays the value through its number format', () => {
    const { container } = render(<Cell {...baseProps} value={1234.5} format="#,##0.00" />);
    expect(container.textContent).toBe('1,234.50');
  });

  it('moves the text for textAlign (the cell is a flex row)', () => {
    const { container } = render(<Cell {...baseProps} value={5} cellStyle={{ textAlign: 'right' }} />);
    expect((container.querySelector('.sv-cell') as HTMLElement).style.justifyContent).toBe('flex-end');
  });

  it('draws cell borders', () => {
    const { container } = render(
      <Cell {...baseProps} value="x" cellStyle={{ borders: { top: '2px solid #FF0000', left: '1px solid #FFFF00' } }} />,
    );
    const el = container.querySelector('.sv-cell') as HTMLElement;
    expect(el.style.borderTop).toBe('2px solid rgb(255, 0, 0)');
    expect(el.style.borderLeft).toBe('1px solid rgb(255, 255, 0)');
  });
});

describe('frozen panes', () => {
  const range = { startIndex: 40, endIndex: 45, overscan: 0, count: 100 };

  it('keeps the frozen indexes in the rendered range wherever the grid is scrolled', () => {
    expect(withPinned(range, 2)).toEqual([0, 1, 40, 41, 42, 43, 44, 45]);
  });

  it('leaves the range alone without frozen panes', () => {
    expect(withPinned(range, 0)).toEqual([40, 41, 42, 43, 44, 45]);
  });

  it('does not duplicate indexes already visible, or pin past the end', () => {
    expect(withPinned({ startIndex: 0, endIndex: 3, overscan: 0, count: 4 }, 6)).toEqual([0, 1, 2, 3]);
  });

  it('frozen rows and columns pass through the data prop', async () => {
    const ref = createRef<SheetViewerHandle>();
    render(
      <SheetViewer
        ref={ref}
        data={{ sheets: [{ name: 'S', rows: [['a', 'b'], ['c', 'd']], frozenRows: 2, frozenCols: 1 }] }}
        height={600}
        width={800}
      />,
    );
    await waitFor(() => expect(ref.current?.getSheetNames()).toEqual(['S']));
    expect(ref.current!.getSheetData()).toMatchObject({ frozenRows: 2, frozenCols: 1 });
  });
});
