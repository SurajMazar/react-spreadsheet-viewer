import { describe, it, expect } from 'vitest';
import {
  SUM,
  AVERAGE,
  COUNT,
  COUNTA,
  MIN,
  MAX,
  ABS,
  SQRT,
  POWER,
  ROUND,
  IF,
  AND,
  OR,
  NOT,
  CONCATENATE,
  LEFT,
  RIGHT,
  MID,
  LEN,
  UPPER,
  LOWER,
  TRIM,
  VLOOKUP,
  HLOOKUP,
  INDEX,
  MATCH,
} from '../functions';

describe('formula functions', () => {
  describe('Math functions', () => {
    describe('SUM', () => {
      it('returns sum of numbers: SUM(1,2,3) = 6', () => {
        expect(SUM(1, 2, 3)).toBe(6);
      });

      it('returns 0 for empty args', () => {
        expect(SUM()).toBe(0);
      });

      it('handles single number', () => {
        expect(SUM(42)).toBe(42);
      });

      it('flattens and sums arrays (simulating ranges)', () => {
        expect(SUM([1, 2], [3, 4])).toBe(10);
      });

      it('handles nested arrays', () => {
        expect(SUM([[1, 2], [3, 4]])).toBe(10);
      });

      it('ignores non-numeric strings', () => {
        expect(SUM(1, 'abc', 2)).toBe(3);
      });

      it('converts numeric strings to numbers', () => {
        expect(SUM(1, '2', '3.5')).toBe(6.5);
      });

      it('converts booleans: true=1, false=0', () => {
        expect(SUM(true, false, true)).toBe(2);
      });

      it('ignores null', () => {
        expect(SUM(1, null, 2)).toBe(3);
      });
    });

    describe('AVERAGE', () => {
      it('returns average: AVERAGE(1,2,3,4) = 2.5', () => {
        expect(AVERAGE(1, 2, 3, 4)).toBe(2.5);
      });

      it('returns #DIV/0! for empty args', () => {
        expect(AVERAGE()).toBe('#DIV/0!');
      });

      it('returns #DIV/0! when all args are non-numeric', () => {
        expect(AVERAGE('abc', 'xyz')).toBe('#DIV/0!');
      });

      it('handles single value', () => {
        expect(AVERAGE(10)).toBe(10);
      });

      it('flattens arrays', () => {
        expect(AVERAGE([2, 4, 6])).toBe(4);
      });
    });

    describe('COUNT', () => {
      it('counts numeric values only', () => {
        expect(COUNT(1, 2, 3)).toBe(3);
      });

      it('ignores non-numeric strings', () => {
        expect(COUNT(1, 'abc', 2)).toBe(2);
      });

      it('counts booleans (converted to numbers)', () => {
        expect(COUNT(true, false)).toBe(2);
      });

      it('counts numeric strings', () => {
        expect(COUNT('1', '2.5')).toBe(2);
      });

      it('returns 0 for empty', () => {
        expect(COUNT()).toBe(0);
      });

      it('flattens arrays', () => {
        expect(COUNT([1, 2], [3])).toBe(3);
      });
    });

    describe('COUNTA', () => {
      it('counts non-empty values', () => {
        expect(COUNTA(1, 'a', true)).toBe(3);
      });

      it('excludes null and empty string', () => {
        expect(COUNTA(1, null, '', 2)).toBe(2);
      });

      it('returns 0 for all empty', () => {
        expect(COUNTA(null, '', null)).toBe(0);
      });

      it('counts 0 as non-empty', () => {
        expect(COUNTA(0, 1)).toBe(2);
      });

      it('flattens arrays', () => {
        expect(COUNTA([1, 'a'], [null])).toBe(2);
      });
    });

    describe('MIN', () => {
      it('returns minimum of numbers', () => {
        expect(MIN(5, 2, 8, 1)).toBe(1);
      });

      it('returns 0 for empty', () => {
        expect(MIN()).toBe(0);
      });

      it('handles arrays', () => {
        expect(MIN([3, 1, 4])).toBe(1);
      });

      it('ignores non-numeric', () => {
        expect(MIN(5, 'x', 2)).toBe(2);
      });
    });

    describe('MAX', () => {
      it('returns maximum of numbers', () => {
        expect(MAX(5, 2, 8, 1)).toBe(8);
      });

      it('returns 0 for empty', () => {
        expect(MAX()).toBe(0);
      });

      it('handles arrays', () => {
        expect(MAX([3, 1, 4])).toBe(4);
      });
    });

    describe('ROUND', () => {
      it('ROUND(3.456, 2) = 3.46', () => {
        expect(ROUND(3.456, 2)).toBe(3.46);
      });

      it('rounds to integer when digits omitted', () => {
        expect(ROUND(3.7)).toBe(4);
      });

      it('rounds down when fractional < 0.5', () => {
        expect(ROUND(3.4)).toBe(3);
      });

      it('returns #VALUE! for NaN', () => {
        expect(ROUND('abc')).toBe('#VALUE!');
      });
    });

    describe('ABS', () => {
      it('ABS(-5) = 5', () => {
        expect(ABS(-5)).toBe(5);
      });

      it('ABS(5) = 5', () => {
        expect(ABS(5)).toBe(5);
      });

      it('returns #VALUE! for non-numeric', () => {
        expect(ABS('x')).toBe('#VALUE!');
      });
    });

    describe('SQRT', () => {
      it('SQRT(9) = 3', () => {
        expect(SQRT(9)).toBe(3);
      });

      it('SQRT(-1) = #VALUE!', () => {
        expect(SQRT(-1)).toBe('#VALUE!');
      });

      it('returns #VALUE! for non-numeric', () => {
        expect(SQRT('x')).toBe('#VALUE!');
      });
    });

    describe('POWER', () => {
      it('POWER(2, 3) = 8', () => {
        expect(POWER(2, 3)).toBe(8);
      });

      it('POWER(10, 2) = 100', () => {
        expect(POWER(10, 2)).toBe(100);
      });

      it('returns #VALUE! for non-numeric base', () => {
        expect(POWER('x', 2)).toBe('#VALUE!');
      });

      it('returns #VALUE! for non-numeric exponent', () => {
        expect(POWER(2, 'x')).toBe('#VALUE!');
      });
    });
  });

  describe('Logical functions', () => {
    describe('IF', () => {
      it('IF(true, "yes", "no") = "yes"', () => {
        expect(IF(true, 'yes', 'no')).toBe('yes');
      });

      it('IF(false, "yes", "no") = "no"', () => {
        expect(IF(false, 'yes', 'no')).toBe('no');
      });

      it('returns true when condition true and trueVal omitted', () => {
        expect(IF(true)).toBe(true);
      });

      it('returns false when condition false and falseVal omitted', () => {
        expect(IF(false)).toBe(false);
      });
    });

    describe('AND', () => {
      it('AND(true, true, false) = false', () => {
        expect(AND(true, true, false)).toBe(false);
      });

      it('AND(true, true) = true', () => {
        expect(AND(true, true)).toBe(true);
      });

      it('AND(false, false) = false', () => {
        expect(AND(false, false)).toBe(false);
      });

      it('AND() with no args - every on empty is true', () => {
        expect(AND()).toBe(true);
      });
    });

    describe('OR', () => {
      it('OR(false, true, false) = true', () => {
        expect(OR(false, true, false)).toBe(true);
      });

      it('OR(false, false) = false', () => {
        expect(OR(false, false)).toBe(false);
      });

      it('OR(true, true) = true', () => {
        expect(OR(true, true)).toBe(true);
      });

      it('OR() with no args - some on empty is false', () => {
        expect(OR()).toBe(false);
      });
    });

    describe('NOT', () => {
      it('NOT(false) = true', () => {
        expect(NOT(false)).toBe(true);
      });

      it('NOT(true) = false', () => {
        expect(NOT(true)).toBe(false);
      });
    });
  });

  describe('Text functions', () => {
    describe('CONCATENATE', () => {
      it('CONCATENATE("a", "b") = "ab"', () => {
        expect(CONCATENATE('a', 'b')).toBe('ab');
      });

      it('handles numbers', () => {
        expect(CONCATENATE(1, 2, 3)).toBe('123');
      });

      it('converts null to empty string', () => {
        expect(CONCATENATE('a', null, 'b')).toBe('ab');
      });
    });

    describe('LEFT', () => {
      it('LEFT("hello", 3) = "hel"', () => {
        expect(LEFT('hello', 3)).toBe('hel');
      });

      it('defaults to 1 char when numChars omitted', () => {
        expect(LEFT('hello')).toBe('h');
      });

      it('returns empty for 0 chars', () => {
        expect(LEFT('hello', 0)).toBe('');
      });
    });

    describe('RIGHT', () => {
      it('RIGHT("hello", 3) = "llo"', () => {
        expect(RIGHT('hello', 3)).toBe('llo');
      });

      it('defaults to 1 char when numChars omitted', () => {
        expect(RIGHT('hello')).toBe('o');
      });
    });

    describe('MID', () => {
      it('MID("hello", 2, 3) = "ell"', () => {
        expect(MID('hello', 2, 3)).toBe('ell');
      });

      it('MID is 1-based start', () => {
        expect(MID('hello', 1, 2)).toBe('he');
      });
    });

    describe('LEN', () => {
      it('LEN("hello") = 5', () => {
        expect(LEN('hello')).toBe(5);
      });

      it('LEN("") = 0', () => {
        expect(LEN('')).toBe(0);
      });

      it('converts numbers to string for length', () => {
        expect(LEN(12345)).toBe(5);
      });
    });

    describe('UPPER', () => {
      it('UPPER("hello") = "HELLO"', () => {
        expect(UPPER('hello')).toBe('HELLO');
      });
    });

    describe('LOWER', () => {
      it('LOWER("HELLO") = "hello"', () => {
        expect(LOWER('HELLO')).toBe('hello');
      });
    });

    describe('TRIM', () => {
      it('TRIM("  hello  ") = "hello"', () => {
        expect(TRIM('  hello  ')).toBe('hello');
      });

      it('trims leading and trailing spaces', () => {
        expect(TRIM('  a  ')).toBe('a');
      });
    });
  });

  describe('Lookup functions', () => {
    describe('VLOOKUP', () => {
      it('exact match: finds key and returns column value', () => {
        const range = [
          ['a', 10, 'x'],
          ['b', 20, 'y'],
          ['c', 30, 'z'],
        ];
        expect(VLOOKUP('b', range, 2, false)).toBe(20);
        expect(VLOOKUP('b', range, 3, false)).toBe('y');
      });

      it('VLOOKUP not found returns #N/A', () => {
        const range = [['a', 1], ['b', 2]];
        expect(VLOOKUP('z', range, 2, false)).toBe('#N/A');
      });

      it('defaults to exact match when fourth arg omitted', () => {
        const range = [['key', 100]];
        expect(VLOOKUP('key', range, 2)).toBe(100);
      });

      it('returns #VALUE! when range is not array', () => {
        expect(VLOOKUP('x', 'not-array', 1)).toBe('#VALUE!');
      });

      it('returns #REF! when col index out of bounds', () => {
        const range = [['a', 1]];
        expect(VLOOKUP('a', range, 5)).toBe('#REF!');
      });
    });

    describe('HLOOKUP', () => {
      it('exact match: finds key in first row and returns value from target row', () => {
        const range = [
          ['a', 'b', 'c'],
          [10, 20, 30],
          ['x', 'y', 'z'],
        ];
        expect(HLOOKUP('b', range, 2, true)).toBe(20);
        expect(HLOOKUP('c', range, 3, true)).toBe('z');
      });

      it('HLOOKUP not found returns #N/A', () => {
        const range = [['a', 'b'], [1, 2]];
        expect(HLOOKUP('z', range, 2)).toBe('#N/A');
      });

      it('returns #VALUE! when range is not array', () => {
        expect(HLOOKUP('x', 'not-array', 1)).toBe('#VALUE!');
      });
    });

    describe('INDEX', () => {
      it('INDEX(2D array, row, col) returns cell value', () => {
        const range = [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ];
        expect(INDEX(range, 1, 1)).toBe(1);
        expect(INDEX(range, 2, 3)).toBe(6);
        expect(INDEX(range, 3, 2)).toBe(8);
      });

      it('INDEX uses 1-based row and column', () => {
        const range = [['a', 'b']];
        expect(INDEX(range, 1, 2)).toBe('b');
      });

      it('returns #VALUE! when range is not array', () => {
        expect(INDEX('not-array', 1, 1)).toBe('#VALUE!');
      });

      it('returns #REF! when row out of bounds', () => {
        const range = [[1, 2]];
        expect(INDEX(range, 5, 1)).toBe('#REF!');
      });
    });

    describe('MATCH', () => {
      it('exact match: MATCH(value, 1D array, 0) returns 1-based position', () => {
        const range = ['apple', 'banana', 'cherry'];
        expect(MATCH('banana', range, 0)).toBe(2);
        expect(MATCH('apple', range, 0)).toBe(1);
        expect(MATCH('cherry', range, 0)).toBe(3);
      });

      it('MATCH not found returns #N/A', () => {
        const range = ['a', 'b', 'c'];
        expect(MATCH('z', range, 0)).toBe('#N/A');
      });

      it('MATCH flattens 2D range to 1D', () => {
        const range = [['a', 'b'], ['c', 'd']];
        expect(MATCH('c', range, 0)).toBe(3);
      });

      it('defaults to exact match (0) when third arg omitted', () => {
        const range = [10, 20, 30];
        expect(MATCH(20, range)).toBe(2);
      });

      it('returns #VALUE! when range is not array', () => {
        expect(MATCH('x', 'not-array', 0)).toBe('#VALUE!');
      });
    });
  });
});
