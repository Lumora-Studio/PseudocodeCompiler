import { Diagnostic, SourceSpan } from "./types";

export type TokenType =
  | "EOF"
  | "NEWLINE"
  | "IDENTIFIER"
  | "INTEGER_LITERAL"
  | "REAL_LITERAL"
  | "STRING_LITERAL"
  | "CHAR_LITERAL"
  | "KEYWORD"
  | "ASSIGN"
  | "COLON"
  | "COMMA"
  | "LPAREN"
  | "RPAREN"
  | "LBRACKET"
  | "RBRACKET"
  | "PLUS"
  | "MINUS"
  | "STAR"
  | "SLASH"
  | "CARET"
  | "EQ"
  | "LT"
  | "LTE"
  | "GT"
  | "GTE"
  | "NEQ";

export interface Token {
  type: TokenType;
  lexeme: string;
  keyword?: string;
  span: SourceSpan;
}

const KEYWORDS = new Set([
  "DECLARE",
  "CONSTANT",
  "ARRAY",
  "OF",
  "INTEGER",
  "REAL",
  "CHAR",
  "STRING",
  "BOOLEAN",
  "INPUT",
  "OUTPUT",
  "IF",
  "THEN",
  "ELSE",
  "ENDIF",
  "CASE",
  "OTHERWISE",
  "ENDCASE",
  "FOR",
  "TO",
  "STEP",
  "NEXT",
  "REPEAT",
  "UNTIL",
  "WHILE",
  "DO",
  "ENDWHILE",
  "PROCEDURE",
  "ENDPROCEDURE",
  "FUNCTION",
  "RETURNS",
  "ENDFUNCTION",
  "CALL",
  "RETURN",
  "OPENFILE",
  "READFILE",
  "WRITEFILE",
  "CLOSEFILE",
  "READ",
  "WRITE",
  "TRUE",
  "FALSE",
  "AND",
  "OR",
  "NOT",
  "DIV",
  "MOD",
  "LENGTH",
  "LCASE",
  "UCASE",
  "SUBSTRING",
  "ROUND",
  "RANDOM",
]);

function buildSpan(
  startLine: number,
  startColumn: number,
  endLine: number,
  endColumn: number,
): SourceSpan {
  return { startLine, startColumn, endLine, endColumn };
}

export function tokenize(source: string): { tokens: Token[]; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];
  const tokens: Token[] = [];

  let index = 0;
  let line = 1;
  let column = 1;

  const current = () => source[index] ?? "\0";
  const peek = (offset = 1) => source[index + offset] ?? "\0";

  const advance = () => {
    const char = current();
    index += 1;
    if (char === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
    return char;
  };

  const addToken = (
    type: TokenType,
    lexeme: string,
    startLine: number,
    startColumn: number,
    endLine: number,
    endColumn: number,
    keyword?: string,
  ) => {
    tokens.push({
      type,
      lexeme,
      keyword,
      span: buildSpan(startLine, startColumn, endLine, endColumn),
    });
  };

  while (index < source.length) {
    const char = current();

    if (char === " " || char === "\t" || char === "\r") {
      advance();
      continue;
    }

    if (char === "\n") {
      const startLine = line;
      const startColumn = column;
      advance();
      addToken("NEWLINE", "\\n", startLine, startColumn, startLine, startColumn);
      continue;
    }

    if (char === "/" && peek() === "/") {
      while (current() !== "\n" && current() !== "\0") {
        advance();
      }
      continue;
    }

    const startLine = line;
    const startColumn = column;

    if (char === "←" || (char === "<" && peek() === "-")) {
      const lexeme = char === "←" ? advance() : `${advance()}${advance()}`;
      addToken("ASSIGN", lexeme, startLine, startColumn, line, column - 1);
      continue;
    }

    if (char === "<" && peek() === "=") {
      advance();
      advance();
      addToken("LTE", "<=", startLine, startColumn, line, column - 1);
      continue;
    }
    if (char === ">" && peek() === "=") {
      advance();
      advance();
      addToken("GTE", ">=", startLine, startColumn, line, column - 1);
      continue;
    }
    if (char === "<" && peek() === ">") {
      advance();
      advance();
      addToken("NEQ", "<>", startLine, startColumn, line, column - 1);
      continue;
    }

    const singleCharTokens: Record<string, TokenType> = {
      ":": "COLON",
      ",": "COMMA",
      "(": "LPAREN",
      ")": "RPAREN",
      "[": "LBRACKET",
      "]": "RBRACKET",
      "+": "PLUS",
      "-": "MINUS",
      "*": "STAR",
      "/": "SLASH",
      "^": "CARET",
      "=": "EQ",
      "<": "LT",
      ">": "GT",
    };

    if (singleCharTokens[char]) {
      advance();
      addToken(singleCharTokens[char], char, startLine, startColumn, line, column - 1);
      continue;
    }

    if (char === '"') {
      let lexeme = advance();
      while (current() !== '"' && current() !== "\n" && current() !== "\0") {
        lexeme += advance();
      }
      if (current() !== '"') {
        diagnostics.push({
          code: "SYN008",
          message: "Unterminated string literal.",
          severity: "error",
          line: startLine,
          column: startColumn,
          endLine: line,
          endColumn: column,
          hint: "String literals must end with a closing double quote.",
        });
      } else {
        lexeme += advance();
      }
      addToken("STRING_LITERAL", lexeme, startLine, startColumn, line, column - 1);
      continue;
    }

    if (char === "'" || char === "ꞌ") {
      const quote = char;
      let lexeme = advance();
      while (current() !== quote && current() !== "\n" && current() !== "\0") {
        lexeme += advance();
      }
      if (current() !== quote) {
        diagnostics.push({
          code: "SYN009",
          message: "Unterminated character literal.",
          severity: "error",
          line: startLine,
          column: startColumn,
          endLine: line,
          endColumn: column,
          hint: "Character literals must end with a closing single quote.",
        });
      } else {
        lexeme += advance();
      }
      addToken("CHAR_LITERAL", lexeme, startLine, startColumn, line, column - 1);
      continue;
    }

    if (/[0-9]/.test(char)) {
      let lexeme = "";
      while (/[0-9]/.test(current())) {
        lexeme += advance();
      }
      if (current() === "." && /[0-9]/.test(peek())) {
        lexeme += advance();
        while (/[0-9]/.test(current())) {
          lexeme += advance();
        }
        addToken("REAL_LITERAL", lexeme, startLine, startColumn, line, column - 1);
      } else {
        addToken("INTEGER_LITERAL", lexeme, startLine, startColumn, line, column - 1);
      }
      continue;
    }

    if (/[A-Za-z]/.test(char)) {
      let lexeme = "";
      while (/[A-Za-z0-9]/.test(current())) {
        lexeme += advance();
      }
      const upper = lexeme.toUpperCase();
      if (KEYWORDS.has(upper)) {
        if (lexeme !== upper) {
          diagnostics.push({
            code: "SYN001",
            message: `Keyword \"${upper}\" must be uppercase in strict mode.`,
            severity: "error",
            line: startLine,
            column: startColumn,
            endLine: line,
            endColumn: column - 1,
            hint: `Use \"${upper}\" exactly.`,
          });
        }
        addToken("KEYWORD", lexeme, startLine, startColumn, line, column - 1, upper);
      } else {
        addToken("IDENTIFIER", lexeme, startLine, startColumn, line, column - 1);
      }
      continue;
    }

    diagnostics.push({
      code: "SYN002",
      message: `Unexpected character \"${char}\".`,
      severity: "error",
      line,
      column,
      endLine: line,
      endColumn: column,
      hint: "Remove the character or replace it with valid IGCSE pseudocode syntax.",
    });
    advance();
  }

  addToken("EOF", "", line, column, line, column);
  return { tokens, diagnostics };
}
