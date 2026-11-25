import React, { useState, useRef, useEffect, useCallback, type CSSProperties, type KeyboardEvent } from 'react';
import type { CellValue, ValidationRule } from '../../types';
import { validateCellValue } from '../../validation/validator';
import DropdownEditor from './DropdownEditor';

/** Where the active cell goes after an edit is committed from the keyboard. */
export type CommitMove = 'up' | 'down' | 'left' | 'right';

export interface EditableCellProps {
  row: number;
  col: number;
  value: CellValue;
  style: CSSProperties;
  validation?: ValidationRule;
  tabNavigation?: boolean;
  /**
   * Set when the editor was opened by typing on a selected cell: the typed
   * text replaces the cell's value and the caret sits after it, as in a
   * spreadsheet. Without it the editor starts on the value, all selected.
   */
  initialText?: string;
  /**
   * `move` is set when Enter or Tab committed the edit: Enter moves down
   * (Shift+Enter up) and Tab moves right (Shift+Tab left), as in a
   * spreadsheet. A commit from clicking away leaves it undefined.
   */
  onCommit: (row: number, col: number, value: string, move?: CommitMove) => void;
  onCancel: () => void;
}

/**
 * An input overlay that appears when a cell is double-clicked in edit mode.
 * Supports data validation (a list type opens the in-cell dropdown, others show error states).
 */
export default function EditableCell({
  row,
  col,
  value,
  style,
  validation,
  tabNavigation = true,
  initialText,
  onCommit,
  onCancel,
}: EditableCellProps) {
  const [localValue, setLocalValue] = useState(initialText ?? String(value ?? ''));
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Read once at mount: the editor is focused only when it opens.
  const typedRef = useRef(initialText !== undefined);

  useEffect(() => {
    if (validation?.type === 'list') return;
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    if (typedRef.current) {
      const end = input.value.length;
      input.setSelectionRange(end, end);
    } else {
      input.select();
    }
  }, [validation]);

  const tryCommit = useCallback(
    (val: string, move?: CommitMove) => {
      if (validation) {
        const result = validateCellValue(val, validation);
        if (!result.valid) {
          setValidationError(result.errorMessage || 'Invalid value');
          return;
        }
      }
      setValidationError(null);
      if (move) onCommit(row, col, val, move);
      else onCommit(row, col, val);
    },
    [row, col, validation, onCommit]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        tryCommit(localValue, e.shiftKey ? 'up' : 'down');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Tab') {
        if (!tabNavigation) return;
        e.preventDefault();
        tryCommit(localValue, e.shiftKey ? 'left' : 'right');
      }
    },
    [localValue, tryCommit, onCancel, tabNavigation]
  );

  const handleBlur = useCallback(() => {
    tryCommit(localValue);
  }, [localValue, tryCommit]);

  // List validation: the in-cell dropdown
  if (validation?.type === 'list') {
    return (
      <DropdownEditor
        row={row}
        col={col}
        value={String(value ?? '')}
        items={validation.listItems || []}
        style={style}
        onCommit={onCommit}
        onCancel={onCancel}
      />
    );
  }

  return (
    <div
      className="sv-editable-cell"
      style={{ ...style, zIndex: 50 }}
    >
      <input
        ref={inputRef}
        type={validation?.type === 'number' ? 'text' : 'text'}
        className={`sv-editable-cell-input${validationError ? ' sv-validation-error' : ''}`}
        value={localValue}
        onChange={(e) => {
          setLocalValue(e.target.value);
          if (validationError) setValidationError(null);
        }}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        title={validationError || undefined}
      />
      {validationError && (
        <div className="sv-validation-tooltip">{validationError}</div>
      )}
    </div>
  );
}
