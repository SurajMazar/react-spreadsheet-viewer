/**
 * Formula parser: tokenizes and builds an AST from Excel-style formulas.
 *
 * Supported syntax:
 *   =A1+B2, =SUM(A1:A10), =IF(A1>100,"High","Low")
 *   Operators: + - * / ^ & = <> < > <= >=
 *   Cell refs: A1, $A$1, $A1, A$1, A1:B10
 *   Strings: "hello"
 *   Numbers: 42, 3.14, -5
 */

// ===== Token Types =====
export type TokenType =
  | 'NUMBER'
  | 'STRING'
  | 'CELL_REF'
  | 'RANGE_REF'
  | 'FUNCTION'
  | 'OPERATOR'
  | 'LPAREN'
  | 'RPAREN'
  | 'COMMA'
  | 'COLON'
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
}

// ===== AST Node Types =====
export type ASTNode =
  | NumberNode
  | StringNode
  | CellRefNode
  | RangeRefNode
  | BinaryOpNode
  | UnaryOpNode
  | FunctionCallNode
  | ErrorNode;

export interface NumberNode {
  kind: 'number';
  value: number;
}

export interface StringNode {
  kind: 'string';
  value: string;
}

export interface CellRefNode {
  kind: 'cellRef';
  ref: string; // e.g. "A1", "$A$1"
}

export interface RangeRefNode {
  kind: 'rangeRef';
  start: string;
  end: string;
}

export interface BinaryOpNode {
  kind: 'binaryOp';
  op: string;
  left: ASTNode;
  right: ASTNode;
}

export interface UnaryOpNode {
  kind: 'unaryOp';
  op: string;
  operand: ASTNode;
}

export interface FunctionCallNode {
  kind: 'functionCall';
  name: string;
  args: ASTNode[];
}

export interface ErrorNode {
  kind: 'error';
  message: string;
}

// ===== Tokenizer =====
const CELL_REF_REGEX = /^\$?[A-Z]+\$?\d+/;
const FUNC_OR_CELL = /^[A-Z][A-Z0-9]*/;

export function tokenize(formula: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const src = formula;

  // Skip leading '='
  if (src[0] === '=') i = 1;

  while (i < src.length) {
    const ch = src[i];

    // Whitespace
    if (ch === ' ' || ch === '\t') {
      i++;
      continue;
    }

    // String literal
    if (ch === '"') {
      let str = '';
      i++;
      while (i < src.length && src[i] !== '"') {
        str += src[i];
        i++;
      }
      i++; // skip closing "
      tokens.push({ type: 'STRING', value: str });
      continue;
    }

    // Number
    if ((ch >= '0' && ch <= '9') || (ch === '.' && i + 1 < src.length && src[i + 1] >= '0' && src[i + 1] <= '9')) {
      let num = '';
      while (i < src.length && ((src[i] >= '0' && src[i] <= '9') || src[i] === '.')) {
        num += src[i];
        i++;
      }
      // Handle scientific notation
      if (i < src.length && (src[i] === 'e' || src[i] === 'E')) {
        num += src[i];
        i++;
        if (i < src.length && (src[i] === '+' || src[i] === '-')) {
          num += src[i];
          i++;
        }
        while (i < src.length && src[i] >= '0' && src[i] <= '9') {
          num += src[i];
          i++;
        }
      }
      tokens.push({ type: 'NUMBER', value: num });
      continue;
    }

    // Cell ref or function name (both start with uppercase letter or $)
    if (ch === '$' || (ch >= 'A' && ch <= 'Z')) {
      const rest = src.slice(i);

      // Try cell reference first (with optional $)
      const cellMatch = rest.match(CELL_REF_REGEX);
      if (cellMatch) {
        const cellRef = cellMatch[0];
        // Check if it's followed by ( → function call instead
        if (src[i + cellRef.length] === '(') {
          // It's a function name like SUM(
          const funcMatch = rest.match(FUNC_OR_CELL);
          if (funcMatch) {
            tokens.push({ type: 'FUNCTION', value: funcMatch[0] });
            i += funcMatch[0].length;
            continue;
          }
        }
        // Check if followed by : → it's a range start
        if (src[i + cellRef.length] === ':') {
          const afterColon = src.slice(i + cellRef.length + 1);
          const endMatch = afterColon.match(CELL_REF_REGEX);
          if (endMatch) {
            tokens.push({
              type: 'RANGE_REF',
              value: cellRef + ':' + endMatch[0],
            });
            i += cellRef.length + 1 + endMatch[0].length;
            continue;
          }
        }
        tokens.push({ type: 'CELL_REF', value: cellRef });
        i += cellRef.length;
        continue;
      }

      // Might be a function name like SUM, IF
      const funcMatch = rest.match(FUNC_OR_CELL);
      if (funcMatch) {
        tokens.push({ type: 'FUNCTION', value: funcMatch[0] });
        i += funcMatch[0].length;
        continue;
      }

      // $ followed by something unexpected
      i++;
      continue;
    }

    // Operators
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '^' || ch === '&') {
      tokens.push({ type: 'OPERATOR', value: ch });
      i++;
      continue;
    }

    // Comparison operators
    if (ch === '<') {
      if (i + 1 < src.length && src[i + 1] === '>') {
        tokens.push({ type: 'OPERATOR', value: '<>' });
        i += 2;
      } else if (i + 1 < src.length && src[i + 1] === '=') {
        tokens.push({ type: 'OPERATOR', value: '<=' });
        i += 2;
      } else {
        tokens.push({ type: 'OPERATOR', value: '<' });
        i++;
      }
      continue;
    }

    if (ch === '>') {
      if (i + 1 < src.length && src[i + 1] === '=') {
        tokens.push({ type: 'OPERATOR', value: '>=' });
        i += 2;
      } else {
        tokens.push({ type: 'OPERATOR', value: '>' });
        i++;
      }
      continue;
    }

    if (ch === '=') {
      tokens.push({ type: 'OPERATOR', value: '=' });
      i++;
      continue;
    }

    // Parentheses
    if (ch === '(') {
      tokens.push({ type: 'LPAREN', value: '(' });
      i++;
      continue;
    }

    if (ch === ')') {
      tokens.push({ type: 'RPAREN', value: ')' });
      i++;
      continue;
    }

    // Comma
    if (ch === ',') {
      tokens.push({ type: 'COMMA', value: ',' });
      i++;
      continue;
    }

    // Colon (standalone, for ranges constructed differently)
    if (ch === ':') {
      tokens.push({ type: 'COLON', value: ':' });
      i++;
      continue;
    }

    // Unknown character - skip
    i++;
  }

  tokens.push({ type: 'EOF', value: '' });
  return tokens;
}

// ===== Parser (recursive descent) =====

/**
 * Parse a formula string into an AST.
 * Returns an ErrorNode if the formula has syntax errors.
 */
export function parseFormula(formula: string): ASTNode {
  if (!formula || !formula.startsWith('=')) {
    return { kind: 'error', message: 'Formula must start with =' };
  }

  try {
    const tokens = tokenize(formula);
    const parser = new Parser(tokens);
    const result = parser.parseExpression();
    return result;
  } catch (e) {
    return { kind: 'error', message: (e as Error).message || 'Parse error' };
  }
}

class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.pos] || { type: 'EOF', value: '' };
  }

  private consume(): Token {
    const t = this.tokens[this.pos];
    this.pos++;
    return t;
  }

  private expect(type: TokenType): Token {
    const t = this.peek();
    if (t.type !== type) {
      throw new Error(`Expected ${type}, got ${t.type} ("${t.value}")`);
    }
    return this.consume();
  }

  parseExpression(): ASTNode {
    return this.parseComparison();
  }

  // Comparison: = <> < > <= >=
  private parseComparison(): ASTNode {
    let left = this.parseConcat();
    while (
      this.peek().type === 'OPERATOR' &&
      ['=', '<>', '<', '>', '<=', '>='].includes(this.peek().value)
    ) {
      const op = this.consume().value;
      const right = this.parseConcat();
      left = { kind: 'binaryOp', op, left, right };
    }
    return left;
  }

  // Concatenation: &
  private parseConcat(): ASTNode {
    let left = this.parseAddSub();
    while (this.peek().type === 'OPERATOR' && this.peek().value === '&') {
      this.consume();
      const right = this.parseAddSub();
      left = { kind: 'binaryOp', op: '&', left, right };
    }
    return left;
  }

  // Addition/Subtraction: + -
  private parseAddSub(): ASTNode {
    let left = this.parseMulDiv();
    while (
      this.peek().type === 'OPERATOR' &&
      (this.peek().value === '+' || this.peek().value === '-')
    ) {
      const op = this.consume().value;
      const right = this.parseMulDiv();
      left = { kind: 'binaryOp', op, left, right };
    }
    return left;
  }

  // Multiplication/Division: * /
  private parseMulDiv(): ASTNode {
    let left = this.parsePower();
    while (
      this.peek().type === 'OPERATOR' &&
      (this.peek().value === '*' || this.peek().value === '/')
    ) {
      const op = this.consume().value;
      const right = this.parsePower();
      left = { kind: 'binaryOp', op, left, right };
    }
    return left;
  }

  // Power: ^
  private parsePower(): ASTNode {
    let left = this.parseUnary();
    while (this.peek().type === 'OPERATOR' && this.peek().value === '^') {
      this.consume();
      const right = this.parseUnary();
      left = { kind: 'binaryOp', op: '^', left, right };
    }
    return left;
  }

  // Unary: -expr
  private parseUnary(): ASTNode {
    if (this.peek().type === 'OPERATOR' && this.peek().value === '-') {
      this.consume();
      const operand = this.parsePrimary();
      return { kind: 'unaryOp', op: '-', operand };
    }
    return this.parsePrimary();
  }

  // Primary: number, string, cell ref, range ref, function call, (expr)
  private parsePrimary(): ASTNode {
    const t = this.peek();

    if (t.type === 'NUMBER') {
      this.consume();
      return { kind: 'number', value: parseFloat(t.value) };
    }

    if (t.type === 'STRING') {
      this.consume();
      return { kind: 'string', value: t.value };
    }

    if (t.type === 'RANGE_REF') {
      this.consume();
      const [start, end] = t.value.split(':');
      return { kind: 'rangeRef', start, end };
    }

    if (t.type === 'CELL_REF') {
      this.consume();
      return { kind: 'cellRef', ref: t.value };
    }

    if (t.type === 'FUNCTION') {
      const name = this.consume().value;
      this.expect('LPAREN');
      const args: ASTNode[] = [];
      if (this.peek().type !== 'RPAREN') {
        args.push(this.parseExpression());
        while (this.peek().type === 'COMMA') {
          this.consume();
          args.push(this.parseExpression());
        }
      }
      this.expect('RPAREN');
      return { kind: 'functionCall', name, args };
    }

    if (t.type === 'LPAREN') {
      this.consume();
      const expr = this.parseExpression();
      this.expect('RPAREN');
      return expr;
    }

    throw new Error(`Unexpected token: ${t.type} ("${t.value}")`);
  }
}
