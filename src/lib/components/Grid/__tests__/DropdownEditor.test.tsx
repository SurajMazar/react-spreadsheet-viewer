import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EditableCell from '../EditableCell';
import Cell from '../Cell';

const items = ['Income', 'Expenses', 'Equity', 'Tax'];

function renderDropdown(value: string | null = 'Expenses') {
  const onCommit = vi.fn();
  const onCancel = vi.fn();
  const utils = render(
    <EditableCell
      row={4}
      col={2}
      value={value}
      style={{ position: 'absolute', top: 0, left: 0, width: 120, height: 26 }}
      validation={{ type: 'list', listItems: items }}
      onCommit={onCommit}
      onCancel={onCancel}
    />,
  );
  const combo = screen.getByRole('combobox');
  return { ...utils, onCommit, onCancel, combo };
}

const options = () => screen.getAllByRole('option');
const activeText = () => document.querySelector('.sv-dropdown-item-active')?.textContent;

describe('DropdownEditor (list validation)', () => {
  it('shows the cell value and every allowed item, the current one marked', () => {
    const { combo } = renderDropdown();
    expect(combo.querySelector('.sv-dropdown-value-text')?.textContent).toBe('Expenses');
    expect(options().map((o) => o.textContent)).toEqual(items);
    expect(options()[1].getAttribute('aria-selected')).toBe('true');
    expect(activeText()).toBe('Expenses');
  });

  it('has no blank placeholder item and no native select', () => {
    renderDropdown();
    expect(document.querySelector('select')).toBeNull();
    expect(options()).toHaveLength(items.length);
  });

  it('commits the clicked item', () => {
    const { onCommit } = renderDropdown();
    fireEvent.click(screen.getByText('Tax'));
    expect(onCommit).toHaveBeenCalledWith(4, 2, 'Tax');
  });

  it('moves with the arrow keys and commits on Enter', () => {
    const { combo, onCommit } = renderDropdown('Income');
    fireEvent.keyDown(combo, { key: 'ArrowDown' });
    fireEvent.keyDown(combo, { key: 'ArrowDown' });
    expect(activeText()).toBe('Equity');
    fireEvent.keyDown(combo, { key: 'ArrowUp' });
    fireEvent.keyDown(combo, { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledWith(4, 2, 'Expenses');
  });

  it('stops at the ends of the list', () => {
    const { combo } = renderDropdown('Income');
    fireEvent.keyDown(combo, { key: 'ArrowUp' });
    expect(activeText()).toBe('Income');
    fireEvent.keyDown(combo, { key: 'End' });
    fireEvent.keyDown(combo, { key: 'ArrowDown' });
    expect(activeText()).toBe('Tax');
  });

  it('jumps to the next item starting with a typed letter', () => {
    const { combo } = renderDropdown('Income');
    fireEvent.keyDown(combo, { key: 'e' });
    expect(activeText()).toBe('Expenses');
    fireEvent.keyDown(combo, { key: 'e' });
    expect(activeText()).toBe('Equity');
  });

  it('starts on the first item when the value is not in the list', () => {
    renderDropdown('Something else');
    expect(activeText()).toBe('Income');
  });

  it('cancels on Escape and on clicking away', () => {
    const first = renderDropdown();
    fireEvent.keyDown(first.combo, { key: 'Escape' });
    expect(first.onCancel).toHaveBeenCalledTimes(1);
    first.unmount();

    const second = renderDropdown();
    fireEvent.blur(second.combo, { relatedTarget: null });
    expect(second.onCancel).toHaveBeenCalledTimes(1);
    expect(second.onCommit).not.toHaveBeenCalled();
  });

  it('keeps focus when an item is pressed', () => {
    renderDropdown();
    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    screen.getByText('Tax').dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});

describe('Cell — in-cell dropdown button', () => {
  const baseProps = {
    rowIndex: 3,
    columnIndex: 1,
    value: 'Income',
    ranges: [],
    activeCell: { row: 3, col: 1 },
    onCellClick: vi.fn(),
    onCellMouseDown: vi.fn(),
    onCellMouseEnter: vi.fn(),
    style: {},
  };

  it('is shown only when asked for', () => {
    const { container, rerender } = render(<Cell {...baseProps} />);
    expect(container.querySelector('.sv-cell-dropdown-btn')).toBeNull();
    rerender(<Cell {...baseProps} showDropdownButton />);
    expect(container.querySelector('.sv-cell-dropdown-btn')).not.toBeNull();
  });

  it('opens the list without selecting or double-clicking the cell', () => {
    const onDropdownOpen = vi.fn();
    const onCellMouseDown = vi.fn();
    const onCellClick = vi.fn();
    const onCellDoubleClick = vi.fn();
    render(
      <Cell
        {...baseProps}
        showDropdownButton
        onDropdownOpen={onDropdownOpen}
        onCellMouseDown={onCellMouseDown}
        onCellClick={onCellClick}
        onCellDoubleClick={onCellDoubleClick}
      />,
    );
    const button = screen.getByRole('button', { name: 'Open list' });
    fireEvent.mouseDown(button);
    fireEvent.click(button);
    fireEvent.doubleClick(button);
    expect(onDropdownOpen).toHaveBeenCalledWith(3, 1);
    expect(onCellMouseDown).not.toHaveBeenCalled();
    expect(onCellClick).not.toHaveBeenCalled();
    expect(onCellDoubleClick).not.toHaveBeenCalled();
  });
});
