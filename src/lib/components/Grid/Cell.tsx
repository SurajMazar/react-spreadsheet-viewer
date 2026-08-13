import React, { memo, type CSSProperties, type MouseEvent } from 'react';
import { isCellInRanges, getCellBorderInRanges } from '../../utils/rangeParser';
import type { CellRange, ActiveCell, CellValue, CellStyle, CellComment, ParsedGridLineConfig } from '../../types';

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
  /** Custom fill color for selected range (overrides CSS variable) */
  highlightColor?: string;
  /** Custom border color for selected range borders (overrides CSS variable) */
  highlightBorderColor?: string;
  /** True when the highlight was set programmatically (shows tint even for single-cell) */
  isProgrammaticHighlight?: boolean;
  /** True when this cell is a non-active search match */
  isSearchMatch?: boolean;
  /** True when this cell is the active/current search match */
  isSearchActive?: boolean;
  /** Grid line configs that cover this cell (pre-filtered by caller) */
  gridLineBorders?: ParsedGridLineConfig[];
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
  highlightColor,
  highlightBorderColor,
  isProgrammaticHighlight = false,
  isSearchMatch = false,
  isSearchActive = false,
  gridLineBorders,
}: CellProps) {
  const hasRange = ranges.length > 0;
  const isInRange = hasRange && isCellInRanges(rowIndex, columnIndex, ranges);
  const borders = hasRange ? getCellBorderInRanges(rowIndex, columnIndex, ranges) : null;
  const isActive =
    activeCell != null && activeCell.row === rowIndex && activeCell.col === columnIndex;

  const isSingleCellRange = ranges.length === 1
    && ranges[0].startRow === ranges[0].endRow
    && ranges[0].startCol === ranges[0].endCol;

  // User-click single-cell: outline only. Programmatic single-cell: show full tint.
  const suppressSingleCellTint = isSingleCellRange && !isProgrammaticHighlight;

  // Search match always takes priority over range highlight visually.
  const isAnySearchHit = isSearchMatch || isSearchActive;
  const showInRangeTint = isInRange && !isActive && !suppressSingleCellTint && !isAnySearchHit;
  const showActiveInRange = isActive && isInRange && !suppressSingleCellTint && !isAnySearchHit;
  const showActiveOutline = isActive && !isAnySearchHit && (!isInRange || suppressSingleCellTint);

  let className = 'sv-cell';
  if (showActiveOutline) className += ' sv-cell-active';
  if (showInRangeTint) className += ' sv-cell-in-range';
  if (showActiveInRange) className += ' sv-cell-active-in-range';
  if (isMerged) className += ' sv-cell-merged';
  if (isSearchActive) className += ' sv-cell-search-active';
  else if (isSearchMatch) className += ' sv-cell-search-match';

  // Build style object: positioning + selection borders + cell formatting
  const mergedStyle: CSSProperties = { ...style };

  if (isMerged) {
    mergedStyle.zIndex = 2;
  }

  const hasWrap = cellStyle?.wrapText;

  if (cellStyle) {
    if (cellStyle.bgColor) mergedStyle.backgroundColor = cellStyle.bgColor;
    if (cellStyle.fontColor) mergedStyle.color = cellStyle.fontColor;
    if (cellStyle.bold) mergedStyle.fontWeight = 700;
    if (cellStyle.italic) mergedStyle.fontStyle = 'italic';
    // Scaled by the zoom variable so a cell carrying an explicit Excel font size
    // zooms with the rest of the grid instead of staying pinned at 100%.
    if (cellStyle.fontSize) mergedStyle.fontSize = `calc(${cellStyle.fontSize}pt * var(--sv-zoom))`;
    if (cellStyle.textAlign) mergedStyle.textAlign = cellStyle.textAlign;
  }

  // Apply highlight fill color inline so it wins over cellStyle.bgColor and CSS classes
  if (highlightColor && (showInRangeTint || showActiveInRange || showActiveOutline)) {
    mergedStyle.backgroundColor = highlightColor;
  }

  // Active cell outline uses the same highlight border color for consistency
  if (showActiveOutline) {
    const outlineColor = highlightBorderColor || 'var(--sv-color-primary)';
    mergedStyle.outline = `2px solid ${outlineColor}`;
    mergedStyle.outlineOffset = '-1px';
  }

  // Selection range border override
  const borderColor = highlightBorderColor || 'var(--sv-color-primary)';
  const hasBorder = borders && !suppressSingleCellTint && (borders.top || borders.bottom || borders.left || borders.right);
  if (borders && !suppressSingleCellTint) {
    if (borders.top) mergedStyle.borderTop = `2px solid ${borderColor}`;
    if (borders.bottom) mergedStyle.borderBottom = `2px solid ${borderColor}`;
    if (borders.left) mergedStyle.borderLeft = `2px solid ${borderColor}`;
    if (borders.right) mergedStyle.borderRight = `2px solid ${borderColor}`;
  }
  if (hasBorder) {
    mergedStyle.zIndex = 3;
  }

  // Grid line borders: applied on top of selection borders (per-side max)
  if (gridLineBorders && gridLineBorders.length > 0) {
    for (const glc of gridLineBorders) {
      const pr = glc.parsedRange;
      const bColor = glc.borderColor || 'var(--sv-color-border)';
      const bWidth = glc.borderWidth ?? 1;
      const bStyle = glc.borderStyle || 'solid';
      const borderVal = `${bWidth}px ${bStyle} ${bColor}`;
      const isTop = rowIndex === pr.startRow;
      const isBottom = rowIndex === pr.endRow;
      const isLeft = columnIndex === pr.startCol;
      const isRight = columnIndex === pr.endCol;
      if (isTop) mergedStyle.borderTop = borderVal;
      if (isBottom) mergedStyle.borderBottom = borderVal;
      if (isLeft) mergedStyle.borderLeft = borderVal;
      if (isRight) mergedStyle.borderRight = borderVal;
      // Interior horizontal/vertical lines
      if (!isTop) mergedStyle.borderTop = borderVal;
      if (!isBottom) mergedStyle.borderBottom = borderVal;
      if (!isLeft) mergedStyle.borderLeft = borderVal;
      if (!isRight) mergedStyle.borderRight = borderVal;
      if (glc.bgColor) mergedStyle.backgroundColor = glc.bgColor;
    }
  }

  return (
    <div
      className={className}
      style={mergedStyle}
      data-cell={`${rowIndex},${columnIndex}`}
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
