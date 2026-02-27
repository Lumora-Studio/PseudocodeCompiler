"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
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
const INPUT_REQUEST_ERROR_TEXT = "INPUT requested but no stdin lines remain";
const MAX_INTERACTIVE_INPUTS = 200;
const CURRENT_VERSION = "v0.1.4 alpha";

function getInitialSource() {
  if (typeof window === "undefined") {
    return DEFAULT_SOURCE;
  }
  return window.localStorage.getItem(SOURCE_STORAGE_KEY) ?? DEFAULT_SOURCE;
}

function isInputRequestRuntimeError(stderr: string): boolean {
  return stderr.includes(INPUT_REQUEST_ERROR_TEXT);
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
  const [compileDiagnostics, setCompileDiagnostics] = useState<Diagnostic[]>([]);
  const [terminalText, setTerminalText] = useState("Terminal ready. Compile or run your pseudocode.");
  const [pendingInputLabel, setPendingInputLabel] = useState<string | null>(null);
  const [pendingInputText, setPendingInputText] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const pendingInputResolverRef = useRef<((value: string | null) => void) | null>(null);

  useEffect(() => {
    window.localStorage.setItem(SOURCE_STORAGE_KEY, source);
  }, [source]);

  useEffect(() => {
    return () => {
      const resolver = pendingInputResolverRef.current;
      if (!resolver) {
        return;
      }
      pendingInputResolverRef.current = null;
      resolver(null);
    };
  }, []);

  const editorDiagnostics = useMemo(() => compileDiagnostics, [compileDiagnostics]);

  const resolvePendingInput = (value: string | null) => {
    const resolver = pendingInputResolverRef.current;
    if (!resolver) {
      return;
    }
    pendingInputResolverRef.current = null;
    setPendingInputLabel(null);
    setPendingInputText("");
    resolver(value);
  };

  const waitForTerminalInput = (label: string) => {
    const existingResolver = pendingInputResolverRef.current;
    if (existingResolver) {
      pendingInputResolverRef.current = null;
      existingResolver(null);
    }
    setPendingInputLabel(label);
    setPendingInputText("");
    return new Promise<string | null>((resolve) => {
      pendingInputResolverRef.current = resolve;
    });
  };

  const compileSource = () =>
    compilePseudocode({
      source,
      filename: "main.pseudo",
      strict: true,
    });

  const compileNow = () => {
    const result = compileSource();

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
    const compileResult = compileSource();
    setCompileDiagnostics(compileResult.diagnostics);

    if (!compileResult.success || !compileResult.pythonCode) {
      setTerminalText(`Compile failed.\n\n${formatDiagnostics(compileResult.diagnostics)}`);
      return;
    }

    setIsRunning(true);
    const stdinLines: string[] = [];
    const transcript: string[] = ["Program running..."];
    setTerminalText(transcript.join("\n"));

    try {
      let runResult = await pythonRunner.run({
        pythonCode: compileResult.pythonCode,
        stdinLines: [...stdinLines],
        virtualFiles: {},
      });

      while (isInputRequestRuntimeError(runResult.stderr)) {
        if (stdinLines.length >= MAX_INTERACTIVE_INPUTS) {
          setTerminalText(
            [
              ...transcript,
              "",
              `Stopped after ${MAX_INTERACTIVE_INPUTS} INPUT requests to avoid an infinite input loop.`,
            ].join("\n"),
          );
          return;
        }

        const inputLabel = `INPUT ${stdinLines.length + 1}`;
        transcript.push(`${inputLabel}:`);
        setTerminalText(transcript.join("\n"));

        const nextInput = await waitForTerminalInput(inputLabel);
        if (nextInput === null) {
          setTerminalText([...transcript, "", "Run cancelled."].join("\n"));
          return;
        }

        stdinLines.push(nextInput);
        transcript.push(`> ${nextInput}`);
        setTerminalText(transcript.join("\n"));

        runResult = await pythonRunner.run({
          pythonCode: compileResult.pythonCode,
          stdinLines: [...stdinLines],
          virtualFiles: {},
        });
      }

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

      setTerminalText([...transcript, "", ...chunks].join("\n"));
    } finally {
      const resolver = pendingInputResolverRef.current;
      if (resolver) {
        pendingInputResolverRef.current = null;
        resolver(null);
      }
      setPendingInputLabel(null);
      setPendingInputText("");
      setIsRunning(false);
    }
  };

  const submitPendingInput = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resolvePendingInput(pendingInputText);
  };

  const cancelPendingInput = () => {
    resolvePendingInput(null);
  };

  const clearTerminal = () => {
    resolvePendingInput(null);
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
          <p className="mt-2 text-xs uppercase tracking-[0.15em] text-[var(--muted)]">
            Version Tracker: <span className="font-semibold text-[var(--accent-2)]">{CURRENT_VERSION}</span>
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/manual" className="ui-button">
              Open Manual
            </Link>
            <button type="button" className="ui-button" onClick={compileNow} disabled={isRunning}>
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
            <pre className="mt-3 h-[52vh] min-h-[360px] overflow-auto rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] p-3 font-mono text-xs text-[var(--text)]">
              {terminalText || "(empty)"}
            </pre>
            {pendingInputLabel ? (
              <form className="mt-3" onSubmit={submitPendingInput}>
                <label
                  htmlFor="terminal-live-input"
                  className="block text-xs uppercase tracking-wider text-[var(--muted)]"
                >
                  {pendingInputLabel}
                </label>
                <div className="mt-2 flex gap-2">
                  <input
                    id="terminal-live-input"
                    value={pendingInputText}
                    onChange={(event) => setPendingInputText(event.target.value)}
                    autoFocus
                    className="h-10 w-full rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 font-mono text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]"
                    placeholder="Type input value and press Enter"
                  />
                  <button type="submit" className="ui-button ui-button-primary">
                    Send
                  </button>
                  <button type="button" className="ui-button" onClick={cancelPendingInput}>
                    Cancel Run
                  </button>
                </div>
              </form>
            ) : null}
          </article>
        </section>
      </div>
    </main>
  );
}
