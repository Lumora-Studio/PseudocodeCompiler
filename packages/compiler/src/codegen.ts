import {
  BasicTypeName,
  ExpressionNode,
  FunctionDefinitionNode,
  ProgramNode,
  SemanticResult,
  StatementNode,
  StaticType,
  TypeNode,
} from "./types";

interface ScopeFrame {
  types: Record<string, StaticType>;
}

class PythonGenerator {
  private lines: string[] = [];
  private caseCounter = 0;
  private scopeStack: ScopeFrame[] = [{ types: {} }];

  constructor(private readonly semanticResult: SemanticResult) {}

  generate(program: ProgramNode): string {
    this.emitPrelude();

    const definitions = program.body.filter(
      (statement) => statement.kind === "procedureDefinition" || statement.kind === "functionDefinition",
    );
    const mainStatements = program.body.filter(
      (statement) => statement.kind !== "procedureDefinition" && statement.kind !== "functionDefinition",
    );

    for (const definition of definitions) {
      if (definition.kind === "procedureDefinition") {
        this.emitProcedureDefinition(definition);
      } else {
        this.emitFunctionDefinition(definition);
      }
      this.lines.push("");
    }

    this.lines.push("def __main__():");
    this.pushScope();
    if (mainStatements.length === 0) {
      this.lines.push("    pass");
    } else {
      this.emitStatementBlock(mainStatements, 1);
    }
    this.popScope();
    this.lines.push("");
    this.lines.push("__main__()");

    return this.lines.join("\n");
  }

  private emitPrelude() {
    this.lines.push("import random");
    this.lines.push("");
    this.lines.push("class __PseudoArray:");
    this.lines.push("    def __init__(self, bounds, default_value):");
    this.lines.push("        self._bounds = bounds");
    this.lines.push("        self._default = default_value");
    this.lines.push("        self._store = {}");
    this.lines.push("");
    this.lines.push("    def _norm(self, index):");
    this.lines.push("        if not isinstance(index, tuple):");
    this.lines.push("            index = (index,)");
    this.lines.push("        if len(index) != len(self._bounds):");
    this.lines.push("            raise IndexError('Incorrect index dimensions')");
    this.lines.push("        normalized = []");
    this.lines.push("        for value, bound in zip(index, self._bounds):");
    this.lines.push("            lo, hi = bound");
    this.lines.push("            ivalue = int(value)");
    this.lines.push("            if ivalue < lo or ivalue > hi:");
    this.lines.push("                raise IndexError('Index out of declared range')");
    this.lines.push("            normalized.append(ivalue)");
    this.lines.push("        return tuple(normalized)");
    this.lines.push("");
    this.lines.push("    def __getitem__(self, index):");
    this.lines.push("        key = self._norm(index)");
    this.lines.push("        return self._store.get(key, self._default)");
    this.lines.push("");
    this.lines.push("    def __setitem__(self, index, value):");
    this.lines.push("        key = self._norm(index)");
    this.lines.push("        self._store[key] = value");
    this.lines.push("");
    this.lines.push("_stdin_lines = list(globals().get('__stdin_lines', []))");
    this.lines.push("_stdin_cursor = 0");
    this.lines.push("__stdout = []");
    this.lines.push("__vfs = {k: list(v) for k, v in globals().get('__virtual_files', {}).items()}");
    this.lines.push("__open_files = {}");
    this.lines.push("");
    this.lines.push("def __coerce_input(value, expected_type):");
    this.lines.push("    if expected_type == 'INTEGER':");
    this.lines.push("        return int(value)");
    this.lines.push("    if expected_type == 'REAL':");
    this.lines.push("        return float(value)");
    this.lines.push("    if expected_type == 'BOOLEAN':");
    this.lines.push("        return str(value).strip().upper() == 'TRUE'");
    this.lines.push("    if expected_type == 'CHAR':");
    this.lines.push("        text = str(value)");
    this.lines.push("        return text[0] if text else ''");
    this.lines.push("    return str(value)");
    this.lines.push("");
    this.lines.push("def __input():");
    this.lines.push("    global _stdin_cursor");
    this.lines.push("    if _stdin_cursor >= len(_stdin_lines):");
    this.lines.push("        raise RuntimeError('INPUT requested but no stdin lines remain')");
    this.lines.push("    value = _stdin_lines[_stdin_cursor]");
    this.lines.push("    _stdin_cursor += 1");
    this.lines.push("    return value");
    this.lines.push("");
    this.lines.push("def __output(*values):");
    this.lines.push("    text = ''.join(str(v) for v in values)");
    this.lines.push("    __stdout.append(text)");
    this.lines.push("");
    this.lines.push("def DIV(a, b):");
    this.lines.push("    return int(a // b)");
    this.lines.push("");
    this.lines.push("def MOD(a, b):");
    this.lines.push("    return int(a % b)");
    this.lines.push("");
    this.lines.push("def LENGTH(value):");
    this.lines.push("    return len(str(value))");
    this.lines.push("");
    this.lines.push("def LCASE(value):");
    this.lines.push("    return str(value).lower()");
    this.lines.push("");
    this.lines.push("def UCASE(value):");
    this.lines.push("    return str(value).upper()");
    this.lines.push("");
    this.lines.push("def SUBSTRING(value, start, length):");
    this.lines.push("    start = int(start)");
    this.lines.push("    length = int(length)");
    this.lines.push("    if start < 1:");
    this.lines.push("        start = 1");
    this.lines.push("    text = str(value)");
    this.lines.push("    begin = start - 1");
    this.lines.push("    return text[begin:begin + length]");
    this.lines.push("");
    this.lines.push("def ROUND(value, places):");
    this.lines.push("    return round(float(value), int(places))");
    this.lines.push("");
    this.lines.push("def RANDOM():");
    this.lines.push("    return random.random()");
    this.lines.push("");
    this.lines.push("def OPENFILE(file_identifier, mode):");
    this.lines.push("    name = str(file_identifier)");
    this.lines.push("    if mode == 'WRITE':");
    this.lines.push("        __vfs[name] = []");
    this.lines.push("    elif name not in __vfs:");
    this.lines.push("        __vfs[name] = []");
    this.lines.push("    __open_files[name] = {'mode': mode, 'pointer': 0}");
    this.lines.push("");
    this.lines.push("def READFILE(file_identifier):");
    this.lines.push("    name = str(file_identifier)");
    this.lines.push("    handle = __open_files.get(name)");
    this.lines.push("    if not handle:");
    this.lines.push("        raise RuntimeError(f'File {name} is not open')");
    this.lines.push("    if handle['mode'] != 'READ':");
    this.lines.push("        raise RuntimeError(f'File {name} not opened in READ mode')");
    this.lines.push("    pointer = handle['pointer']");
    this.lines.push("    data = __vfs.get(name, [])");
    this.lines.push("    if pointer >= len(data):");
    this.lines.push("        return ''");
    this.lines.push("    handle['pointer'] += 1");
    this.lines.push("    return data[pointer]");
    this.lines.push("");
    this.lines.push("def WRITEFILE(file_identifier, value):");
    this.lines.push("    name = str(file_identifier)");
    this.lines.push("    handle = __open_files.get(name)");
    this.lines.push("    if not handle:");
    this.lines.push("        raise RuntimeError(f'File {name} is not open')");
    this.lines.push("    if handle['mode'] != 'WRITE':");
    this.lines.push("        raise RuntimeError(f'File {name} not opened in WRITE mode')");
    this.lines.push("    __vfs.setdefault(name, []).append(str(value))");
    this.lines.push("");
    this.lines.push("def CLOSEFILE(file_identifier):");
    this.lines.push("    name = str(file_identifier)");
    this.lines.push("    if name in __open_files:");
    this.lines.push("        del __open_files[name]");
    this.lines.push("");
    this.lines.push("def __inclusive_range(start, end, step=1):");
    this.lines.push("    start = int(start)");
    this.lines.push("    end = int(end)");
    this.lines.push("    step = int(step)");
    this.lines.push("    if step == 0:");
    this.lines.push("        raise RuntimeError('FOR STEP cannot be zero')");
    this.lines.push("    value = start");
    this.lines.push("    if step > 0:");
    this.lines.push("        while value <= end:");
    this.lines.push("            yield value");
    this.lines.push("            value += step");
    this.lines.push("    else:");
    this.lines.push("        while value >= end:");
    this.lines.push("            yield value");
    this.lines.push("            value += step");
    this.lines.push("");
  }

  private emitProcedureDefinition(statement: Extract<StatementNode, { kind: "procedureDefinition" }>) {
    const params = statement.params.map((param) => this.normalizeName(param.name)).join(", ");
    this.lines.push(`def ${this.normalizeName(statement.name)}(${params}):`);

    this.pushScope();
    for (const param of statement.params) {
      this.declareType(param.name, this.typeNodeToStatic(param.typeNode));
    }

    if (statement.body.length === 0) {
      this.lines.push("    pass");
    } else {
      this.emitStatementBlock(statement.body, 1);
    }

    this.popScope();
  }

  private emitFunctionDefinition(statement: FunctionDefinitionNode) {
    const params = statement.params.map((param) => this.normalizeName(param.name)).join(", ");
    this.lines.push(`def ${this.normalizeName(statement.name)}(${params}):`);

    this.pushScope();
    for (const param of statement.params) {
      this.declareType(param.name, this.typeNodeToStatic(param.typeNode));
    }

    if (statement.body.length === 0) {
      this.lines.push("    return None");
    } else {
      this.emitStatementBlock(statement.body, 1);
    }
    this.popScope();
  }

  private emitStatementBlock(statements: StatementNode[], indentLevel: number) {
    for (const statement of statements) {
      this.emitStatement(statement, indentLevel);
    }
  }

  private emitStatement(statement: StatementNode, indentLevel: number) {
    const indent = "    ".repeat(indentLevel);

    switch (statement.kind) {
      case "declare": {
        const name = this.normalizeName(statement.identifier.name);
        const staticType = this.typeNodeToStatic(statement.typeNode);
        this.declareType(statement.identifier.name, staticType);
        if (statement.typeNode.kind === "array") {
          const bounds = statement.typeNode.dimensions
            .map((dimension) => `(${dimension.lower}, ${dimension.upper})`)
            .join(", ");
          const defaultValue = this.defaultValueLiteral(statement.typeNode.elementType);
          this.lines.push(`${indent}${name} = __PseudoArray([${bounds}], ${defaultValue})`);
        } else {
          this.lines.push(`${indent}${name} = ${this.defaultValueLiteral(statement.typeNode.name)}`);
        }
        break;
      }

      case "constant": {
        const name = this.normalizeName(statement.identifier.name);
        const value = this.emitExpression(statement.value);
        this.declareType(statement.identifier.name, this.inferStaticType(statement.value));
        this.lines.push(`${indent}${name} = ${value}`);
        break;
      }

      case "assignment": {
        const target = this.emitAssignable(statement.target);
        const value = this.emitExpression(statement.value);
        this.lines.push(`${indent}${target} = ${value}`);
        break;
      }

      case "input": {
        const target = this.emitAssignable(statement.target);
        const targetType = this.resolveTargetType(statement.target);
        if (targetType.kind === "basic") {
          this.lines.push(`${indent}${target} = __coerce_input(__input(), "${targetType.name}")`);
        } else {
          this.lines.push(`${indent}${target} = __input()`);
        }
        break;
      }

      case "output": {
        const values = statement.values.map((value) => this.emitExpression(value)).join(", ");
        this.lines.push(`${indent}__output(${values})`);
        break;
      }

      case "if": {
        const condition = this.emitExpression(statement.condition);
        this.lines.push(`${indent}if ${condition}:`);
        this.pushScope();
        if (statement.thenBody.length === 0) {
          this.lines.push(`${indent}    pass`);
        } else {
          this.emitStatementBlock(statement.thenBody, indentLevel + 1);
        }
        this.popScope();
        if (statement.elseBody.length > 0) {
          this.lines.push(`${indent}else:`);
          this.pushScope();
          this.emitStatementBlock(statement.elseBody, indentLevel + 1);
          this.popScope();
        }
        break;
      }

      case "case": {
        const caseName = `__case_${this.caseCounter++}`;
        const expression = this.emitExpression(statement.expression);
        this.lines.push(`${indent}${caseName} = ${expression}`);
        let branchCount = 0;
        for (const clause of statement.clauses) {
          if (clause.value === null) {
            this.lines.push(`${indent}else:`);
            this.emitStatement(clause.statement, indentLevel + 1);
            continue;
          }
          const branchPrefix = branchCount === 0 ? "if" : "elif";
          const clauseValue = this.emitExpression(clause.value);
          this.lines.push(`${indent}${branchPrefix} ${caseName} == ${clauseValue}:`);
          this.emitStatement(clause.statement, indentLevel + 1);
          branchCount += 1;
        }
        if (statement.clauses.length === 0) {
          this.lines.push(`${indent}pass`);
        }
        break;
      }

      case "for": {
        const iterator = this.normalizeName(statement.iterator.name);
        const start = this.emitExpression(statement.startValue);
        const end = this.emitExpression(statement.endValue);
        const step = statement.stepValue ? this.emitExpression(statement.stepValue) : "1";
        this.lines.push(`${indent}for ${iterator} in __inclusive_range(${start}, ${end}, ${step}):`);
        this.pushScope();
        this.declareType(statement.iterator.name, { kind: "basic", name: "INTEGER" });
        if (statement.body.length === 0) {
          this.lines.push(`${indent}    pass`);
        } else {
          this.emitStatementBlock(statement.body, indentLevel + 1);
        }
        this.popScope();
        break;
      }

      case "repeat": {
        this.lines.push(`${indent}while True:`);
        this.pushScope();
        if (statement.body.length === 0) {
          this.lines.push(`${indent}    pass`);
        } else {
          this.emitStatementBlock(statement.body, indentLevel + 1);
        }
        const condition = this.emitExpression(statement.condition);
        this.lines.push(`${indent}    if ${condition}:`);
        this.lines.push(`${indent}        break`);
        this.popScope();
        break;
      }

      case "while": {
        const condition = this.emitExpression(statement.condition);
        this.lines.push(`${indent}while ${condition}:`);
        this.pushScope();
        if (statement.body.length === 0) {
          this.lines.push(`${indent}    pass`);
        } else {
          this.emitStatementBlock(statement.body, indentLevel + 1);
        }
        this.popScope();
        break;
      }

      case "procedureDefinition":
      case "functionDefinition":
        break;

      case "callStatement": {
        const args = statement.args.map((arg) => this.emitExpression(arg)).join(", ");
        this.lines.push(`${indent}${this.normalizeName(statement.name)}(${args})`);
        break;
      }

      case "return": {
        this.lines.push(`${indent}return ${this.emitExpression(statement.value)}`);
        break;
      }

      case "openfile": {
        const file = this.emitExpression(statement.fileIdentifier);
        this.lines.push(`${indent}OPENFILE(${file}, "${statement.mode}")`);
        break;
      }

      case "readfile": {
        const file = this.emitExpression(statement.fileIdentifier);
        const target = this.emitAssignable(statement.target);
        this.lines.push(`${indent}${target} = READFILE(${file})`);
        break;
      }

      case "writefile": {
        const file = this.emitExpression(statement.fileIdentifier);
        const value = this.emitExpression(statement.value);
        this.lines.push(`${indent}WRITEFILE(${file}, ${value})`);
        break;
      }

      case "closefile": {
        const file = this.emitExpression(statement.fileIdentifier);
        this.lines.push(`${indent}CLOSEFILE(${file})`);
        break;
      }

      default:
        this.lines.push(`${indent}pass`);
        break;
    }
  }

  private emitAssignable(target: ExpressionNode): string {
    if (target.kind === "identifier") {
      return this.normalizeName(target.name);
    }

    if (target.kind === "arrayAccess") {
      const indices = target.indices.map((index) => this.emitExpression(index)).join(", ");
      return `${this.normalizeName(target.name)}[${indices}]`;
    }

    return "__invalid_target";
  }

  private emitExpression(expression: ExpressionNode): string {
    switch (expression.kind) {
      case "literal": {
        if (expression.literalType === "STRING" || expression.literalType === "CHAR") {
          return JSON.stringify(String(expression.value));
        }
        if (expression.literalType === "BOOLEAN") {
          return expression.value ? "True" : "False";
        }
        return String(expression.value);
      }

      case "identifier":
        return this.normalizeName(expression.name);

      case "arrayAccess": {
        const indices = expression.indices.map((index) => this.emitExpression(index)).join(", ");
        return `${this.normalizeName(expression.name)}[${indices}]`;
      }

      case "unary": {
        const operand = this.emitExpression(expression.operand);
        if (expression.operator === "NOT") {
          return `(not (${operand}))`;
        }
        return `(-(${operand}))`;
      }

      case "binary": {
        const left = this.emitExpression(expression.left);
        const right = this.emitExpression(expression.right);
        const operatorMap: Record<string, string> = {
          "=": "==",
          "<>": "!=",
          AND: "and",
          OR: "or",
        };
        const operator = operatorMap[expression.operator] ?? expression.operator;
        return `((${left}) ${operator} (${right}))`;
      }

      case "call": {
        const args = expression.args.map((arg) => this.emitExpression(arg)).join(", ");
        const name = this.normalizeName(expression.name);
        return `${name}(${args})`;
      }

      default:
        return "None";
    }
  }

  private normalizeName(name: string): string {
    return name;
  }

  private defaultValueLiteral(typeName: BasicTypeName): string {
    switch (typeName) {
      case "INTEGER":
        return "0";
      case "REAL":
        return "0.0";
      case "CHAR":
        return "''";
      case "STRING":
        return '""';
      case "BOOLEAN":
        return "False";
      default:
        return "None";
    }
  }

  private typeNodeToStatic(typeNode: TypeNode): StaticType {
    if (typeNode.kind === "basic") {
      return { kind: "basic", name: typeNode.name };
    }
    return {
      kind: "array",
      elementType: typeNode.elementType,
      dimensions: typeNode.dimensions,
    };
  }

  private inferStaticType(expression: ExpressionNode): StaticType {
    switch (expression.kind) {
      case "literal":
        return { kind: "basic", name: expression.literalType };
      case "identifier":
        return this.lookupType(expression.name);
      case "arrayAccess": {
        const type = this.lookupType(expression.name);
        if (type.kind === "array") {
          return { kind: "basic", name: type.elementType };
        }
        return { kind: "unknown" };
      }
      default:
        return { kind: "unknown" };
    }
  }

  private resolveTargetType(target: ExpressionNode): StaticType {
    if (target.kind === "identifier") {
      return this.lookupType(target.name);
    }

    if (target.kind === "arrayAccess") {
      const type = this.lookupType(target.name);
      if (type.kind === "array") {
        return { kind: "basic", name: type.elementType };
      }
    }

    return { kind: "unknown" };
  }

  private declareType(name: string, type: StaticType) {
    this.scopeStack[this.scopeStack.length - 1].types[name.toLowerCase()] = type;
  }

  private lookupType(name: string): StaticType {
    const lower = name.toLowerCase();
    for (let i = this.scopeStack.length - 1; i >= 0; i -= 1) {
      const found = this.scopeStack[i].types[lower];
      if (found) {
        return found;
      }
    }
    return this.semanticResult.symbolTypes[lower] ?? { kind: "unknown" };
  }

  private pushScope() {
    this.scopeStack.push({ types: {} });
  }

  private popScope() {
    this.scopeStack.pop();
  }
}

export function generatePythonCode(ast: ProgramNode, semanticResult: SemanticResult): string {
  const generator = new PythonGenerator(semanticResult);
  return generator.generate(ast);
}
