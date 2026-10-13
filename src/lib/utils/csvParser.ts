/**
 * RFC 4180 CSV reading.
 *
 * Quotes are only special at the start of a field. Inside a quoted field,
 * commas and line breaks are content and `""` is one literal quote; after the
 * closing quote, anything up to the next comma or line break is kept as
 * written (lenient, like most spreadsheet apps). An unquoted field is taken
 * exactly as written — no trimming — so values round-trip unchanged.
 *
 * Rows end at `\r\n`, `\n`, or a lone `\r` (classic Mac line endings). An
 * unterminated quoted field runs to the end of the text.
 *
 * Reading is resumable at row boundaries, so the parser can work through a
 * large file in chunks and yield to the browser between them.
 */

const QUOTE = 34; // "
const COMMA = 44; // ,
const LF = 10; // \n
const CR = 13; // \r

/** Index of the first comma or line break at or after `from`, or `text.length`. */
function fieldEnd(text: string, from: number): number {
  const len = text.length;
  let i = from;
  while (i < len) {
    const ch = text.charCodeAt(i);
    if (ch === COMMA || ch === LF || ch === CR) break;
    i++;
  }
  return i;
}

/**
 * Read up to `maxRows` rows of `text` starting at `start` (which must be the
 * start of a row), appending them to `out`. Returns the position the next row
 * starts at — `text.length` once everything is read.
 */
export function readCsvRows(text: string, start: number, maxRows: number, out: string[][]): number {
  const len = text.length;
  let pos = start;
  let rowsRead = 0;

  while (pos < len && rowsRead < maxRows) {
    const row: string[] = [];

    for (;;) {
      let value: string;

      if (text.charCodeAt(pos) === QUOTE) {
        value = '';
        let segStart = pos + 1;
        for (;;) {
          const q = text.indexOf('"', segStart);
          if (q === -1) {
            // Unterminated: the rest of the text is this field
            value += text.slice(segStart);
            pos = len;
            break;
          }
          if (text.charCodeAt(q + 1) === QUOTE) {
            // "" -> one literal quote
            value += text.slice(segStart, q + 1);
            segStart = q + 2;
            continue;
          }
          value += text.slice(segStart, q);
          pos = q + 1;
          break;
        }
        const end = fieldEnd(text, pos);
        if (end > pos) value += text.slice(pos, end);
        pos = end;
      } else {
        const end = fieldEnd(text, pos);
        value = text.slice(pos, end);
        pos = end;
      }

      row.push(value);

      if (pos >= len) break;
      const ch = text.charCodeAt(pos);
      if (ch === COMMA) {
        pos++;
        continue;
      }
      // Line break: \r\n counts as one
      pos += ch === CR && text.charCodeAt(pos + 1) === LF ? 2 : 1;
      break;
    }

    out.push(row);
    rowsRead++;
  }

  return pos;
}

/** Parse a whole CSV text into rows. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  readCsvRows(text, 0, Infinity, rows);
  return rows;
}

/** Whether a row holds nothing but empty strings. */
export function isBlankCsvRow(row: ReadonlyArray<string>): boolean {
  for (let i = 0; i < row.length; i++) {
    if (row[i] !== '') return false;
  }
  return true;
}
