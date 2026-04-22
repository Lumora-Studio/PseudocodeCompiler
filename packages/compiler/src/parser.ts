import {
  ArrayAccessNode,
  BasicTypeName,
  Diagnostic,
  ExpressionNode,
  FunctionDefinitionNode,
  IdentifierNode,
  LiteralNode,
  ParameterNode,
  ProgramNode,
  SourceSpan,
  StatementNode,
  TypeNode,
} from "./types";
import { Token, tokenize } from "./tokenizer";

const BUILTIN_FUNCTIONS = new Set([
  "DIV",
  "MOD",
  "LENGTH",
  "LCASE",
  "UCASE",
  "SUBSTRING",
  "ROUND",
  "RANDOM",
]);

const BASIC_TYPES = new Set<BasicTypeName>(["INTEGER", "REAL", "CHAR", "STRING", "BOOLEAN"]);

type BinaryOp = {
  precedence: number;
  rightAssociative?: boolean;
};

const BINARY_OPERATORS: Record<string, BinaryOp> = {
  OR: { precedence: 1 },
  AND: { precedence: 2 },
  "=": { precedence: 3 },
  "<": { precedence: 3 },
  "<=": { precedence: 3 },
  ">": { precedence: 3 },
  ">=": { precedence: 3 },
  "<>": { precedence: 3 },
  "+": { precedence: 4 },
  "-": { precedence: 4 },
  "*": { precedence: 5 },
  "/": { precedence: 5 },
  "^": { precedence: 6, rightAssociative: true },
};

function spanFrom(start: SourceSpan, end: SourceSpan): SourceSpan {
  return {
    startLine: start.startLine,
    startColumn: start.startColumn,
    endLine: end.endLine,
    endColumn: end.endColumn,
  };
}

function createFallbackSpan(): SourceSpan {
  return { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 };
}

class Parser {
  private tokens: Token[];
  private index = 0;
  diagnostics: Diagnostic[];

  constructor(tokens: Token[], diagnostics: Diagnostic[]) {
    this.tokens = tokens;
    this.diagnostics = diagnostics;
  }

  parseProgram(): ProgramNode {
    const start = this.current().span;
    const body = this.parseStatements(new Set(["EOF"]));
    const end = this.previous().span;
    return {
      kind: "program",
      body,
      span: spanFrom(start, end),
    };
  }

  private parseStatements(stopKeywords: Set<string>): StatementNode[] {
    const statements: StatementNode[] = [];
    this.consumeNewlines();

    while (!this.isAtEnd()) {
      const token = this.current();
      if (token.type === "KEYWORD" && token.keyword && stopKeywords.has(token.keyword)) {
        break;
      }
      if (token.type === "EOF") {
        break;
      }

      const statement = this.parseStatement();
      if (statement) {
        statements.push(statement);
      } else {
        this.synchronizeLine();
      }
      this.consumeNewlines();
    }

    return statements;
  }

  private parseStatement(): StatementNode | null {
    const token = this.current();
    if (token.type === "KEYWORD") {
      switch (token.keyword) {
        case "DECLARE":
          return this.parseDeclareStatement();
        case "CONSTANT":
          return this.parseConstantStatement();
        case "INPUT":
          return this.parseInputStatement();
        case "OUTPUT":
          return this.parseOutputStatement();
        case "IF":
          return this.parseIfStatement();
        case "CASE":
          return this.parseCaseStatement();
        case "FOR":
          return this.parseForStatement();
        case "REPEAT":
          return this.parseRepeatStatement();
        case "WHILE":
          return this.parseWhileStatement();
        case "PROCEDURE":
          return this.parseProcedureDefinition();
        case "FUNCTION":
          return this.parseFunctionDefinition();
        case "CALL":
          return this.parseCallStatement();
        case "RETURN":
          return this.parseReturnStatement();
        case "OPENFILE":
          return this.parseOpenFileStatement();
        case "READFILE":
          return this.parseReadFileStatement();
        case "WRITEFILE":
          return this.parseWriteFileStatement();
        case "CLOSEFILE":
          return this.parseCloseFileStatement();
        default:
          this.error(token, "SYN003", `Unexpected keyword \"${token.keyword}\".`);
          return null;
      }
    }

    if (token.type === "IDENTIFIER") {
      return this.parseAssignmentStatement();
    }

    this.error(token, "SYN004", "Expected a valid statement.");
    return null;
  }

  private parseDeclareStatement(): StatementNode | null {
    const start = this.expectKeyword("DECLARE", "SYN010");
    const identifier = this.parseIdentifier();
    if (!identifier) {
      return null;
    }

    this.expectType("COLON", "SYN011", "Expected ':' after identifier in DECLARE statement.");
    const typeNode = this.parseTypeNode();
    if (!typeNode) {
      return null;
    }

    return {
      kind: "declare",
      identifier,
      typeNode,
      span: spanFrom(start.span, typeNode.span),
    };
  }

  private parseConstantStatement(): StatementNode | null {
    const start = this.expectKeyword("CONSTANT", "SYN012");
    const identifier = this.parseIdentifier();
    if (!identifier) {
      return null;
    }

    this.expectType("ASSIGN", "SYN013", "Expected assignment operator in CONSTANT declaration.");
    const value = this.parseExpression();

    return {
      kind: "constant",
      identifier,
      value,
      span: spanFrom(start.span, value.span),
    };
  }

  private parseInputStatement(): StatementNode | null {
    const start = this.expectKeyword("INPUT", "SYN014");
    const target = this.parseAssignableTarget();
    if (!target) {
      return null;
    }
    return {
      kind: "input",
      target,
      span: spanFrom(start.span, target.span),
    };
  }

  private parseOutputStatement(): StatementNode {
    const start = this.expectKeyword("OUTPUT", "SYN015");
    const values: ExpressionNode[] = [];
    values.push(this.parseExpression());
    while (this.matchType("COMMA")) {
      values.push(this.parseExpression());
    }

    const endSpan = values.length > 0 ? values[values.length - 1].span : start.span;
    return {
      kind: "output",
      values,
      span: spanFrom(start.span, endSpan),
    };
  }

  private parseIfStatement(): StatementNode {
    const start = this.expectKeyword("IF", "SYN016");
    const condition = this.parseExpression();
    this.consumeNewlines();
    this.expectKeyword("THEN", "SYN017", "Expected THEN in IF statement.");
    this.consumeNewlines();

    const thenBody = this.parseStatements(new Set(["ELSE", "ENDIF"]));
    let elseBody: StatementNode[] = [];

    if (this.matchKeyword("ELSE")) {
      this.consumeNewlines();
      elseBody = this.parseStatements(new Set(["ENDIF"]));
    }

    const endIf = this.expectKeyword("ENDIF", "SYN018", "Expected ENDIF to close IF statement.");

    return {
      kind: "if",
      condition,
      thenBody,
      elseBody,
      span: spanFrom(start.span, endIf.span),
    };
  }

  private parseCaseStatement(): StatementNode {
    const start = this.expectKeyword("CASE", "SYN019");
    this.expectKeyword("OF", "SYN020", "Expected OF in CASE statement.");
    const expression = this.parseExpression();
    this.consumeNewlines();

    const clauses: Array<{ value: ExpressionNode | null; statement: StatementNode; span: SourceSpan }> = [];

    while (!this.isAtEnd() && !this.checkKeyword("ENDCASE")) {
      const clauseStart = this.current().span;
      if (this.matchKeyword("OTHERWISE")) {
        const statement = this.parseStatementAfterCaseColon();
        if (statement) {
          clauses.push({ value: null, statement, span: spanFrom(clauseStart, statement.span) });
        }
      } else {
        const value = this.parseExpression();
        this.expectType("COLON", "SYN021", "Expected ':' after CASE value.");
        const statement = this.parseStatementAfterCaseColon();
        if (statement) {
          clauses.push({ value, statement, span: spanFrom(clauseStart, statement.span) });
        }
      }
      this.consumeNewlines();
    }

    const endCase = this.expectKeyword("ENDCASE", "SYN022", "Expected ENDCASE to close CASE statement.");

    return {
      kind: "case",
      expression,
      clauses,
      span: spanFrom(start.span, endCase.span),
    };
  }

  private parseStatementAfterCaseColon(): StatementNode | null {
    if (this.current().type === "NEWLINE") {
      this.error(this.current(), "SYN023", "CASE clause requires a statement on the same line.");
      return null;
    }
    return this.parseStatement();
  }

  private parseForStatement(): StatementNode {
    const start = this.expectKeyword("FOR", "SYN024");
    const iterator = this.parseIdentifier() ?? {
      kind: "identifier",
      name: "InvalidIterator",
      span: start.span,
    };

    this.expectType("ASSIGN", "SYN025", "Expected assignment operator in FOR statement.");
    const startValue = this.parseExpression();
    this.expectKeyword("TO", "SYN026", "Expected TO in FOR statement.");
    const endValue = this.parseExpression();

    let stepValue: ExpressionNode | null = null;
    if (this.matchKeyword("STEP")) {
      stepValue = this.parseExpression();
    }

    this.consumeNewlines();
    const body = this.parseStatements(new Set(["NEXT"]));
    this.expectKeyword("NEXT", "SYN027", "Expected NEXT to close FOR loop.");

    if (this.current().type === "IDENTIFIER") {
      const closingIterator = this.advance();
      if (closingIterator.lexeme.toLowerCase() !== iterator.name.toLowerCase()) {
        this.error(
          closingIterator,
          "SYN028",
          `Iterator mismatch: expected ${iterator.name} after NEXT, found ${closingIterator.lexeme}.`,
        );
      }
    }

    const end = this.previous().span;
    return {
      kind: "for",
      iterator,
      startValue,
      endValue,
      stepValue,
      body,
      span: spanFrom(start.span, end),
    };
  }

  private parseRepeatStatement(): StatementNode {
    const start = this.expectKeyword("REPEAT", "SYN029");
    this.consumeNewlines();
    const body = this.parseStatements(new Set(["UNTIL"]));
    this.expectKeyword("UNTIL", "SYN030", "Expected UNTIL to close REPEAT loop.");
    const condition = this.parseExpression();

    return {
      kind: "repeat",
      body,
      condition,
      span: spanFrom(start.span, condition.span),
    };
  }

  private parseWhileStatement(): StatementNode {
    const start = this.expectKeyword("WHILE", "SYN031");
    const condition = this.parseExpression();
    this.consumeNewlines();
    this.expectKeyword("DO", "SYN032", "Expected DO in WHILE loop.");
    this.consumeNewlines();
    const body = this.parseStatements(new Set(["ENDWHILE"]));
    const end = this.expectKeyword("ENDWHILE", "SYN033", "Expected ENDWHILE to close WHILE loop.");

    return {
      kind: "while",
      condition,
      body,
      span: spanFrom(start.span, end.span),
    };
  }

  private parseProcedureDefinition(): StatementNode {
    const start = this.expectKeyword("PROCEDURE", "SYN034");
    const nameToken = this.expectType("IDENTIFIER", "SYN035", "Expected procedure identifier.");
    const params = this.parseParameterList();
    this.consumeNewlines();

    const body = this.parseStatements(new Set(["ENDPROCEDURE"]));
    const end = this.expectKeyword("ENDPROCEDURE", "SYN036", "Expected ENDPROCEDURE.");

    return {
      kind: "procedureDefinition",
      name: nameToken.lexeme,
      params,
      body,
      span: spanFrom(start.span, end.span),
    };
  }

  private parseFunctionDefinition(): FunctionDefinitionNode {
    const start = this.expectKeyword("FUNCTION", "SYN037");
    const nameToken = this.expectType("IDENTIFIER", "SYN038", "Expected function identifier.");
    const params = this.parseParameterList();

    this.expectKeyword("RETURNS", "SYN039", "Expected RETURNS in function definition.");
    const returnTypeToken = this.expectType("KEYWORD", "SYN040", "Expected return data type after RETURNS.");
    const returnType = BASIC_TYPES.has(returnTypeToken.keyword as BasicTypeName)
      ? (returnTypeToken.keyword as BasicTypeName)
      : "INTEGER";

    if (!BASIC_TYPES.has(returnTypeToken.keyword as BasicTypeName)) {
      this.error(returnTypeToken, "SYN041", "Function return type must be a basic pseudocode data type.");
    }

    this.consumeNewlines();
    const body = this.parseStatements(new Set(["ENDFUNCTION"]));
    const end = this.expectKeyword("ENDFUNCTION", "SYN042", "Expected ENDFUNCTION.");

    return {
      kind: "functionDefinition",
      name: nameToken.lexeme,
      params,
      returnType,
      body,
      span: spanFrom(start.span, end.span),
    };
  }

  private parseCallStatement(): StatementNode {
    const start = this.expectKeyword("CALL", "SYN043");
    const nameToken = this.expectType("IDENTIFIER", "SYN044", "Expected procedure identifier after CALL.");

    const args: ExpressionNode[] = [];
    if (this.matchType("LPAREN")) {
      if (!this.checkType("RPAREN")) {
        args.push(this.parseExpression());
        while (this.matchType("COMMA")) {
          args.push(this.parseExpression());
        }
      }
      this.expectType("RPAREN", "SYN045", "Expected ')' after CALL arguments.");
    }

    const endSpan = args.length > 0 ? args[args.length - 1].span : nameToken.span;
    return {
      kind: "callStatement",
      name: nameToken.lexeme,
      args,
      span: spanFrom(start.span, endSpan),
    };
  }

  private parseReturnStatement(): StatementNode {
    const start = this.expectKeyword("RETURN", "SYN046");
    const value = this.parseExpression();
    return {
      kind: "return",
      value,
      span: spanFrom(start.span, value.span),
    };
  }

  private parseOpenFileStatement(): StatementNode {
    const start = this.expectKeyword("OPENFILE", "SYN047");
    const fileIdentifier = this.parseExpression();
    this.expectKeyword("FOR", "SYN048", "Expected FOR in OPENFILE statement.");

    const modeToken = this.expectType("KEYWORD", "SYN049", "Expected READ or WRITE file mode.");
    const mode = modeToken.keyword === "READ" || modeToken.keyword === "WRITE" ? modeToken.keyword : "READ";
    if (modeToken.keyword !== "READ" && modeToken.keyword !== "WRITE") {
      this.error(modeToken, "SYN050", "File mode must be READ or WRITE.");
    }

    return {
      kind: "openfile",
      fileIdentifier,
      mode,
      span: spanFrom(start.span, modeToken.span),
    };
  }

  private parseReadFileStatement(): StatementNode | null {
    const start = this.expectKeyword("READFILE", "SYN051");
    const fileIdentifier = this.parseExpression();
    this.expectType("COMMA", "SYN052", "Expected comma in READFILE statement.");
    const target = this.parseAssignableTarget();
    if (!target) {
      return null;
    }

    return {
      kind: "readfile",
      fileIdentifier,
      target,
      span: spanFrom(start.span, target.span),
    };
  }

  private parseWriteFileStatement(): StatementNode {
    const start = this.expectKeyword("WRITEFILE", "SYN053");
    const fileIdentifier = this.parseExpression();
    this.expectType("COMMA", "SYN054", "Expected comma in WRITEFILE statement.");
    const value = this.parseExpression();

    return {
      kind: "writefile",
      fileIdentifier,
      value,
      span: spanFrom(start.span, value.span),
    };
  }

  private parseCloseFileStatement(): StatementNode {
    const start = this.expectKeyword("CLOSEFILE", "SYN055");
    const fileIdentifier = this.parseExpression();

    return {
      kind: "closefile",
      fileIdentifier,
      span: spanFrom(start.span, fileIdentifier.span),
    };
  }

  private parseAssignmentStatement(): StatementNode | null {
    const target = this.parseAssignableTarget();
    if (!target) {
      return null;
    }

    this.expectType("ASSIGN", "SYN056", "Expected assignment operator after target identifier.");
    const value = this.parseExpression();

    return {
      kind: "assignment",
      target,
      value,
      span: spanFrom(target.span, value.span),
    };
  }

  private parseAssignableTarget(): IdentifierNode | ArrayAccessNode | null {
    const identifierToken = this.expectType("IDENTIFIER", "SYN057", "Expected identifier.");
    if (!identifierToken) {
      return null;
    }

    if (this.matchType("LBRACKET")) {
      const indices: ExpressionNode[] = [];
      indices.push(this.parseExpression());
      while (this.matchType("COMMA")) {
        indices.push(this.parseExpression());
      }
      const endBracket = this.expectType("RBRACKET", "SYN058", "Expected closing ']' in array access.");
      return {
        kind: "arrayAccess",
        name: identifierToken.lexeme,
        indices,
        span: spanFrom(identifierToken.span, endBracket.span),
      };
    }

    return {
      kind: "identifier",
      name: identifierToken.lexeme,
      span: identifierToken.span,
    };
  }

  private parseExpression(minPrecedence = 1): ExpressionNode {
    let left = this.parseUnary();

    while (true) {
      const operator = this.peekBinaryOperator();
      if (!operator) {
        break;
      }
      const opInfo = BINARY_OPERATORS[operator.value];
      if (!opInfo || opInfo.precedence < minPrecedence) {
        break;
      }

      const opToken = this.advance();
      const nextMinPrecedence = opInfo.rightAssociative ? opInfo.precedence : opInfo.precedence + 1;
      const right = this.parseExpression(nextMinPrecedence);

      left = {
        kind: "binary",
        operator: operator.value,
        left,
        right,
        span: spanFrom(left.span, right.span),
      };

      if (opToken.type === "EOF") {
        break;
      }
    }

    return left;
  }

  private parseUnary(): ExpressionNode {
    if (this.matchType("MINUS")) {
      const operatorToken = this.previous();
      const operand = this.parseUnary();
      return {
        kind: "unary",
        operator: "-",
        operand,
        span: spanFrom(operatorToken.span, operand.span),
      };
    }

    if (this.matchKeyword("NOT")) {
      const operatorToken = this.previous();
      const operand = this.parseUnary();
      return {
        kind: "unary",
        operator: "NOT",
        operand,
        span: spanFrom(operatorToken.span, operand.span),
      };
    }

    return this.parsePrimary();
  }

  private parsePrimary(): ExpressionNode {
    const token = this.current();

    if (this.matchType("INTEGER_LITERAL")) {
      const value = Number.parseInt(token.lexeme, 10);
      return this.literalNode(token, value, "INTEGER");
    }

    if (this.matchType("REAL_LITERAL")) {
      const value = Number.parseFloat(token.lexeme);
      return this.literalNode(token, value, "REAL");
    }

    if (this.matchType("STRING_LITERAL")) {
      const value = token.lexeme.slice(1, -1);
      return this.literalNode(token, value, "STRING");
    }

    if (this.matchType("CHAR_LITERAL")) {
      const value = token.lexeme.slice(1, -1);
      return this.literalNode(token, value, "CHAR");
    }

    if (token.type === "KEYWORD" && (token.keyword === "TRUE" || token.keyword === "FALSE")) {
      this.advance();
      return this.literalNode(token, token.keyword === "TRUE", "BOOLEAN");
    }

    if (this.matchType("LPAREN")) {
      const start = this.previous().span;
      const expression = this.parseExpression();
      const end = this.expectType("RPAREN", "SYN059", "Expected ')' to close expression.");
      return {
        ...expression,
        span: spanFrom(start, end.span),
      };
    }

    if (token.type === "IDENTIFIER" || (token.type === "KEYWORD" && token.keyword && BUILTIN_FUNCTIONS.has(token.keyword))) {
      this.advance();
      return this.parseIdentifierOrCall(token);
    }

    this.error(token, "SYN060", "Expected expression.");
    this.advance();
    return {
      kind: "literal",
      value: 0,
      literalType: "INTEGER",
      span: token.span,
    };
  }

  private parseIdentifierOrCall(token: Token): ExpressionNode {
    if (this.matchType("LPAREN")) {
      const args: ExpressionNode[] = [];
      if (!this.checkType("RPAREN")) {
        args.push(this.parseExpression());
        while (this.matchType("COMMA")) {
          args.push(this.parseExpression());
        }
      }
      const endParen = this.expectType("RPAREN", "SYN061", "Expected ')' after function call arguments.");
      return {
        kind: "call",
        name: token.keyword ?? token.lexeme,
        args,
        span: spanFrom(token.span, endParen.span),
      };
    }

    if (this.matchType("LBRACKET")) {
      const indices: ExpressionNode[] = [];
      indices.push(this.parseExpression());
      while (this.matchType("COMMA")) {
        indices.push(this.parseExpression());
      }
      const endBracket = this.expectType("RBRACKET", "SYN062", "Expected closing ']' in array access.");
      return {
        kind: "arrayAccess",
        name: token.lexeme,
        indices,
        span: spanFrom(token.span, endBracket.span),
      };
    }

    return {
      kind: "identifier",
      name: token.lexeme,
      span: token.span,
    };
  }

  private parseTypeNode(): TypeNode | null {
    if (this.matchKeyword("ARRAY")) {
      const arrayKeyword = this.previous();
      this.expectType("LBRACKET", "SYN063", "Expected '[' after ARRAY keyword.");

      const dimensions: Array<{ lower: number; upper: number }> = [];
      dimensions.push(this.parseArrayDimension());
      if (this.matchType("COMMA")) {
        dimensions.push(this.parseArrayDimension());
      }

      this.expectType("RBRACKET", "SYN064", "Expected closing ']' in ARRAY declaration.");
      this.expectKeyword("OF", "SYN065", "Expected OF in ARRAY declaration.");

      const elementTypeToken = this.expectType("KEYWORD", "SYN066", "Expected array element data type.");
      if (!BASIC_TYPES.has(elementTypeToken.keyword as BasicTypeName)) {
        this.error(elementTypeToken, "SYN067", "Array element type must be a basic data type.");
      }

      return {
        kind: "array",
        elementType: BASIC_TYPES.has(elementTypeToken.keyword as BasicTypeName)
          ? (elementTypeToken.keyword as BasicTypeName)
          : "INTEGER",
        dimensions,
        span: spanFrom(arrayKeyword.span, elementTypeToken.span),
      };
    }

    const token = this.expectType("KEYWORD", "SYN068", "Expected data type.");
    if (!BASIC_TYPES.has(token.keyword as BasicTypeName)) {
      this.error(token, "SYN069", "Expected one of INTEGER, REAL, CHAR, STRING, BOOLEAN.");
      return {
        kind: "basic",
        name: "INTEGER",
        span: token.span,
      };
    }

    return {
      kind: "basic",
      name: token.keyword as BasicTypeName,
      span: token.span,
    };
  }

  private parseArrayDimension(): { lower: number; upper: number } {
    const lower = this.parseSignedIntegerLiteral("SYN070", "Expected lower array bound as an integer literal.");
    this.expectType("COLON", "SYN071", "Expected ':' between array bounds.");
    const upper = this.parseSignedIntegerLiteral("SYN072", "Expected upper array bound as an integer literal.");
    return { lower, upper };
  }

  private parseSignedIntegerLiteral(code: string, message: string): number {
    let sign = 1;
    if (this.matchType("MINUS")) {
      sign = -1;
    }

    const token = this.expectType("INTEGER_LITERAL", code, message);
    const value = Number.parseInt(token.lexeme, 10);
    return Number.isNaN(value) ? 0 : sign * value;
  }

  private parseParameterList(): ParameterNode[] {
    const params: ParameterNode[] = [];
    if (!this.matchType("LPAREN")) {
      return params;
    }

    if (!this.checkType("RPAREN")) {
      do {
        const nameToken = this.expectType("IDENTIFIER", "SYN073", "Expected parameter identifier.");
        this.expectType("COLON", "SYN074", "Expected ':' in parameter declaration.");
        const typeNode = this.parseTypeNode();
        if (!typeNode) {
          continue;
        }

        params.push({
          name: nameToken.lexeme,
          typeNode,
          span: spanFrom(nameToken.span, typeNode.span),
        });
      } while (this.matchType("COMMA"));
    }

    this.expectType("RPAREN", "SYN075", "Expected ')' after parameter list.");
    return params;
  }

  private parseIdentifier(): IdentifierNode | null {
    const token = this.matchType("IDENTIFIER") ? this.previous() : null;
    if (!token) {
      this.error(this.current(), "SYN076", "Expected identifier.");
      return null;
    }
    return {
      kind: "identifier",
      name: token.lexeme,
      span: token.span,
    };
  }

  private literalNode(token: Token, value: unknown, literalType: BasicTypeName): LiteralNode {
    return {
      kind: "literal",
      value: value as number | string | boolean,
      literalType,
      span: token.span,
    };
  }

  private peekBinaryOperator(): { value: string } | null {
    const token = this.current();
    if (token.type === "KEYWORD" && (token.keyword === "AND" || token.keyword === "OR")) {
      return { value: token.keyword };
    }

    const mapping: Partial<Record<Token["type"], string>> = {
      EQ: "=",
      LT: "<",
      LTE: "<=",
      GT: ">",
      GTE: ">=",
      NEQ: "<>",
      PLUS: "+",
      MINUS: "-",
      STAR: "*",
      SLASH: "/",
      CARET: "^",
    };

    const operator = mapping[token.type];
    if (!operator) {
      return null;
    }
    return { value: operator };
  }

  private synchronizeLine() {
    while (!this.isAtEnd() && this.current().type !== "NEWLINE") {
      this.advance();
    }
    this.consumeNewlines();
  }

  private consumeNewlines() {
    while (this.matchType("NEWLINE")) {
      // consume contiguous newlines
    }
  }

  private expectKeyword(keyword: string, code: string, message?: string): Token {
    if (this.checkKeyword(keyword)) {
      return this.advance();
    }
    const token = this.current();
    this.error(token, code, message ?? `Expected keyword ${keyword}.`);
    return token;
  }

  private expectType(type: Token["type"], code: string, message: string): Token {
    if (this.checkType(type)) {
      return this.advance();
    }
    const token = this.current();
    this.error(token, code, message);
    return token;
  }

  private checkKeyword(keyword: string): boolean {
    const token = this.current();
    return token.type === "KEYWORD" && token.keyword === keyword;
  }

  private matchKeyword(keyword: string): boolean {
    if (this.checkKeyword(keyword)) {
      this.advance();
      return true;
    }
    return false;
  }

  private checkType(type: Token["type"]): boolean {
    return this.current().type === type;
  }

  private matchType(type: Token["type"]): boolean {
    if (this.checkType(type)) {
      this.advance();
      return true;
    }
    return false;
  }

  private previous(): Token {
    return this.tokens[Math.max(0, this.index - 1)] ?? {
      type: "EOF",
      lexeme: "",
      span: createFallbackSpan(),
    };
  }

  private current(): Token {
    return this.tokens[this.index] ?? {
      type: "EOF",
      lexeme: "",
      span: createFallbackSpan(),
    };
  }

  private advance(): Token {
    if (!this.isAtEnd()) {
      this.index += 1;
    }
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.current().type === "EOF";
  }

  private error(token: Token, code: string, message: string) {
    this.diagnostics.push({
      code,
      message,
      severity: "error",
      line: token.span.startLine,
      column: token.span.startColumn,
      endLine: token.span.endLine,
      endColumn: token.span.endColumn,
    });
  }
}

export function parseSource(source: string): { ast: ProgramNode; diagnostics: Diagnostic[] } {
  const { tokens, diagnostics } = tokenize(source);
  const parser = new Parser(tokens, diagnostics);
  const ast = parser.parseProgram();
  return { ast, diagnostics: parser.diagnostics };
}
