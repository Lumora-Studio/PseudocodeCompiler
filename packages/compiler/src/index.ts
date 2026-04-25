import { analyzeProgram } from "./semantics";
import { generatePythonCode } from "./codegen";
import { parseSource } from "./parser";
import { CompileRequest, CompileResult } from "./types";

export { parseSource } from "./parser";

export function compilePseudocode(request: CompileRequest): CompileResult {
  const { ast, diagnostics: parseDiagnostics } = parseSource(request.source);
  const semanticResult = analyzeProgram(ast);

  const diagnostics = [...parseDiagnostics, ...semanticResult.diagnostics].sort((a, b) => {
    if (a.line !== b.line) return a.line - b.line;
    if (a.column !== b.column) return a.column - b.column;
    return a.code.localeCompare(b.code);
  });

  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return {
      success: false,
      diagnostics,
      astJson: JSON.stringify(ast, null, 2),
    };
  }

  const pythonCode = generatePythonCode(ast, semanticResult);

  return {
    success: true,
    diagnostics,
    astJson: JSON.stringify(ast, null, 2),
    pythonCode,
  };
}
