/**
 * How many rows and columns the grid draws: the data plus blank room past it,
 * so there is always space to type below or beside the data, as in a
 * spreadsheet. At least 50 blank rows under the data and 100 rows in all, as
 * Syncfusion showed, and enough to fill the visible area.
 */
export function gridExtent(
  dataRows: number,
  dataCols: number,
  visibleRows: number,
  visibleCols: number
): { rows: number; cols: number } {
  return {
    rows: Math.max(dataRows + 50, 100, visibleRows + 10),
    cols: Math.max(dataCols + 5, visibleCols + 5),
  };
}
