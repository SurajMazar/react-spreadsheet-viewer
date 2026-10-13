import { describe, it, expect } from 'vitest';
import { parseCsv, readCsvRows, isBlankCsvRow } from '../csvParser';

describe('parseCsv', () => {
  it('splits plain rows and fields', () => {
    expect(parseCsv('a,b,c\n1,2,3')).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
  });

  it('keeps a newline inside a quoted field in one cell', () => {
    expect(parseCsv('id,note\n1,"line one\nline two"\n2,x')).toEqual([
      ['id', 'note'],
      ['1', 'line one\nline two'],
      ['2', 'x'],
    ]);
  });

  it('keeps a CRLF inside a quoted field as written', () => {
    expect(parseCsv('"a\r\nb",c\r\n')).toEqual([['a\r\nb', 'c']]);
  });

  it('keeps a comma inside a quoted field', () => {
    expect(parseCsv('"Doe, Jane",42')).toEqual([['Doe, Jane', '42']]);
  });

  it('turns doubled quotes into one literal quote', () => {
    expect(parseCsv('"say ""hi""",""""')).toEqual([['say "hi"', '"']]);
  });

  it('reads an empty quoted field as empty', () => {
    expect(parseCsv('"",x')).toEqual([['', 'x']]);
  });

  it('handles CRLF line endings', () => {
    expect(parseCsv('a,b\r\nc,d\r\n')).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it('handles LF and lone CR line endings', () => {
    expect(parseCsv('a\nb\rc')).toEqual([['a'], ['b'], ['c']]);
  });

  it('keeps empty fields, including leading and trailing ones', () => {
    expect(parseCsv(',a,,b,')).toEqual([['', 'a', '', 'b', '']]);
    expect(parseCsv('a,\n,b')).toEqual([['a', ''], ['', 'b']]);
  });

  it('does not add a row for a trailing newline', () => {
    expect(parseCsv('a,b\n')).toEqual([['a', 'b']]);
    expect(parseCsv('a,b\r\n')).toEqual([['a', 'b']]);
  });

  it('keeps a blank line in the middle as a row', () => {
    expect(parseCsv('a\n\nb')).toEqual([['a'], [''], ['b']]);
  });

  it('preserves leading and trailing spaces', () => {
    expect(parseCsv('  a , b  ,"  c  "')).toEqual([['  a ', ' b  ', '  c  ']]);
  });

  it('treats a quote that does not open a field as a literal', () => {
    expect(parseCsv('5" pipe,ab"c')).toEqual([['5" pipe', 'ab"c']]);
  });

  it('keeps text after a closing quote up to the delimiter', () => {
    expect(parseCsv('"ab"cd,e')).toEqual([['abcd', 'e']]);
  });

  it('runs an unterminated quoted field to the end of the text', () => {
    expect(parseCsv('a,"open\nstill open')).toEqual([['a', 'open\nstill open']]);
  });

  it('returns no rows for empty text', () => {
    expect(parseCsv('')).toEqual([]);
  });
});

describe('readCsvRows', () => {
  it('reads in chunks that resume at row boundaries, even across quoted newlines', () => {
    const text = 'a,"1\n2"\nb,3\nc,"4\r\n5"\r\nd,6';
    const rows: string[][] = [];
    let pos = 0;
    let calls = 0;
    while (pos < text.length) {
      pos = readCsvRows(text, pos, 1, rows);
      calls++;
    }
    expect(calls).toBe(4);
    expect(rows).toEqual([['a', '1\n2'], ['b', '3'], ['c', '4\r\n5'], ['d', '6']]);
    expect(rows).toEqual(parseCsv(text));
  });

  it('parses a large file quickly', () => {
    const line = 'alpha,"beta, gamma",123.45,"say ""x"""\n';
    const text = line.repeat(100_000);
    const start = Date.now();
    const rows = parseCsv(text);
    expect(rows).toHaveLength(100_000);
    expect(rows[99_999]).toEqual(['alpha', 'beta, gamma', '123.45', 'say "x"']);
    expect(Date.now() - start).toBeLessThan(2000);
  });
});

describe('isBlankCsvRow', () => {
  it('is true only when every field is empty', () => {
    expect(isBlankCsvRow([''])).toBe(true);
    expect(isBlankCsvRow(['', '', ''])).toBe(true);
    expect(isBlankCsvRow(['', ' '])).toBe(false);
  });
});
