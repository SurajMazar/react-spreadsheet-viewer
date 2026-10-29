import React, { useState, useRef, useEffect, useCallback, type CSSProperties, type KeyboardEvent } from 'react';
import type { CellValue, ValidationRule } from '../../types';
import { validateCellValue } from '../../validation/validator';
import DropdownEditor from './DropdownEditor';

export interface EditableCellProps {
  row: number;
  col: number;
  value: CellValue;
  style: CSSProperties;
  validation?: ValidationRule;
  tabNavigation?: boolean;
  onCommit: (row: number, col: number, value: string) => void;
  onCancel: () => void;
}

/**
 * An input overlay that appears when a cell is double-clicked in edit mode.
 * Supports data validation (a list type opens the in-cell dropdown, others show error states).
 */
export default function EditableCell({ row, col, value, style, validation, tabNavigation = true, onCommit, onCancel }: EditableCellProps) {
  const [localValue, setLocalValue] = useState(String(value ?? ''));
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (validation?.type === 'list') return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [validation]);

  const tryCommit = useCallback(
    (val: string) => {
      if (validation) {
        const result = validateCellValue(val, validation);
        if (!result.valid) {
          setValidationError(result.errorMessage || 'Invalid value');
          return;
        }
      }
      setValidationError(null);
      onCommit(row, col, val);
    },
    [row, col, validation, onCommit]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        tryCommit(localValue);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Tab') {
        if (!tabNavigation) return;
        e.preventDefault();
        tryCommit(localValue);
      }
    },
    [localValue, tryCommit, onCancel]
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
