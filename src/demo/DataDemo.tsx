import React, { useMemo, useRef, useState } from 'react';
import { SheetViewer } from '../lib';
import type { SheetCellInput, SheetViewerHandle, SheetViewerMode, WorkbookInput, SheetViewerFormulaFunction } from '../lib';

/**
 * Demo for the `data` prop: a cleaned P&L in the shape Docsumo's Excel review
 * screen keeps (frozen header rows and label column, COA lookups, number
 * formats, error / low-confidence borders, a hidden column, source positions
 * in cell metadata). Open with `?demo=data`.
 */

const COA: Record<string, string> = {
  Revenue: 'Income',
  'Cost of goods sold': 'Cost of sales',
  Salaries: 'Operating expense',
  Rent: 'Operating expense',
  Utilities: 'Operating expense',
  Depreciation: 'Non-cash expense',
  'Interest expense': 'Finance cost',
  'Income tax': 'Tax',
};
const LABELS = Object.keys(COA);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];

function buildWorkbook(readOnly: boolean): WorkbookInput {
  const title: SheetCellInput[] = [
    { value: 'Profit & Loss — FY2024 (cleaned)', style: { bold: true, fontSize: 13 }, colSpan: 4 },
  ];
  const header: SheetCellInput[] = [
    { value: 'Label', style: { bold: true, bgColor: '#F1F3F4' } },
    { value: 'COA category', style: { bold: true, bgColor: '#F1F3F4' } },
    { value: 'internal id', style: { bold: true, bgColor: '#F1F3F4' } },
    ...MONTHS.map((m) => ({ value: m, style: { bold: true, bgColor: '#F1F3F4', textAlign: 'right' as const } })),
    { value: 'Total', style: { bold: true, bgColor: '#F1F3F4', textAlign: 'right' as const } },
    { value: 'Period end', style: { bold: true, bgColor: '#F1F3F4' } },
    { value: 'Margin', style: { bold: true, bgColor: '#F1F3F4', textAlign: 'right' as const } },
  ];
  const rows: SheetCellInput[][] = [title, header];
  for (let i = 0; i < 60; i++) {
    const r = rows.length + 1; // 1-based sheet row
    const label = LABELS[i % LABELS.length];
    const flag = i === 3 ? '2px solid #FF0000' : i === 6 ? '2px solid #FFFF00' : undefined;
    rows.push([
      { value: label, meta: { position: ['A', 20 + i, 'H', 20 + i], page: 1 + Math.floor(i / 25) } },
      {
        formula: `=LOOKUP(A${r},"label","category")`,
        validation: { type: 'list', listItems: Array.from(new Set(Object.values(COA))) },
      },
      { value: `row-${i}` },
      ...MONTHS.map((_, m) => ({
        value: Math.round((1000 + i * 137 + m * 59) * (i % 5 === 1 ? -1 : 1) * 100) / 100,
        format: '#,##0.00',
        style: { textAlign: 'right' as const, ...(flag && m === 0 ? { borders: { top: flag, right: flag, bottom: flag, left: flag } } : {}) },
      })),
      { formula: `=SUM(D${r}:L${r})`, format: '#,##0.00', style: { bold: true, textAlign: 'right' as const } },
      { value: 45565 + i, format: 'dd/mm/yyyy' },
      { value: (i % 7) / 10 + 0.05, format: '0.0%', style: { textAlign: 'right' as const } },
    ]);
  }
  return {
    fileName: 'pnl-cleaned.xlsx',
    sheets: [
      {
        name: 'Cleaned',
        rows,
        frozenRows: 2,
        frozenCols: 1,
        hiddenCols: [2],
        readOnly,
        colWidths: [180, 150, 90, ...MONTHS.map(() => 100), 110, 100, 80],
      },
      { name: 'Raw Sheet', rows: [['Original file content goes here']] },
    ],
  };
}

export default function DataDemo() {
  const ref = useRef<SheetViewerHandle>(null);
  const [mode, setMode] = useState<SheetViewerMode>('edit');
  const [readOnly, setReadOnly] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const data = useMemo(() => buildWorkbook(readOnly), [readOnly]);
  const customFunctions = useMemo<Record<string, SheetViewerFormulaFunction>>(
    () => ({ LOOKUP: (value) => COA[String(value)] ?? '' }),
    []
  );
  const push = (line: string) => setLog((l) => [line, ...l].slice(0, 8));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', gap: 8, padding: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <strong>data prop demo</strong>
        <button onClick={() => setMode(mode === 'edit' ? 'view' : 'edit')}>mode: {mode}</button>
        <button onClick={() => setReadOnly(!readOnly)}>readOnly: {String(readOnly)}</button>
        <button onClick={() => ref.current?.setCellValue('A5', 'Revenue')}>setCellValue A5 = Revenue</button>
        <button onClick={() => ref.current?.setCellStyle('D8:F8', { borders: { bottom: '2px solid #FF0000' } })}>
          flag D8:F8
        </button>
        <button onClick={() => push(JSON.stringify(ref.current?.getCellMeta('A5')))}>getCellMeta A5</button>
        <button onClick={() => push(JSON.stringify(ref.current?.getCellRows()[4].slice(0, 2)))}>getCellRows row 5</button>
      </div>
      <div style={{ padding: '0 8px', fontSize: 12, color: '#555', minHeight: 18 }} data-testid="demo-log">
        {log.join('  |  ')}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <SheetViewer
          ref={ref}
          data={data}
          customFunctions={customFunctions}
          mode={mode}
          onCellChange={(sheet, row, col, value) => push(`onCellChange ${sheet}!R${row + 1}C${col + 1} = ${String(value)}`)}
        />
      </div>
    </div>
  );
}
