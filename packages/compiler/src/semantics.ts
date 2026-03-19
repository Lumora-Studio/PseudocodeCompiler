import {
  ArrayAccessNode,
  Diagnostic,
  ExpressionNode,
  FunctionSignature,
  ProcedureSignature,
  ProgramNode,
  SemanticResult,
  SourceSpan,
  StatementNode,
  StaticType,
  TypeNode,
} from "./types";

interface SymbolEntry {
  name: string;
  kind: "variable" | "constant" | "param" | "procedure" | "function";
  type: StaticType;
  params?: StaticType[];
}

class Scope {
  private readonly symbols = new Map<string, SymbolEntry>();
  constructor(public readonly parent: Scope | null = null) {}

  define(symbol: SymbolEntry): boolean {
    const key = symbol.name.toLowerCase();
    if (this.symbols.has(key)) {
      return false;
    }
    this.symbols.set(key, symbol);
    return true;
  }

  lookup(name: string): SymbolEntry | null {
    const key = name.toLowerCase();
    if (this.symbols.has(key)) {
      return this.symbols.get(key) ?? null;
    }
    return this.parent?.lookup(name) ?? null;
  }

  entries(): SymbolEntry[] {
    return [...this.symbols.values()];
  }
}

const UNKNOWN: StaticType = { kind: "unknown" };
const BOOLEAN: StaticType = { kind: "basic", name: "BOOLEAN" };
const INTEGER: StaticType = { kind: "basic", name: "INTEGER" };
const REAL: StaticType = { kind: "basic", name: "REAL" };
const STRING: StaticType = { kind: "basic", name: "STRING" };

const BUILTIN_FUNCTIONS: Record<string, FunctionSignature> = {
  DIV: { name: "DIV", params: [INTEGER, INTEGER], returnType: INTEGER },
  MOD: { name: "MOD", params: [INTEGER, INTEGER], returnType: INTEGER },
  LENGTH: { name: "LENGTH", params: [STRING], returnType: INTEGER },
  LCASE: { name: "LCASE", params: [STRING], returnType: STRING },
  UCASE: { name: "UCASE", params: [STRING], returnType: STRING },
  SUBSTRING: { name: "SUBSTRING", params: [STRING, INTEGER, INTEGER], returnType: STRING },
  ROUND: { name: "ROUND", params: [REAL, INTEGER], returnType: REAL },
  RANDOM: { name: "RANDOM", params: [], returnType: REAL },
};

function toStaticType(typeNode: TypeNode): StaticType {
  if (typeNode.kind === "basic") {
    return { kind: "basic", name: typeNode.name };
  }
  return {
    kind: "array",
    elementType: typeNode.elementType,
    dimensions: typeNode.dimensions,
  };
}

function typeName(type: StaticType): string {
  if (type.kind === "unknown") {
    return "UNKNOWN";
  }
  if (type.kind === "basic") {
    return type.name;
  }
  return `ARRAY OF ${type.elementType}`;
}

function isNumeric(type: StaticType): boolean {
  return type.kind === "basic" && (type.name === "INTEGER" || type.name === "REAL");
}

function isBoolean(type: StaticType): boolean {
  return type.kind === "basic" && type.name === "BOOLEAN";
}

function typesCompatible(target: StaticType, value: StaticType): boolean {
  if (target.kind === "unknown" || value.kind === "unknown") {
    return true;
  }

  if (target.kind === "array" || value.kind === "array") {
    if (target.kind !== "array" || value.kind !== "array") {
      return false;
    }
    return (
      target.elementType === value.elementType &&
      target.dimensions.length === value.dimensions.length
    );
  }

  if (target.name === value.name) {
    return true;
  }

  if (target.name === "REAL" && value.name === "INTEGER") {
    return true;
  }

  return false;
}

class Analyzer {
  diagnostics: Diagnostic[] = [];
  symbolTypes: Record<string, StaticType> = {};
  functionSignatures: Record<string, FunctionSignature> = { ...BUILTIN_FUNCTIONS };
  procedureSignatures: Record<string, ProcedureSignature> = {};

  analyze(program: ProgramNode): SemanticResult {
    const globalScope = new Scope(null);

    this.predeclareRoutines(program.body, globalScope);
    this.analyzeStatements(program.body, globalScope, null, {});

    return {
      diagnostics: this.diagnostics,
      symbolTypes: this.symbolTypes,
      functionSignatures: this.functionSignatures,
      procedureSignatures: this.procedureSignatures,
    };
  }

  private predeclareRoutines(statements: StatementNode[], globalScope: Scope) {
    for (const statement of statements) {
      if (statement.kind === "procedureDefinition") {
        const params = statement.params.map((param) => toStaticType(param.typeNode));
        const signature: ProcedureSignature = { name: statement.name, params };
        const key = statement.name.toLowerCase();

        if (this.procedureSignatures[key] || this.functionSignatures[key]) {
          this.pushError(statement.span, "SEM001", `Duplicate routine name \"${statement.name}\".`);
          continue;
        }

        this.procedureSignatures[key] = signature;
        globalScope.define({
          name: statement.name,
          kind: "procedure",
          type: UNKNOWN,
          params,
        });
      }

      if (statement.kind === "functionDefinition") {
        const params = statement.params.map((param) => toStaticType(param.typeNode));
        const returnType: StaticType = { kind: "basic", name: statement.returnType };
        const signature: FunctionSignature = {
          name: statement.name,
          params,
          returnType,
        };
        const key = statement.name.toLowerCase();

        if (this.functionSignatures[key] || this.procedureSignatures[key]) {
          this.pushError(statement.span, "SEM001", `Duplicate routine name \"${statement.name}\".`);
          continue;
        }

        this.functionSignatures[key] = signature;
        globalScope.define({
          name: statement.name,
          kind: "function",
          type: returnType,
          params,
        });
      }
    }
  }

  private analyzeStatements(
    statements: StatementNode[],
    scope: Scope,
    currentFunctionReturnType: StaticType | null,
    openFiles: Record<string, "READ" | "WRITE">,
  ): boolean {
    let sawReturn = false;

    for (const statement of statements) {
      switch (statement.kind) {
        case "declare": {
          const declaredType = toStaticType(statement.typeNode);
          if (!scope.define({ name: statement.identifier.name, kind: "variable", type: declaredType })) {
            this.pushError(statement.span, "SEM002", `Duplicate identifier \"${statement.identifier.name}\" in scope.`);
          }
          this.symbolTypes[statement.identifier.name.toLowerCase()] = declaredType;
          break;
        }

        case "constant": {
          const valueType = this.inferExpressionType(statement.value, scope);
          if (!scope.define({ name: statement.identifier.name, kind: "constant", type: valueType })) {
            this.pushError(statement.span, "SEM002", `Duplicate identifier \"${statement.identifier.name}\" in scope.`);
          }
          this.symbolTypes[statement.identifier.name.toLowerCase()] = valueType;
          break;
        }

        case "assignment": {
          const targetType = this.resolveAssignableType(statement.target, scope);
          const valueType = this.inferExpressionType(statement.value, scope);
          if (!typesCompatible(targetType, valueType)) {
            this.pushError(
              statement.span,
              "SEM003",
              `Cannot assign ${typeName(valueType)} to ${typeName(targetType)}.`,
            );
          }
          break;
        }

        case "input": {
          this.resolveAssignableType(statement.target, scope);
          break;
        }

        case "output": {
          for (const value of statement.values) {
            this.inferExpressionType(value, scope);
          }
          break;
        }

        case "if": {
          const condType = this.inferExpressionType(statement.condition, scope);
          if (!isBoolean(condType)) {
            this.pushError(statement.condition.span, "SEM004", "IF condition must evaluate to BOOLEAN.");
          }
          this.analyzeStatements(statement.thenBody, new Scope(scope), currentFunctionReturnType, { ...openFiles });
          this.analyzeStatements(statement.elseBody, new Scope(scope), currentFunctionReturnType, { ...openFiles });
          break;
        }

        case "case": {
          this.inferExpressionType(statement.expression, scope);
          for (const clause of statement.clauses) {
            if (clause.value) {
              this.inferExpressionType(clause.value, scope);
            }
            this.analyzeStatements([clause.statement], new Scope(scope), currentFunctionReturnType, { ...openFiles });
          }
          break;
        }

        case "for": {
          const iteratorSymbol = scope.lookup(statement.iterator.name);
          if (!iteratorSymbol) {
            this.pushError(
              statement.iterator.span,
              "SEM005",
              `Loop iterator \"${statement.iterator.name}\" must be declared before use.`,
            );
          } else if (iteratorSymbol.type.kind !== "basic" || iteratorSymbol.type.name !== "INTEGER") {
            this.pushError(statement.iterator.span, "SEM006", "FOR iterator must be INTEGER.");
          }

          for (const expr of [statement.startValue, statement.endValue, ...(statement.stepValue ? [statement.stepValue] : [])]) {
            const type = this.inferExpressionType(expr, scope);
            if (!isNumeric(type)) {
              this.pushError(expr.span, "SEM007", "FOR bounds and STEP must be numeric.");
            }
          }

          this.analyzeStatements(statement.body, new Scope(scope), currentFunctionReturnType, { ...openFiles });
          break;
        }

        case "repeat": {
          this.analyzeStatements(statement.body, new Scope(scope), currentFunctionReturnType, { ...openFiles });
          const condType = this.inferExpressionType(statement.condition, scope);
          if (!isBoolean(condType)) {
            this.pushError(statement.condition.span, "SEM008", "UNTIL condition must evaluate to BOOLEAN.");
          }
          break;
        }

        case "while": {
          const condType = this.inferExpressionType(statement.condition, scope);
          if (!isBoolean(condType)) {
            this.pushError(statement.condition.span, "SEM009", "WHILE condition must evaluate to BOOLEAN.");
          }
          this.analyzeStatements(statement.body, new Scope(scope), currentFunctionReturnType, { ...openFiles });
          break;
        }

        case "procedureDefinition": {
          const procedureScope = new Scope(scope);
          for (const param of statement.params) {
            const paramType = toStaticType(param.typeNode);
            if (!procedureScope.define({ name: param.name, kind: "param", type: paramType })) {
              this.pushError(param.span, "SEM010", `Duplicate parameter \"${param.name}\".`);
            }
          }
          this.analyzeStatements(statement.body, procedureScope, null, {});
          break;
        }

        case "functionDefinition": {
          const functionScope = new Scope(scope);
          for (const param of statement.params) {
            const paramType = toStaticType(param.typeNode);
            if (!functionScope.define({ name: param.name, kind: "param", type: paramType })) {
              this.pushError(param.span, "SEM010", `Duplicate parameter \"${param.name}\".`);
            }
          }

          const returnType: StaticType = { kind: "basic", name: statement.returnType };
          const returned = this.analyzeStatements(statement.body, functionScope, returnType, {});
          if (!returned) {
            this.pushError(statement.span, "SEM011", `Function \"${statement.name}\" must contain a RETURN statement.`);
          }
          break;
        }

        case "callStatement": {
          const signature = this.procedureSignatures[statement.name.toLowerCase()];
          if (!signature) {
            this.pushError(statement.span, "SEM012", `Unknown procedure \"${statement.name}\".`);
            break;
          }
          this.validateCallArguments(statement.args, signature.params, statement.span, statement.name, scope);
          break;
        }

        case "return": {
          sawReturn = true;
          const returnValueType = this.inferExpressionType(statement.value, scope);
          if (!currentFunctionReturnType) {
            this.pushError(statement.span, "SEM013", "RETURN is only valid inside FUNCTION definitions.");
          } else if (!typesCompatible(currentFunctionReturnType, returnValueType)) {
            this.pushError(
              statement.span,
              "SEM014",
              `RETURN type mismatch. Expected ${typeName(currentFunctionReturnType)}, got ${typeName(returnValueType)}.`,
            );
          }
          break;
        }

        case "openfile": {
          const fileName = this.literalFileName(statement.fileIdentifier, scope);
          if (fileName) {
            openFiles[fileName] = statement.mode;
          }
          this.inferExpressionType(statement.fileIdentifier, scope);
          break;
        }

        case "readfile": {
          const fileName = this.literalFileName(statement.fileIdentifier, scope);
          if (fileName && openFiles[fileName] && openFiles[fileName] !== "READ") {
            this.pushError(statement.span, "SEM015", `READFILE used on write-only handle \"${fileName}\".`);
          }
          this.inferExpressionType(statement.fileIdentifier, scope);
          this.resolveAssignableType(statement.target, scope);
          break;
        }

        case "writefile": {
          const fileName = this.literalFileName(statement.fileIdentifier, scope);
          if (fileName && openFiles[fileName] && openFiles[fileName] !== "WRITE") {
            this.pushError(statement.span, "SEM016", `WRITEFILE used on read-only handle \"${fileName}\".`);
          }
          this.inferExpressionType(statement.fileIdentifier, scope);
          this.inferExpressionType(statement.value, scope);
          break;
        }

        case "closefile": {
          const fileName = this.literalFileName(statement.fileIdentifier, scope);
          if (fileName) {
            delete openFiles[fileName];
          }
          this.inferExpressionType(statement.fileIdentifier, scope);
          break;
        }

        default:
          break;
      }
    }

    return sawReturn;
  }

  private validateCallArguments(
    args: ExpressionNode[],
    expected: StaticType[],
    span: SourceSpan,
    name: string,
    scope: Scope,
  ) {
    if (args.length !== expected.length) {
      this.pushError(span, "SEM017", `Routine \"${name}\" expects ${expected.length} argument(s), got ${args.length}.`);
      return;
    }

    args.forEach((arg, index) => {
      const actualType = this.inferExpressionType(arg, scope);
      if (!typesCompatible(expected[index], actualType)) {
        this.pushError(
          arg.span,
          "SEM018",
          `Argument ${index + 1} for \"${name}\" must be ${typeName(expected[index])}, got ${typeName(actualType)}.`,
        );
      }
    });
  }

  private inferExpressionType(expression: ExpressionNode, scope: Scope | null): StaticType {
    switch (expression.kind) {
      case "literal":
        return { kind: "basic", name: expression.literalType };

      case "identifier": {
        if (!scope) {
          return UNKNOWN;
        }
        const symbol = scope.lookup(expression.name);
        if (!symbol) {
          this.pushError(expression.span, "SEM019", `Undeclared identifier \"${expression.name}\".`);
          return UNKNOWN;
        }
        return symbol.type;
      }

      case "arrayAccess":
        return this.resolveArrayAccessType(expression, scope);

      case "unary": {
        const operandType = this.inferExpressionType(expression.operand, scope);
        if (expression.operator === "NOT") {
          if (!isBoolean(operandType)) {
            this.pushError(expression.span, "SEM020", "NOT operator requires a BOOLEAN operand.");
          }
          return BOOLEAN;
        }
        if (!isNumeric(operandType)) {
          this.pushError(expression.span, "SEM021", "Unary minus requires a numeric operand.");
        }
        return operandType;
      }

      case "binary": {
        const leftType = this.inferExpressionType(expression.left, scope);
        const rightType = this.inferExpressionType(expression.right, scope);
        const op = expression.operator;

        if (["+", "-", "*", "/", "^"].includes(op)) {
          if (!isNumeric(leftType) || !isNumeric(rightType)) {
            this.pushError(expression.span, "SEM022", `Operator ${op} requires numeric operands.`);
            return UNKNOWN;
          }
          if (
            leftType.kind === "basic" &&
            rightType.kind === "basic" &&
            (leftType.name === "REAL" || rightType.name === "REAL" || op === "/")
          ) {
            return REAL;
          }
          return INTEGER;
        }

        if (["=", "<", "<=", ">", ">=", "<>"] .includes(op)) {
          return BOOLEAN;
        }

        if (["AND", "OR"].includes(op)) {
          if (!isBoolean(leftType) || !isBoolean(rightType)) {
            this.pushError(expression.span, "SEM023", `Operator ${op} requires BOOLEAN operands.`);
          }
          return BOOLEAN;
        }

        return UNKNOWN;
      }

      case "call": {
        const builtin = BUILTIN_FUNCTIONS[expression.name.toUpperCase()];
        if (builtin) {
          this.validateCallArgsWithScope(expression.args, builtin.params, expression.span, expression.name, scope);
          return builtin.returnType;
        }

        const signature = this.functionSignatures[expression.name.toLowerCase()];
        if (!signature) {
          this.pushError(expression.span, "SEM024", `Unknown function \"${expression.name}\".`);
          return UNKNOWN;
        }

        this.validateCallArgsWithScope(expression.args, signature.params, expression.span, expression.name, scope);
        return signature.returnType;
      }

      default:
        return UNKNOWN;
    }
  }

  private validateCallArgsWithScope(
    args: ExpressionNode[],
    expected: StaticType[],
    span: SourceSpan,
    name: string,
    scope: Scope | null,
  ) {
    if (args.length !== expected.length) {
      this.pushError(span, "SEM017", `Routine \"${name}\" expects ${expected.length} argument(s), got ${args.length}.`);
      return;
    }

    args.forEach((arg, index) => {
      const actualType = this.inferExpressionType(arg, scope);
      if (!typesCompatible(expected[index], actualType)) {
        this.pushError(
          arg.span,
          "SEM018",
          `Argument ${index + 1} for \"${name}\" must be ${typeName(expected[index])}, got ${typeName(actualType)}.`,
        );
      }
    });
  }

  private resolveAssignableType(target: ExpressionNode, scope: Scope): StaticType {
    if (target.kind === "identifier") {
      const symbol = scope.lookup(target.name);
      if (!symbol) {
        this.pushError(target.span, "SEM019", `Undeclared identifier \"${target.name}\".`);
        return UNKNOWN;
      }
      if (symbol.kind === "constant") {
        this.pushError(target.span, "SEM025", `Cannot assign/input into CONSTANT \"${target.name}\".`);
      }
      return symbol.type;
    }

    if (target.kind === "arrayAccess") {
      return this.resolveArrayAccessType(target, scope);
    }

    return UNKNOWN;
  }

  private resolveArrayAccessType(target: ArrayAccessNode, scope: Scope | null): StaticType {
    if (!scope) {
      return UNKNOWN;
    }
    const symbol = scope.lookup(target.name);
    if (!symbol) {
      this.pushError(target.span, "SEM019", `Undeclared identifier \"${target.name}\".`);
      return UNKNOWN;
    }

    if (symbol.type.kind !== "array") {
      this.pushError(target.span, "SEM026", `Identifier \"${target.name}\" is not an ARRAY.`);
      return UNKNOWN;
    }

    if (target.indices.length !== symbol.type.dimensions.length) {
      this.pushError(
        target.span,
        "SEM027",
        `ARRAY \"${target.name}\" expects ${symbol.type.dimensions.length} index value(s), got ${target.indices.length}.`,
      );
      return { kind: "basic", name: symbol.type.elementType };
    }

    for (const index of target.indices) {
      const indexType = this.inferExpressionType(index, scope);
      if (indexType.kind !== "basic" || indexType.name !== "INTEGER") {
        this.pushError(index.span, "SEM028", "Array index must evaluate to INTEGER.");
      }
    }

    return { kind: "basic", name: symbol.type.elementType };
  }

  private literalFileName(expression: ExpressionNode, scope: Scope): string | null {
    if (expression.kind === "literal" && expression.literalType === "STRING" && typeof expression.value === "string") {
      return expression.value;
    }
    this.inferExpressionType(expression, scope);
    return null;
  }

  private pushError(span: SourceSpan, code: string, message: string) {
    this.diagnostics.push({
      code,
      message,
      severity: "error",
      line: span.startLine,
      column: span.startColumn,
      endLine: span.endLine,
      endColumn: span.endColumn,
    });
  }
}

export function analyzeProgram(ast: ProgramNode): SemanticResult {
  const analyzer = new Analyzer();
  return analyzer.analyze(ast);
}
