import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, fireEvent, act } from '@testing-library/react';
import React, { createRef } from 'react';
import { SheetViewer } from '../index';
import type { SheetViewerHandle, WorkbookInput } from '../types';

// jsdom measures every element as 0x0, so the virtualizer would render no
// cells. Give elements a size so the grid draws its cells and the editor.
beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 800,
    bottom: 600,
    width: 800,
    height: 600,
    toJSON: () => ({}),
  } as DOMRect);
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(600);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const workbook: WorkbookInput = {
  fileName: 'grid.xlsx',
  sheets: [
    {
      name: 'Sheet1',
      rows: [
        ['Label', 'Amount', 'COA'],
        ['Revenue', 100, { value: 'Income', validation: { type: 'list', listItems: ['Income', 'Expense'] } }],
        ['Rent', 200, 'Expense'],
      ],
    },
  ],
};

async function renderEditable(props: Partial<React.ComponentProps<typeof SheetViewer>> = {}) {
  const ref = createRef<SheetViewerHandle>();
  const onCellChange = vi.fn();
  render(
    <SheetViewer
      ref={ref}
      data={workbook}
      mode="edit"
      height={600}
      width={800}
      onCellChange={onCellChange}
      {...props}
    />
  );
  await waitFor(() => expect(ref.current?.getSheetNames()).toEqual(['Sheet1']));
  await waitFor(() => expect(cellAt(0, 0)).not.toBeNull());
  return { ref, onCellChange };
}

const cellAt = (row: number, col: number) =>
  document.querySelector<HTMLElement>(`.sv-cell[data-cell="${row},${col}"]`);
const activeCell = () => document.querySelector<HTMLElement>('.sv-cell.sv-cell-active')?.dataset.cell;
const editor = () => document.querySelector<HTMLInputElement>('.sv-editable-cell-input');

function select(row: number, col: number) {
  const cell = cellAt(row, col)!;
  fireEvent.mouseDown(cell);
  fireEvent.mouseUp(cell);
  fireEvent.click(cell);
}

const press = (key: string, init: KeyboardEventInit = {}) =>
  act(() => {
    fireEvent.keyDown(document.activeElement ?? document.body, { key, ...init });
  });

describe('SheetViewer — editing from the keyboard', () => {
  it('Enter in the editor commits and moves to the cell below', async () => {
    const { ref, onCellChange } = await renderEditable();
    select(1, 1);
    fireEvent.doubleClick(cellAt(1, 1)!);
    const input = editor()!;
    fireEvent.change(input, { target: { value: '150' } });
    press('Enter');

    expect(editor()).toBeNull();
    expect(ref.current!.getCellRangeData('B2')).toEqual([['150']]);
    expect(onCellChange).toHaveBeenCalled();
    expect(activeCell()).toBe('2,1');
  });

  it('Shift+Enter commits and moves up; Tab moves right; Shift+Tab moves left', async () => {
    await renderEditable();
    select(2, 1);
    fireEvent.doubleClick(cellAt(2, 1)!);
    press('Enter', { shiftKey: true });
    expect(activeCell()).toBe('1,1');

    fireEvent.doubleClick(cellAt(1, 1)!);
    press('Tab');
    expect(activeCell()).toBe('1,2');

    fireEvent.doubleClick(cellAt(1, 2)!);
    // C2 is a list cell: its dropdown, not a text editor, is open. Escape it
    // and use B2 for Shift+Tab instead.
    press('Escape');
    select(1, 1);
    fireEvent.doubleClick(cellAt(1, 1)!);
    press('Tab', { shiftKey: true });
    expect(activeCell()).toBe('1,0');
  });

  it('Enter on a selected cell moves down without opening the editor', async () => {
    await renderEditable();
    select(0, 1);
    press('Enter');
    expect(editor()).toBeNull();
    expect(activeCell()).toBe('1,1');
    press('Enter', { shiftKey: true });
    expect(activeCell()).toBe('0,1');
  });

  it('F2 opens the editor on the selected cell', async () => {
    await renderEditable();
    select(1, 1);
    press('F2');
    expect(editor()?.value).toBe('100');
  });

  it('typing on a selected cell opens the editor with the typed text in place of the value', async () => {
    const { ref } = await renderEditable();
    select(1, 0);
    press('Z');
    const input = editor()!;
    expect(input.value).toBe('Z');
    expect(input.selectionStart).toBe(1);
    fireEvent.change(input, { target: { value: 'Zebra' } });
    press('Enter');
    expect(ref.current!.getCellRangeData('A2')).toEqual([['Zebra']]);
    expect(activeCell()).toBe('2,0');
  });

  it('Escape after typing leaves the cell unchanged', async () => {
    const { ref } = await renderEditable();
    select(1, 0);
    press('Q');
    press('Escape');
    expect(editor()).toBeNull();
    expect(ref.current!.getCellRangeData('A2')).toEqual([['Revenue']]);
  });

  it('does not start an edit from typing with a modifier, in view mode, or on a list cell', async () => {
    await renderEditable();
    select(1, 0);
    press('b', { ctrlKey: true });
    press('k', { metaKey: true });
    press('x', { altKey: true });
    expect(editor()).toBeNull();

    select(1, 2);
    press('E');
    expect(document.querySelector('.sv-dropdown')).toBeNull();
    expect(editor()).toBeNull();
  });

  it('ignores typing in view mode', async () => {
    const ref = createRef<SheetViewerHandle>();
    render(<SheetViewer ref={ref} data={workbook} mode="view" height={600} width={800} />);
    await waitFor(() => expect(cellAt(0, 0)).not.toBeNull());
    select(1, 0);
    press('Z');
    expect(editor()).toBeNull();
  });

  it('does not take keys typed into the host page', async () => {
    await renderEditable();
    select(1, 0);
    const hostEditor = document.createElement('div');
    hostEditor.setAttribute('contenteditable', 'true');
    document.body.appendChild(hostEditor);
    act(() => {
      fireEvent.keyDown(hostEditor, { key: 'Z' });
    });
    expect(editor()).toBeNull();
    hostEditor.remove();
  });

  it('Alt+Down opens a list cell’s dropdown', async () => {
    await renderEditable();
    select(1, 2);
    press('ArrowDown', { altKey: true });
    // The dropdown opens on C2 itself (it replaces the cell while open) and
    // lists that cell's values; Alt+Down does not move the selection.
    const items = [...document.querySelectorAll('.sv-dropdown-item')].map((li) => li.textContent);
    expect(items).toEqual(['Income', 'Expense']);
    expect(cellAt(1, 2)).toBeNull();
    expect(activeCell()).toBeUndefined();
  });

  it('Ctrl+Z goes back to the edited cell and restores it; Ctrl+Y redoes it there', async () => {
    const { ref } = await renderEditable();
    select(1, 1);
    press('5');
    press('Enter');
    expect(activeCell()).toBe('2,1');
    expect(ref.current!.getCellRangeData('B2')).toEqual([['5']]);

    press('z', { ctrlKey: true });
    expect(ref.current!.getCellRangeData('B2')).toEqual([[100]]);
    expect(activeCell()).toBe('1,1');

    select(0, 0);
    press('y', { ctrlKey: true });
    expect(ref.current!.getCellRangeData('B2')).toEqual([['5']]);
    expect(activeCell()).toBe('1,1');
  });

  it('with navigation off, Enter in the editor commits without moving', async () => {
    const { ref } = await renderEditable({ keyboardInteractions: { navigation: false } });
    select(1, 1);
    fireEvent.doubleClick(cellAt(1, 1)!);
    fireEvent.change(editor()!, { target: { value: '7' } });
    press('Enter');
    expect(ref.current!.getCellRangeData('B2')).toEqual([['7']]);
    expect(activeCell()).toBe('1,1');
  });
});
