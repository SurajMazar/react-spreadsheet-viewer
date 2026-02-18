import { describe, it, expect } from 'vitest';
import { tokenize, parseFormula } from '../parser';

describe('tokenize', () => {
  it('produces correct tokens for =A1+B2', () => {
    const tokens = tokenize('=A1+B2');
    expect(tokens).toEqual([
      { type: 'CELL_REF', value: 'A1' },
      { type: 'OPERATOR', value: '+' },
      { type: 'CELL_REF', value: 'B2' },
      { type: 'EOF', value: '' },
    ]);
  });

  it('produces FUNCTION, LPAREN, RANGE_REF, RPAREN for =SUM(A1:A10)', () => {
    const tokens = tokenize('=SUM(A1:A10)');
    expect(tokens).toEqual([
      { type: 'FUNCTION', value: 'SUM' },
      { type: 'LPAREN', value: '(' },
      { type: 'RANGE_REF', value: 'A1:A10' },
      { type: 'RPAREN', value: ')' },
      { type: 'EOF', value: '' },
    ]);
  });

  it('produces STRING token for ="hello"', () => {
    const tokens = tokenize('="hello"');
    expect(tokens).toEqual([
      { type: 'STRING', value: 'hello' },
      { type: 'EOF', value: '' },
    ]);
  });

  it('produces NUMBER token for =42', () => {
    const tokens = tokenize('=42');
    expect(tokens).toEqual([
      { type: 'NUMBER', value: '42' },
      { type: 'EOF', value: '' },
    ]);
  });

  it('produces NUMBER token for =3.14', () => {
    const tokens = tokenize('=3.14');
    expect(tokens).toEqual([
      { type: 'NUMBER', value: '3.14' },
      { type: 'EOF', value: '' },
    ]);
  });

  it('tokenizes arithmetic operators +, -, *, /, ^', () => {
    expect(tokenize('=1+2')).toContainEqual({ type: 'OPERATOR', value: '+' });
    expect(tokenize('=1-2')).toContainEqual({ type: 'OPERATOR', value: '-' });
    expect(tokenize('=1*2')).toContainEqual({ type: 'OPERATOR', value: '*' });
    expect(tokenize('=1/2')).toContainEqual({ type: 'OPERATOR', value: '/' });
    expect(tokenize('=1^2')).toContainEqual({ type: 'OPERATOR', value: '^' });
  });

  it('tokenizes comparison operators =, <>, <=, >=, <, >', () => {
    expect(tokenize('=A1=B2')).toContainEqual({ type: 'OPERATOR', value: '=' });
    expect(tokenize('=A1<>B2')).toContainEqual({ type: 'OPERATOR', value: '<>' });
    expect(tokenize('=A1<=B2')).toContainEqual({ type: 'OPERATOR', value: '<=' });
    expect(tokenize('=A1>=B2')).toContainEqual({ type: 'OPERATOR', value: '>=' });
    expect(tokenize('=A1<B2')).toContainEqual({ type: 'OPERATOR', value: '<' });
    expect(tokenize('=A1>B2')).toContainEqual({ type: 'OPERATOR', value: '>' });
  });

  it('tokenizes concatenation operator &', () => {
    const tokens = tokenize('=A1&B2');
    expect(tokens).toContainEqual({ type: 'OPERATOR', value: '&' });
  });

  it('tokenizes nested parentheses =((A1+B1)*2)', () => {
    const tokens = tokenize('=((A1+B1)*2)');
    expect(tokens).toContainEqual({ type: 'LPAREN', value: '(' });
    expect(tokens).toContainEqual({ type: 'RPAREN', value: ')' });
    expect(tokens.filter((t) => t.type === 'LPAREN')).toHaveLength(2);
    expect(tokens.filter((t) => t.type === 'RPAREN')).toHaveLength(2);
  });

  it('tokenizes absolute reference =$A$1', () => {
    const tokens = tokenize('=$A$1');
    expect(tokens).toEqual([
      { type: 'CELL_REF', value: '$A$1' },
      { type: 'EOF', value: '' },
    ]);
  });

  it('tokenizes mixed reference =$A1', () => {
    const tokens = tokenize('=$A1');
    expect(tokens).toEqual([
      { type: 'CELL_REF', value: '$A1' },
      { type: 'EOF', value: '' },
    ]);
  });

  it('tokenizes mixed reference =A$1', () => {
    const tokens = tokenize('=A$1');
    expect(tokens).toEqual([
      { type: 'CELL_REF', value: 'A$1' },
      { type: 'EOF', value: '' },
    ]);
  });

  it('tokenizes COMMA for function arguments', () => {
    const tokens = tokenize('=SUM(A1,B1,C1)');
    expect(tokens).toContainEqual({ type: 'COMMA', value: ',' });
    expect(tokens.filter((t) => t.type === 'COMMA')).toHaveLength(2);
  });

  it('tokenizes string with spaces =A1&" "&B1', () => {
    const tokens = tokenize('=A1&" "&B1');
    expect(tokens).toContainEqual({ type: 'STRING', value: ' ' });
    expect(tokens).toContainEqual({ type: 'CELL_REF', value: 'A1' });
    expect(tokens).toContainEqual({ type: 'CELL_REF', value: 'B1' });
  });

  it('ends with EOF token', () => {
    const tokens = tokenize('=1');
    expect(tokens[tokens.length - 1]).toEqual({ type: 'EOF', value: '' });
  });

  it('skips leading =', () => {
    const withEquals = tokenize('=A1');
    const withoutEquals = tokenize('A1');
    expect(withEquals[0]).toEqual({ type: 'CELL_REF', value: 'A1' });
    expect(withoutEquals[0]).toEqual({ type: 'CELL_REF', value: 'A1' });
  });
});

describe('parseFormula', () => {
  it('respects operator precedence: =1+2*3 parses as 1+(2*3)', () => {
    const ast = parseFormula('=1+2*3');
    expect(ast.kind).toBe('binaryOp');
    if (ast.kind === 'binaryOp') {
      expect(ast.op).toBe('+');
      expect(ast.left).toEqual({ kind: 'number', value: 1 });
      expect(ast.right.kind).toBe('binaryOp');
      if (ast.right.kind === 'binaryOp') {
        expect(ast.right.op).toBe('*');
        expect(ast.right.left).toEqual({ kind: 'number', value: 2 });
        expect(ast.right.right).toEqual({ kind: 'number', value: 3 });
      }
    }
  });

  it('produces FunctionCallNode for =SUM(A1, B1, C1:C10) with correct args', () => {
    const ast = parseFormula('=SUM(A1, B1, C1:C10)');
    expect(ast.kind).toBe('functionCall');
    if (ast.kind === 'functionCall') {
      expect(ast.name).toBe('SUM');
      expect(ast.args).toHaveLength(3);
      expect(ast.args[0]).toEqual({ kind: 'cellRef', ref: 'A1' });
      expect(ast.args[1]).toEqual({ kind: 'cellRef', ref: 'B1' });
      expect(ast.args[2]).toEqual({ kind: 'rangeRef', start: 'C1', end: 'C10' });
    }
  });

  it('handles nested functions =IF(SUM(A1:A5)>100, "High", "Low")', () => {
    const ast = parseFormula('=IF(SUM(A1:A5)>100, "High", "Low")');
    expect(ast.kind).toBe('functionCall');
    if (ast.kind === 'functionCall') {
      expect(ast.name).toBe('IF');
      expect(ast.args).toHaveLength(3);
      expect(ast.args[0].kind).toBe('binaryOp');
      if (ast.args[0].kind === 'binaryOp') {
        expect(ast.args[0].op).toBe('>');
        expect(ast.args[0].left.kind).toBe('functionCall');
        if (ast.args[0].left.kind === 'functionCall') {
          expect(ast.args[0].left.name).toBe('SUM');
          expect(ast.args[0].left.args[0]).toEqual({
            kind: 'rangeRef',
            start: 'A1',
            end: 'A5',
          });
        }
        expect(ast.args[0].right).toEqual({ kind: 'number', value: 100 });
      }
      expect(ast.args[1]).toEqual({ kind: 'string', value: 'High' });
      expect(ast.args[2]).toEqual({ kind: 'string', value: 'Low' });
    }
  });

  it('returns ErrorNode for syntax errors', () => {
    const ast = parseFormula('=A1+');
    expect(ast.kind).toBe('error');
    if (ast.kind === 'error') {
      expect(ast.message).toBeDefined();
      expect(ast.message.length).toBeGreaterThan(0);
    }
  });

  it('produces CellRefNode for =A1', () => {
    const ast = parseFormula('=A1');
    expect(ast).toEqual({ kind: 'cellRef', ref: 'A1' });
  });

  it('produces RangeRefNode for =A1:B10', () => {
    const ast = parseFormula('=A1:B10');
    expect(ast).toEqual({ kind: 'rangeRef', start: 'A1', end: 'B10' });
  });

  it('produces UnaryOpNode for unary minus =-5', () => {
    const ast = parseFormula('=-5');
    expect(ast).toEqual({
      kind: 'unaryOp',
      op: '-',
      operand: { kind: 'number', value: 5 },
    });
  });

  it('produces correct AST for string concat =A1&" "&B1 (left-associative)', () => {
    const ast = parseFormula('=A1&" "&B1');
    expect(ast.kind).toBe('binaryOp');
    if (ast.kind === 'binaryOp') {
      expect(ast.op).toBe('&');
      expect(ast.right).toEqual({ kind: 'cellRef', ref: 'B1' });
      expect(ast.left.kind).toBe('binaryOp');
      if (ast.left.kind === 'binaryOp') {
        expect(ast.left.op).toBe('&');
        expect(ast.left.left).toEqual({ kind: 'cellRef', ref: 'A1' });
        expect(ast.left.right).toEqual({ kind: 'string', value: ' ' });
      }
    }
  });

  it('produces BinaryOpNode for comparison =A1>100', () => {
    const ast = parseFormula('=A1>100');
    expect(ast).toEqual({
      kind: 'binaryOp',
      op: '>',
      left: { kind: 'cellRef', ref: 'A1' },
      right: { kind: 'number', value: 100 },
    });
  });

  it('returns ErrorNode for empty formula', () => {
    const ast = parseFormula('');
    expect(ast.kind).toBe('error');
    if (ast.kind === 'error') {
      expect(ast.message).toBe('Formula must start with =');
    }
  });

  it('returns ErrorNode for formula without leading =', () => {
    const ast = parseFormula('A1+B2');
    expect(ast.kind).toBe('error');
    if (ast.kind === 'error') {
      expect(ast.message).toBe('Formula must start with =');
    }
  });

  it('parses simple number =42', () => {
    const ast = parseFormula('=42');
    expect(ast).toEqual({ kind: 'number', value: 42 });
  });

  it('parses decimal number =3.14', () => {
    const ast = parseFormula('=3.14');
    expect(ast).toEqual({ kind: 'number', value: 3.14 });
  });

  it('parses simple string ="hello"', () => {
    const ast = parseFormula('="hello"');
    expect(ast).toEqual({ kind: 'string', value: 'hello' });
  });

  it('parses chained addition =1+2+3 (left-associative)', () => {
    const ast = parseFormula('=1+2+3');
    expect(ast.kind).toBe('binaryOp');
    if (ast.kind === 'binaryOp') {
      expect(ast.op).toBe('+');
      expect(ast.right).toEqual({ kind: 'number', value: 3 });
      expect(ast.left.kind).toBe('binaryOp');
      if (ast.left.kind === 'binaryOp') {
        expect(ast.left.op).toBe('+');
        expect(ast.left.left).toEqual({ kind: 'number', value: 1 });
        expect(ast.left.right).toEqual({ kind: 'number', value: 2 });
      }
    }
  });

  it('parses power operator =2^3', () => {
    const ast = parseFormula('=2^3');
    expect(ast).toEqual({
      kind: 'binaryOp',
      op: '^',
      left: { kind: 'number', value: 2 },
      right: { kind: 'number', value: 3 },
    });
  });

  it('parses division =10/2', () => {
    const ast = parseFormula('=10/2');
    expect(ast).toEqual({
      kind: 'binaryOp',
      op: '/',
      left: { kind: 'number', value: 10 },
      right: { kind: 'number', value: 2 },
    });
  });

  it('parses parentheses =A1*(B1+C1)', () => {
    const ast = parseFormula('=A1*(B1+C1)');
    expect(ast.kind).toBe('binaryOp');
    if (ast.kind === 'binaryOp') {
      expect(ast.op).toBe('*');
      expect(ast.left).toEqual({ kind: 'cellRef', ref: 'A1' });
      expect(ast.right.kind).toBe('binaryOp');
      if (ast.right.kind === 'binaryOp') {
        expect(ast.right.op).toBe('+');
        expect(ast.right.left).toEqual({ kind: 'cellRef', ref: 'B1' });
        expect(ast.right.right).toEqual({ kind: 'cellRef', ref: 'C1' });
      }
    }
  });

  it('parses function with no args =SUM()', () => {
    const ast = parseFormula('=SUM()');
    expect(ast).toEqual({
      kind: 'functionCall',
      name: 'SUM',
      args: [],
    });
  });

  it('parses equality comparison =A1=B2', () => {
    const ast = parseFormula('=A1=B2');
    expect(ast).toEqual({
      kind: 'binaryOp',
      op: '=',
      left: { kind: 'cellRef', ref: 'A1' },
      right: { kind: 'cellRef', ref: 'B2' },
    });
  });

  it('parses not-equal comparison =A1<>B2', () => {
    const ast = parseFormula('=A1<>B2');
    expect(ast).toEqual({
      kind: 'binaryOp',
      op: '<>',
      left: { kind: 'cellRef', ref: 'A1' },
      right: { kind: 'cellRef', ref: 'B2' },
    });
  });

  it('returns ErrorNode for invalid formula =)', () => {
    const ast = parseFormula('=)');
    expect(ast.kind).toBe('error');
  });

  it('returns ErrorNode for mismatched parentheses =(A1', () => {
    const ast = parseFormula('=(A1');
    expect(ast.kind).toBe('error');
  });
});
