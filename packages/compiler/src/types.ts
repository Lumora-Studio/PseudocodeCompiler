export type Severity = "error" | "warning" | "info";

export interface Diagnostic {
  code: string;
  message: string;
  severity: Severity;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  hint?: string;
}

export interface CompileRequest {
  source: string;
  filename: string;
  strict: true;
}

export interface CompileResult {
  success: boolean;
  diagnostics: Diagnostic[];
  astJson?: string;
  pythonCode?: string;
}

export interface RunRequest {
  pythonCode: string;
  stdinLines: string[];
  virtualFiles: Record<string, string[]>;
}

export interface RunResult {
  success: boolean;
  stdout: string;
  stderr: string;
  diagnostics: Diagnostic[];
  virtualFiles: Record<string, string[]>;
}

export interface SourceSpan {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export type BasicTypeName = "INTEGER" | "REAL" | "CHAR" | "STRING" | "BOOLEAN";

export type TypeNode =
  | {
      kind: "basic";
      name: BasicTypeName;
      span: SourceSpan;
    }
  | {
      kind: "array";
      elementType: BasicTypeName;
      dimensions: Array<{ lower: number; upper: number }>;
      span: SourceSpan;
    };

export interface IdentifierNode {
  kind: "identifier";
  name: string;
  span: SourceSpan;
}

export type LiteralValue = number | string | boolean;

export interface LiteralNode {
  kind: "literal";
  value: LiteralValue;
  literalType: BasicTypeName;
  span: SourceSpan;
}

export interface UnaryExpressionNode {
  kind: "unary";
  operator: "-" | "NOT";
  operand: ExpressionNode;
  span: SourceSpan;
}

export interface BinaryExpressionNode {
  kind: "binary";
  operator: string;
  left: ExpressionNode;
  right: ExpressionNode;
  span: SourceSpan;
}

export interface CallExpressionNode {
  kind: "call";
  name: string;
  args: ExpressionNode[];
  span: SourceSpan;
}

export interface ArrayAccessNode {
  kind: "arrayAccess";
  name: string;
  indices: ExpressionNode[];
  span: SourceSpan;
}

export type ExpressionNode =
  | LiteralNode
  | IdentifierNode
  | UnaryExpressionNode
  | BinaryExpressionNode
  | CallExpressionNode
  | ArrayAccessNode;

export interface DeclareStatementNode {
  kind: "declare";
  identifier: IdentifierNode;
  typeNode: TypeNode;
  span: SourceSpan;
}

export interface ConstantStatementNode {
  kind: "constant";
  identifier: IdentifierNode;
  value: ExpressionNode;
  span: SourceSpan;
}

export interface AssignmentStatementNode {
  kind: "assignment";
  target: IdentifierNode | ArrayAccessNode;
  value: ExpressionNode;
  span: SourceSpan;
}

export interface InputStatementNode {
  kind: "input";
  target: IdentifierNode | ArrayAccessNode;
  span: SourceSpan;
}

export interface OutputStatementNode {
  kind: "output";
  values: ExpressionNode[];
  span: SourceSpan;
}

export interface IfStatementNode {
  kind: "if";
  condition: ExpressionNode;
  thenBody: StatementNode[];
  elseBody: StatementNode[];
  span: SourceSpan;
}

export interface CaseClauseNode {
  value: ExpressionNode | null;
  statement: StatementNode;
  span: SourceSpan;
}

export interface CaseStatementNode {
  kind: "case";
  expression: ExpressionNode;
  clauses: CaseClauseNode[];
  span: SourceSpan;
}

export interface ForStatementNode {
  kind: "for";
  iterator: IdentifierNode;
  startValue: ExpressionNode;
  endValue: ExpressionNode;
  stepValue: ExpressionNode | null;
  body: StatementNode[];
  span: SourceSpan;
}

export interface RepeatStatementNode {
  kind: "repeat";
  body: StatementNode[];
  condition: ExpressionNode;
  span: SourceSpan;
}

export interface WhileStatementNode {
  kind: "while";
  condition: ExpressionNode;
  body: StatementNode[];
  span: SourceSpan;
}

export interface ParameterNode {
  name: string;
  typeNode: TypeNode;
  span: SourceSpan;
}

export interface ProcedureDefinitionNode {
  kind: "procedureDefinition";
  name: string;
  params: ParameterNode[];
  body: StatementNode[];
  span: SourceSpan;
}

export interface FunctionDefinitionNode {
  kind: "functionDefinition";
  name: string;
  params: ParameterNode[];
  returnType: BasicTypeName;
  body: StatementNode[];
  span: SourceSpan;
}

export interface CallStatementNode {
  kind: "callStatement";
  name: string;
  args: ExpressionNode[];
  span: SourceSpan;
}

export interface ReturnStatementNode {
  kind: "return";
  value: ExpressionNode;
  span: SourceSpan;
}

export type FileMode = "READ" | "WRITE";

export interface OpenFileStatementNode {
  kind: "openfile";
  fileIdentifier: ExpressionNode;
  mode: FileMode;
  span: SourceSpan;
}

export interface ReadFileStatementNode {
  kind: "readfile";
  fileIdentifier: ExpressionNode;
  target: IdentifierNode | ArrayAccessNode;
  span: SourceSpan;
}

export interface WriteFileStatementNode {
  kind: "writefile";
  fileIdentifier: ExpressionNode;
  value: ExpressionNode;
  span: SourceSpan;
}

export interface CloseFileStatementNode {
  kind: "closefile";
  fileIdentifier: ExpressionNode;
  span: SourceSpan;
}

export type StatementNode =
  | DeclareStatementNode
  | ConstantStatementNode
  | AssignmentStatementNode
  | InputStatementNode
  | OutputStatementNode
  | IfStatementNode
  | CaseStatementNode
  | ForStatementNode
  | RepeatStatementNode
  | WhileStatementNode
  | ProcedureDefinitionNode
  | FunctionDefinitionNode
  | CallStatementNode
  | ReturnStatementNode
  | OpenFileStatementNode
  | ReadFileStatementNode
  | WriteFileStatementNode
  | CloseFileStatementNode;

export interface ProgramNode {
  kind: "program";
  body: StatementNode[];
  span: SourceSpan;
}

export type StaticType =
  | { kind: "unknown" }
  | { kind: "basic"; name: BasicTypeName }
  | {
      kind: "array";
      elementType: BasicTypeName;
      dimensions: Array<{ lower: number; upper: number }>;
    };

export interface FunctionSignature {
  name: string;
  params: StaticType[];
  returnType: StaticType;
}

export interface ProcedureSignature {
  name: string;
  params: StaticType[];
}

export interface SemanticResult {
  diagnostics: Diagnostic[];
  symbolTypes: Record<string, StaticType>;
  functionSignatures: Record<string, FunctionSignature>;
  procedureSignatures: Record<string, ProcedureSignature>;
}
