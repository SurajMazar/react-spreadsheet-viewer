import React, { memo, type CSSProperties, type MouseEvent } from 'react';
import { isCellInRanges, getCellBorderInRanges } from '../../utils/rangeParser';
import type { CellRange, ActiveCell, CellValue, CellStyle } from '../../types';

export interface CellProps {
  rowIndex: number;
  columnIndex: number;
  value: CellValue;
  ranges: CellRange[];
  activeCell: ActiveCell | null;
  cellStyle?: CellStyle;
  onCellClick: (row: number, col: number) => void;
  onCellMouseDown: (e: MouseEvent, row: number, col: number) => void;
  onCellMouseEnter: (e: MouseEvent, row: number, col: number) => void;
  onCellDoubleClick?: (row: number, col: number) => void;
  style: CSSProperties;
}

/**
 * Memoized cell renderer for the virtualized grid.
 */
const Cell = memo(function Cell({
  rowIndex,
  columnIndex,
  value,
  ranges,
  activeCell,
  cellStyle,
  onCellClick,
  onCellMouseDown,
  onCellMouseEnter,
  onCellDoubleClick,
  style,
}: CellProps) {
  const isActive =
    activeCell != null && activeCell.row === rowIndex && activeCell.col === columnIndex;
  const isInRange = ranges.length > 0 && isCellInRanges(rowIndex, columnIndex, ranges);
  const borders =
    ranges.length > 0 ? getCellBorderInRanges(rowIndex, columnIndex, ranges) : null;

  let className = 'sv-cell';
  if (isActive) className += ' sv-cell-active';
  if (isInRange) className += ' sv-cell-in-range';

  // Build style object: positioning + selection borders + cell formatting
  const mergedStyle: CSSProperties = { ...style };

  if (cellStyle) {
    if (cellStyle.bgColor) mergedStyle.backgroundColor = cellStyle.bgColor;
    if (cellStyle.fontColor) mergedStyle.color = cellStyle.fontColor;
    if (cellStyle.bold) mergedStyle.fontWeight = 700;
    if (cellStyle.italic) mergedStyle.fontStyle = 'italic';
    if (cellStyle.fontSize) mergedStyle.fontSize = `${cellStyle.fontSize}pt`;
    if (cellStyle.textAlign) mergedStyle.textAlign = cellStyle.textAlign;
  }

  if (borders) {
    if (borders.top) mergedStyle.borderTop = '2px solid var(--sv-color-primary)';
    if (borders.bottom) mergedStyle.borderBottom = '2px solid var(--sv-color-primary)';
    if (borders.left) mergedStyle.borderLeft = '2px solid var(--sv-color-primary)';
    if (borders.right) mergedStyle.borderRight = '2px solid var(--sv-color-primary)';
  }

  return (
    <div
      className={className}
      style={mergedStyle}
      onClick={() => onCellClick(rowIndex, columnIndex)}
      onMouseDown={(e) => onCellMouseDown(e, rowIndex, columnIndex)}
      onMouseEnter={(e) => onCellMouseEnter(e, rowIndex, columnIndex)}
      onDoubleClick={() => onCellDoubleClick?.(rowIndex, columnIndex)}
      title={String(value ?? '')}
    >
      <span className="sv-cell-text">{value != null ? String(value) : ''}</span>
    </div>
  );
});

export default Cell;
