"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { compilePseudocode } from "@/compiler";
import { Diagnostic } from "@/compiler/types";
import { MonacoPseudocodeEditor } from "@/app/components/MonacoPseudocodeEditor";
import { pythonRunner } from "@/runtime/executePython";

const DEFAULT_SOURCE = `DECLARE Number : INTEGER
DECLARE Total : INTEGER

FOR Number <- 1 TO 5
    Total <- Total + Number
NEXT Number

OUTPUT "Total = ", Total`;

const SOURCE_STORAGE_KEY = "igcse-editor-source-v2";
const STDIN_STORAGE_KEY = "igcse-editor-stdin-v1";

function getInitialSource() {
  if (typeof window === "undefined") {
    return DEFAULT_SOURCE;
  }
  return window.localStorage.getItem(SOURCE_STORAGE_KEY) ?? DEFAULT_SOURCE;
}

function getInitialStdinText() {
  if (typeof window === "undefined") {
    return "";
  }
  return window.localStorage.getItem(STDIN_STORAGE_KEY) ?? "";
}

function splitStdinLines(stdinText: string): string[] {
  if (stdinText.length === 0) {
    return [];
  }
  return stdinText.replace(/\r/g, "").split("\n");
}

function sourceUsesInput(sourceText: string): boolean {
  return /^\s*INPUT\b/im.test(sourceText);
}

function formatDiagnostics(diagnostics: Diagnostic[]): string {
  if (diagnostics.length === 0) {
    return "";
  }
  return diagnostics
    .map(
      (diagnostic) =>
        `[${diagnostic.code}] ${diagnostic.severity.toUpperCase()} L${diagnostic.line}:C${diagnostic.column} ${diagnostic.message}`,
    )
    .join("\n");
}

export default function HomePage() {
  const [source, setSource] = useState(getInitialSource);
  const [stdinText, setStdinText] = useState(getInitialStdinText);
  const [compileDiagnostics, setCompileDiagnostics] = useState<Diagnostic[]>([]);
  const [terminalText, setTerminalText] = useState("Terminal ready. Compile or run your pseudocode.");
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(SOURCE_STORAGE_KEY, source);
  }, [source]);

  useEffect(() => {
    window.localStorage.setItem(STDIN_STORAGE_KEY, stdinText);
  }, [stdinText]);

  const editorDiagnostics = useMemo(() => compileDiagnostics, [compileDiagnostics]);

  const compileNow = () => {
    const result = compilePseudocode({
      source,
      filename: "main.pseudo",
      strict: true,
    });

    setCompileDiagnostics(result.diagnostics);

    if (!result.success) {
      setTerminalText(`Compile failed.\n\n${formatDiagnostics(result.diagnostics)}`);
      return result;
    }

    setTerminalText(
      result.diagnostics.length > 0
        ? `Compile succeeded with notes.\n\n${formatDiagnostics(result.diagnostics)}`
        : "Compile succeeded.",
    );

    return result;
  };

  const runNow = async () => {
    const compileResult = compileNow();
    if (!compileResult.success || !compileResult.pythonCode) {
      return;
    }

    const stdinLines = splitStdinLines(stdinText);
    if (sourceUsesInput(source) && stdinLines.length === 0) {
      setTerminalText(
        "Run blocked.\n\nYour pseudocode uses INPUT, but Program Input (stdin) is empty.\nEnter one value per line, then run again.",
      );
      return;
    }

    setIsRunning(true);

    const runResult = await pythonRunner.run({
      pythonCode: compileResult.pythonCode,
      stdinLines,
      virtualFiles: {},
    });

    const chunks: string[] = [];
    if (runResult.stdout.trim().length > 0) {
      chunks.push(`STDOUT:\n${runResult.stdout}`);
    }
    if (runResult.stderr.trim().length > 0) {
      chunks.push(`STDERR:\n${runResult.stderr}`);
    }
    if (runResult.diagnostics.length > 0) {
      chunks.push(`RUNTIME DIAGNOSTICS:\n${formatDiagnostics(runResult.diagnostics)}`);
    }
    if (chunks.length === 0) {
      chunks.push("Program finished with no output.");
    }

    setTerminalText(chunks.join("\n\n"));
    setIsRunning(false);
  };

  const clearTerminal = () => {
    setTerminalText("");
  };

  return (
    <main className="exam-shell min-h-screen p-4 md:p-6">
      <div className="mx-auto max-w-[1600px] space-y-4">
        <header className="panel rounded-xl p-4 md:p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">IGCSE Pseudocode Compiler</p>
          <h1 className="mt-1 text-2xl font-semibold text-[var(--text)] md:text-3xl">
            Editor + Terminal
          </h1>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/manual" className="ui-button">
              Open Manual
            </Link>
            <button type="button" className="ui-button" onClick={compileNow}>
              Compile
            </button>
            <button type="button" className="ui-button ui-button-primary" onClick={runNow} disabled={isRunning}>
              {isRunning ? "Running..." : "Run"}
            </button>
            <button type="button" className="ui-button" onClick={clearTerminal}>
              Clear Terminal
            </button>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          <article className="panel overflow-hidden rounded-xl">
            <div className="border-b border-[var(--panel-border)] px-4 py-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">Pseudocode Editor</h2>
            </div>
            <div className="h-[72vh] min-h-[540px]">
              <MonacoPseudocodeEditor value={source} onChange={setSource} diagnostics={editorDiagnostics} />
            </div>
          </article>

          <article className="panel rounded-xl p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">Terminal</h2>
            <label htmlFor="stdin-input" className="mt-3 block text-xs uppercase tracking-wider text-[var(--muted)]">
              Program Input (stdin)
            </label>
            <textarea
              id="stdin-input"
              value={stdinText}
              onChange={(event) => setStdinText(event.target.value)}
              className="mt-2 h-24 w-full resize-y rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] p-3 font-mono text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]"
              placeholder={"Enter one input value per line.\nThis box is empty by default."}
            />
            <pre className="mt-3 h-[58vh] min-h-[420px] overflow-auto rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] p-3 font-mono text-xs text-[var(--text)]">
              {terminalText || "(empty)"}
            </pre>
          </article>
        </section>
      </div>
    </main>
  );
}
