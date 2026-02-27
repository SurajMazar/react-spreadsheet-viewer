import React, { memo, type CSSProperties, type MouseEvent } from 'react';
import { isCellInRanges, getCellBorderInRanges } from '../../utils/rangeParser';
import type { CellRange, ActiveCell, CellValue, CellStyle, CellComment } from '../../types';

export interface CellProps {
  rowIndex: number;
  columnIndex: number;
  value: CellValue;
  ranges: CellRange[];
  activeCell: ActiveCell | null;
  cellStyle?: CellStyle;
  comment?: CellComment;
  isMerged?: boolean;
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
  comment,
  isMerged,
  onCellClick,
  onCellMouseDown,
  onCellMouseEnter,
  onCellDoubleClick,
  style,
}: CellProps) {
  const hasRange = ranges.length > 0;
  const isInRange = hasRange && isCellInRanges(rowIndex, columnIndex, ranges);
  const borders = hasRange ? getCellBorderInRanges(rowIndex, columnIndex, ranges) : null;
  const isActive =
    activeCell != null && activeCell.row === rowIndex && activeCell.col === columnIndex;

  // Only range selection is rendered visually — no single-cell outline.
  // The anchor cell inside a range gets a white bg (no tint).
  const showInRangeTint = isInRange && !isActive;
  const showActiveInRange = isActive && isInRange;

  let className = 'sv-cell';
  if (showInRangeTint) className += ' sv-cell-in-range';
  if (showActiveInRange) className += ' sv-cell-active-in-range';
  if (isMerged) className += ' sv-cell-merged';

  // Build style object: positioning + selection borders + cell formatting
  const mergedStyle: CSSProperties = { ...style };

  // Merged cells need a z-index so they render above hidden neighbor cells
  if (isMerged) {
    mergedStyle.zIndex = 2;
  }

  const hasWrap = cellStyle?.wrapText;

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
      {comment && <div className="sv-comment-indicator" title={`${comment.author ? comment.author + ': ' : ''}${comment.text}`} />}
      <span className={hasWrap ? 'sv-cell-text sv-cell-text-wrap' : 'sv-cell-text'}>
        {value != null ? String(value) : ''}
      </span>
    </div>
  );
});

export default Cell;
