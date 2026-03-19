"use client";

import { Diagnostic } from "@/compiler/types";

interface DiagnosticsPanelProps {
  diagnostics: Diagnostic[];
}

export function DiagnosticsPanel({ diagnostics }: DiagnosticsPanelProps) {
  if (diagnostics.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--separator)] bg-[var(--surface)] p-4">
        <p className="text-sm font-medium text-[var(--text)]">No diagnostics.</p>
        <p className="mt-1 text-xs text-[var(--text2)]">Compile the active file to see errors, warnings, and hints.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {diagnostics.map((diagnostic, index) => (
        <div
          key={`${diagnostic.code}-${diagnostic.line}-${diagnostic.column}-${index}`}
          className="rounded-lg border border-[var(--separator)] bg-[var(--surface)] p-3"
        >
          <p className="font-mono text-[11px] text-[var(--text2)]">
            <span className={diagnostic.severity === "error" ? "text-[var(--red)]" : diagnostic.severity === "warning" ? "text-[var(--orange)]" : "text-[var(--accent)]"}>
              {diagnostic.severity.toUpperCase()}
            </span>
            {" "}· {diagnostic.code} · L{diagnostic.line}:C{diagnostic.column}
          </p>
          <p className="mt-1 text-sm leading-5 text-[var(--text)]">{diagnostic.message}</p>
          {diagnostic.hint ? <p className="mt-1 text-xs leading-5 text-[var(--text2)]">Hint: {diagnostic.hint}</p> : null}
        </div>
      ))}
    </div>
  );
}
