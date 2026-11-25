import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EditableCell from '../EditableCell';

const baseProps = {
  row: 2,
  col: 3,
  value: 'Original' as string | number | boolean | null | undefined,
  style: { position: 'absolute' as const, top: 0, left: 0, width: 100, height: 26 },
  onCommit: vi.fn(),
  onCancel: vi.fn(),
};

function renderEditable(overrides: Partial<typeof baseProps> = {}) {
  const onCommit = vi.fn();
  const onCancel = vi.fn();
  const props = { ...baseProps, onCommit, onCancel, ...overrides };
  const utils = render(<EditableCell {...props} />);
  return { ...utils, onCommit: props.onCommit, onCancel: props.onCancel };
}

// =============================================
// Rendering & Initialization
// =============================================
describe('EditableCell — Rendering', () => {
  it('renders an input element', () => {
    renderEditable();
    const input = screen.getByRole('textbox');
    expect(input).toBeTruthy();
  });

  it('initializes input with the string representation of value', () => {
    renderEditable({ value: 'Hello' });
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('Hello');
  });

  it('initializes input with stringified number', () => {
    renderEditable({ value: 42 });
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('42');
  });

  it('initializes input with empty string for null value', () => {
    renderEditable({ value: null });
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('');
  });

  it('initializes input with empty string for undefined value', () => {
    renderEditable({ value: undefined });
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('');
  });

  it('initializes input with stringified boolean', () => {
    renderEditable({ value: true });
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('true');
  });
});

// =============================================
// User Input
// =============================================
describe('EditableCell — User input', () => {
  it('updates the input value as user types', () => {
    renderEditable({ value: '' });
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'New value' } });
    expect(input.value).toBe('New value');
  });
});

// =============================================
// Keyboard Handling
// =============================================
describe('EditableCell — Keyboard handling', () => {
  it('commits the current value on Enter and asks to move down', () => {
    const { onCommit } = renderEditable({ value: 'Test' });
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Updated' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledWith(2, 3, 'Updated', 'down');
  });

  it('asks to move up on Shift+Enter', () => {
    const { onCommit } = renderEditable({ value: 'Test' });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', shiftKey: true });
    expect(onCommit).toHaveBeenCalledWith(2, 3, 'Test', 'up');
  });

  it('commits the current value on Tab and asks to move right', () => {
    const { onCommit } = renderEditable({ value: 'Tab test' });
    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'Tab' });
    expect(onCommit).toHaveBeenCalledWith(2, 3, 'Tab test', 'right');
  });

  it('asks to move left on Shift+Tab', () => {
    const { onCommit } = renderEditable({ value: 'Tab test' });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Tab', shiftKey: true });
    expect(onCommit).toHaveBeenCalledWith(2, 3, 'Tab test', 'left');
  });

  it('leaves Tab to the browser when tab navigation is off', () => {
    const onCommit = vi.fn();
    render(<EditableCell {...baseProps} onCommit={onCommit} tabNavigation={false} />);
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Tab' });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('does not commit or move when the value fails validation', () => {
    const onCommit = vi.fn();
    render(
      <EditableCell
        {...baseProps}
        value=""
        onCommit={onCommit}
        validation={{ type: 'number', min: 10 }}
      />
    );
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('calls onCancel on Escape (discards edits)', () => {
    const { onCancel, onCommit } = renderEditable({ value: 'Original' });
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Changed' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('does not call onCommit or onCancel for other keys', () => {
    const { onCommit, onCancel } = renderEditable();
    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'a' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(onCommit).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });
});

// =============================================
// Blur Handling
// =============================================
describe('EditableCell — Blur (commit on focus loss)', () => {
  it('calls onCommit with current value when input loses focus', () => {
    const { onCommit } = renderEditable({ value: 'Blur test' });
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Modified' } });
    fireEvent.blur(input);
    // A click-away commit stays on the cell: no move.
    expect(onCommit).toHaveBeenCalledWith(2, 3, 'Modified');
  });
});

// =============================================
// Style & Layout
// =============================================
describe('EditableCell — Style', () => {
  it('applies z-index 50 for overlay positioning', () => {
    const { container } = renderEditable();
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.zIndex).toBe('50');
  });

  it('has sv-editable-cell class', () => {
    const { container } = renderEditable();
    expect(container.firstElementChild?.classList.contains('sv-editable-cell')).toBe(true);
  });
});
