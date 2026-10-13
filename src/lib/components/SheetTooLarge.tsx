import React from 'react';

/**
 * Shown in the grid area, in place of the grid, for a sheet the parser refused
 * because its used range is over the viewer's `limits`. The sheet tabs stay
 * usable, so the workbook's other sheets are one click away.
 *
 * No "download it instead" hint: the toolbar's Download re-exports the parsed
 * data rather than the original file, and a refused sheet has none to export.
 */
export default function SheetTooLarge() {
  return (
    <div className="sv-sheet-too-large" role="status">
      <p className="sv-sheet-too-large-text">This sheet is too large to preview.</p>
    </div>
  );
}
