import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Cell from '../Cell';
import type { CellProps } from '../Cell';
import type { CellRange, ActiveCell, CellStyle } from '../../../types';

const baseProps: CellProps = {
  rowIndex: 0,
  columnIndex: 0,
  value: 'Hello',
  ranges: [],
  activeCell: null,
  onCellClick: vi.fn(),
  onCellMouseDown: vi.fn(),
  onCellMouseEnter: vi.fn(),
  style: { position: 'absolute' as const, top: 0, left: 0, width: 100, height: 26 },
};

function renderCell(overrides: Partial<CellProps> = {}) {
  const props = { ...baseProps, ...overrides };
  return render(<Cell {...props} />);
}

// =============================================
// Rendering
// =============================================
describe('Cell — Rendering', () => {
  it('renders a string value', () => {
    renderCell({ value: 'Hello World' });
    expect(screen.getByText('Hello World')).toBeTruthy();
  });

  it('renders a numeric value as string', () => {
    renderCell({ value: 42 });
    expect(screen.getByText('42')).toBeTruthy();
  });

  it('renders a boolean value as string', () => {
    renderCell({ value: true });
    expect(screen.getByText('true')).toBeTruthy();
  });

  it('renders empty string for null value', () => {
    const { container } = renderCell({ value: null });
    const span = container.querySelector('.sv-cell-text');
    expect(span?.textContent).toBe('');
  });

  it('renders empty string for undefined value', () => {
    const { container } = renderCell({ value: undefined });
    const span = container.querySelector('.sv-cell-text');
    expect(span?.textContent).toBe('');
  });

  it('sets title attribute to the cell value', () => {
    const { container } = renderCell({ value: 'Tooltip text' });
    expect(container.firstElementChild?.getAttribute('title')).toBe('Tooltip text');
  });

  it('sets title to empty string for null value', () => {
    const { container } = renderCell({ value: null });
    expect(container.firstElementChild?.getAttribute('title')).toBe('');
  });
});

// =============================================
// CSS Classes — Selection Behavior
// =============================================
describe('Cell — Selection classes (Google Sheets behavior)', () => {
  it('applies only sv-cell when no selection', () => {
    const { container } = renderCell();
    expect(container.firstElementChild?.className).toBe('sv-cell');
  });

  it('applies sv-cell-active outline for clicked cell without a range', () => {
    const { container } = renderCell({
      activeCell: { row: 0, col: 0 },
    });
    expect(container.firstElementChild?.classList.contains('sv-cell-active')).toBe(true);
    expect(container.firstElementChild?.classList.contains('sv-cell-in-range')).toBe(false);
    expect(container.firstElementChild?.classList.contains('sv-cell-active-in-range')).toBe(false);
  });

  it('applies sv-cell-in-range for non-active cells within a range', () => {
    const range: CellRange = { startRow: 0, startCol: 0, endRow: 2, endCol: 2 };
    const { container } = renderCell({
      rowIndex: 1,
      columnIndex: 1,
      ranges: [range],
      activeCell: { row: 0, col: 0 },
    });
    expect(container.firstElementChild?.classList.contains('sv-cell-in-range')).toBe(true);
    expect(container.firstElementChild?.classList.contains('sv-cell-active')).toBe(false);
    expect(container.firstElementChild?.classList.contains('sv-cell-active-in-range')).toBe(false);
  });

  it('applies sv-cell-active-in-range for active cell WITHIN a range (mutually exclusive with sv-cell-active)', () => {
    const range: CellRange = { startRow: 0, startCol: 0, endRow: 2, endCol: 2 };
    const { container } = renderCell({
      rowIndex: 0,
      columnIndex: 0,
      ranges: [range],
      activeCell: { row: 0, col: 0 },
    });
    expect(container.firstElementChild?.classList.contains('sv-cell-active-in-range')).toBe(true);
    expect(container.firstElementChild?.classList.contains('sv-cell-active')).toBe(false);
    expect(container.firstElementChild?.classList.contains('sv-cell-in-range')).toBe(false);
  });

  it('applies sv-cell-active outline when active cell is OUTSIDE the range', () => {
    const range: CellRange = { startRow: 2, startCol: 2, endRow: 4, endCol: 4 };
    const { container } = renderCell({
      rowIndex: 0,
      columnIndex: 0,
      ranges: [range],
      activeCell: { row: 0, col: 0 },
    });
    expect(container.firstElementChild?.classList.contains('sv-cell-active')).toBe(true);
    expect(container.firstElementChild?.classList.contains('sv-cell-active-in-range')).toBe(false);
  });

  it('does not apply any selection class for cell outside range and not active', () => {
    const range: CellRange = { startRow: 5, startCol: 5, endRow: 8, endCol: 8 };
    const { container } = renderCell({
      rowIndex: 0,
      columnIndex: 0,
      ranges: [range],
      activeCell: { row: 5, col: 5 },
    });
    const cl = container.firstElementChild?.classList;
    expect(cl?.contains('sv-cell-active')).toBe(false);
    expect(cl?.contains('sv-cell-in-range')).toBe(false);
    expect(cl?.contains('sv-cell-active-in-range')).toBe(false);
  });
});

// =============================================
// CSS Classes — Merged Cells
// =============================================
describe('Cell — Merged cells', () => {
  it('applies sv-cell-merged class when isMerged is true', () => {
    const { container } = renderCell({ isMerged: true });
    expect(container.firstElementChild?.classList.contains('sv-cell-merged')).toBe(true);
  });

  it('applies z-index 2 for merged cells', () => {
    const { container } = renderCell({ isMerged: true });
    expect((container.firstElementChild as HTMLElement).style.zIndex).toBe('2');
  });

  it('does not apply sv-cell-merged when isMerged is false/undefined', () => {
    const { container } = renderCell();
    expect(container.firstElementChild?.classList.contains('sv-cell-merged')).toBe(false);
  });
});

// =============================================
// Cell Styling (from CellStyle)
// =============================================
describe('Cell — CellStyle formatting', () => {
  it('applies background color', () => {
    const cellStyle: CellStyle = { bgColor: '#ff0000' };
    const { container } = renderCell({ cellStyle });
    expect((container.firstElementChild as HTMLElement).style.backgroundColor).toBe('rgb(255, 0, 0)');
  });

  it('applies font color', () => {
    const cellStyle: CellStyle = { fontColor: '#0000ff' };
    const { container } = renderCell({ cellStyle });
    expect((container.firstElementChild as HTMLElement).style.color).toBe('rgb(0, 0, 255)');
  });

  it('applies bold', () => {
    const cellStyle: CellStyle = { bold: true };
    const { container } = renderCell({ cellStyle });
    expect((container.firstElementChild as HTMLElement).style.fontWeight).toBe('700');
  });

  it('applies italic', () => {
    const cellStyle: CellStyle = { italic: true };
    const { container } = renderCell({ cellStyle });
    expect((container.firstElementChild as HTMLElement).style.fontStyle).toBe('italic');
  });

  it('applies font size in pt, scaled by the grid zoom', () => {
    const cellStyle: CellStyle = { fontSize: 14 };
    const { container } = renderCell({ cellStyle });
    expect((container.firstElementChild as HTMLElement).style.fontSize).toBe(
      'calc(14pt * var(--sv-zoom))'
    );
  });

  it('applies text alignment', () => {
    const cellStyle: CellStyle = { textAlign: 'center' };
    const { container } = renderCell({ cellStyle });
    expect((container.firstElementChild as HTMLElement).style.textAlign).toBe('center');
  });

  it('applies multiple styles together', () => {
    const cellStyle: CellStyle = { bgColor: '#eee', bold: true, textAlign: 'right' };
    const { container } = renderCell({ cellStyle });
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.fontWeight).toBe('700');
    expect(el.style.textAlign).toBe('right');
  });
});

// =============================================
// Range Border Styles
// =============================================
describe('Cell — Range border rendering', () => {
  const range: CellRange = { startRow: 1, startCol: 1, endRow: 3, endCol: 3 };

  it('applies top border for cell at top edge of range', () => {
    const { container } = renderCell({
      rowIndex: 1, columnIndex: 2, ranges: [range],
    });
    expect((container.firstElementChild as HTMLElement).style.borderTop).toContain('2px solid');
  });

  it('applies bottom border for cell at bottom edge of range', () => {
    const { container } = renderCell({
      rowIndex: 3, columnIndex: 2, ranges: [range],
    });
    expect((container.firstElementChild as HTMLElement).style.borderBottom).toContain('2px solid');
  });

  it('applies left border for cell at left edge of range', () => {
    const { container } = renderCell({
      rowIndex: 2, columnIndex: 1, ranges: [range],
    });
    expect((container.firstElementChild as HTMLElement).style.borderLeft).toContain('2px solid');
  });

  it('applies right border for cell at right edge of range', () => {
    const { container } = renderCell({
      rowIndex: 2, columnIndex: 3, ranges: [range],
    });
    expect((container.firstElementChild as HTMLElement).style.borderRight).toContain('2px solid');
  });

  it('does not apply border for interior cell of range', () => {
    const { container } = renderCell({
      rowIndex: 2, columnIndex: 2, ranges: [range],
    });
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.borderTop).toBe('');
    expect(el.style.borderBottom).toBe('');
    expect(el.style.borderLeft).toBe('');
    expect(el.style.borderRight).toBe('');
  });
});

// =============================================
// Event Handlers
// =============================================
describe('Cell — Event handlers', () => {
  it('calls onCellClick with row and col on click', () => {
    const onCellClick = vi.fn();
    const { container } = renderCell({ rowIndex: 3, columnIndex: 5, onCellClick });
    fireEvent.click(container.firstElementChild!);
    expect(onCellClick).toHaveBeenCalledWith(3, 5);
  });

  it('calls onCellMouseDown with event, row, and col on mouseDown', () => {
    const onCellMouseDown = vi.fn();
    const { container } = renderCell({ rowIndex: 1, columnIndex: 2, onCellMouseDown });
    fireEvent.mouseDown(container.firstElementChild!);
    expect(onCellMouseDown).toHaveBeenCalledTimes(1);
    expect(onCellMouseDown.mock.calls[0][1]).toBe(1);
    expect(onCellMouseDown.mock.calls[0][2]).toBe(2);
  });

  it('calls onCellMouseEnter with event, row, and col on mouseEnter', () => {
    const onCellMouseEnter = vi.fn();
    const { container } = renderCell({ rowIndex: 0, columnIndex: 4, onCellMouseEnter });
    fireEvent.mouseEnter(container.firstElementChild!);
    expect(onCellMouseEnter).toHaveBeenCalledTimes(1);
    expect(onCellMouseEnter.mock.calls[0][1]).toBe(0);
    expect(onCellMouseEnter.mock.calls[0][2]).toBe(4);
  });

  it('calls onCellDoubleClick with row and col on double click', () => {
    const onCellDoubleClick = vi.fn();
    const { container } = renderCell({ rowIndex: 2, columnIndex: 3, onCellDoubleClick });
    fireEvent.doubleClick(container.firstElementChild!);
    expect(onCellDoubleClick).toHaveBeenCalledWith(2, 3);
  });

  it('does not throw when onCellDoubleClick is undefined', () => {
    const { container } = renderCell({ onCellDoubleClick: undefined });
    expect(() => fireEvent.doubleClick(container.firstElementChild!)).not.toThrow();
  });
});

// =============================================
// Text Wrapping
// =============================================
describe('Cell — Text wrapping', () => {
  it('applies sv-cell-text-wrap class when wrapText is true', () => {
    const { container } = renderCell({ cellStyle: { wrapText: true } });
    const textSpan = container.querySelector('.sv-cell-text');
    expect(textSpan?.classList.contains('sv-cell-text-wrap')).toBe(true);
  });

  it('does not apply wrap class when wrapText is false', () => {
    const { container } = renderCell({ cellStyle: { wrapText: false } });
    const textSpan = container.querySelector('.sv-cell-text');
    expect(textSpan?.classList.contains('sv-cell-text-wrap')).toBe(false);
  });

  it('does not apply wrap class when cellStyle is undefined', () => {
    const { container } = renderCell({ cellStyle: undefined });
    const textSpan = container.querySelector('.sv-cell-text');
    expect(textSpan?.classList.contains('sv-cell-text-wrap')).toBe(false);
  });

  it('applies wrap alongside other styles', () => {
    const { container } = renderCell({
      cellStyle: { wrapText: true, bold: true, bgColor: '#ff0000' },
    });
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.fontWeight).toBe('700');
    expect(el.style.backgroundColor).toBe('rgb(255, 0, 0)');
    const textSpan = container.querySelector('.sv-cell-text');
    expect(textSpan?.classList.contains('sv-cell-text-wrap')).toBe(true);
  });
});

// =============================================
// Cell Comments
// =============================================
describe('Cell — Comment indicator', () => {
  it('renders comment indicator when comment is provided', () => {
    const { container } = renderCell({
      comment: { text: 'This is a note', author: 'Alice' },
    });
    const indicator = container.querySelector('.sv-comment-indicator');
    expect(indicator).not.toBeNull();
  });

  it('does not render comment indicator when no comment', () => {
    const { container } = renderCell();
    const indicator = container.querySelector('.sv-comment-indicator');
    expect(indicator).toBeNull();
  });

  it('comment indicator has title with author and text', () => {
    const { container } = renderCell({
      comment: { text: 'A note', author: 'Bob' },
    });
    const indicator = container.querySelector('.sv-comment-indicator') as HTMLElement;
    expect(indicator.title).toBe('Bob: A note');
  });

  it('comment indicator title omits author when not set', () => {
    const { container } = renderCell({
      comment: { text: 'Just a note' },
    });
    const indicator = container.querySelector('.sv-comment-indicator') as HTMLElement;
    expect(indicator.title).toBe('Just a note');
  });

  it('renders both comment indicator and cell text', () => {
    const { container } = renderCell({
      value: 'Hello',
      comment: { text: 'note' },
    });
    expect(container.querySelector('.sv-comment-indicator')).not.toBeNull();
    expect(screen.getByText('Hello')).toBeTruthy();
  });
});
