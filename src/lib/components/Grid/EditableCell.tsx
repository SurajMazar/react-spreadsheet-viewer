import { useState, useRef, useEffect, useCallback, type CSSProperties, type KeyboardEvent } from 'react';
import type { CellValue } from '../../types';

export interface EditableCellProps {
  row: number;
  col: number;
  value: CellValue;
  style: CSSProperties;
  onCommit: (row: number, col: number, value: string) => void;
  onCancel: () => void;
}

/**
 * An input overlay that appears when a cell is double-clicked in edit mode.
 */
export default function EditableCell({ row, col, value, style, onCommit, onCancel }: EditableCellProps) {
  const [localValue, setLocalValue] = useState(String(value ?? ''));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onCommit(row, col, localValue);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        onCommit(row, col, localValue);
      }
    },
    [row, col, localValue, onCommit, onCancel]
  );

  const handleBlur = useCallback(() => {
    onCommit(row, col, localValue);
  }, [row, col, localValue, onCommit]);

  return (
    <div
      className="sv-editable-cell"
      style={{
        ...style,
        zIndex: 50,
      }}
    >
      <input
        ref={inputRef}
        type="text"
        className="sv-editable-cell-input"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />
    </div>
  );
}
