/// <reference lib="webworker" />

import type { Diagnostic, RunResult } from "@/compiler/types";

type RunWorkerMessage = {
  id: number;
  request: {
    pythonCode: string;
    stdinLines: string[];
    virtualFiles: Record<string, string[]>;
  };
};

type WorkerRunResponseMessage = {
  kind: "run-result";
  id: number;
  result: RunResult;
};

type WorkerStatusMessage = {
  kind: "runtime-status";
  status: "ready";
};

type PyProxyLike = {
  toJs?: (options?: { dict_converter?: typeof Object.fromEntries }) => unknown;
  destroy?: () => void;
};

type PyodideLike = {
  globals: {
    set: (name: string, value: unknown) => void;
  };
  runPythonAsync: (pythonCode: string) => Promise<PyProxyLike>;
};

interface WorkerRunData {
  stdout?: string;
  error?: string;
  vfs?: Record<string, string[]>;
}

declare const self: DedicatedWorkerGlobalScope & {
  loadPyodide?: (options: { indexURL: string }) => Promise<PyodideLike>;
};

let pyodideInstance: PyodideLike | null = null;
let pyodideReady: Promise<PyodideLike> | null = null;
let runtimeReadyNotified = false;

async function getPyodide() {
  if (pyodideInstance) {
    return pyodideInstance;
  }

  if (!pyodideReady) {
    pyodideReady = (async () => {
      if (typeof self.loadPyodide !== "function") {
        self.importScripts("https://cdn.jsdelivr.net/pyodide/v0.27.2/full/pyodide.js");
      }

      if (typeof self.loadPyodide !== "function") {
        throw new Error("Failed to initialize Pyodide.");
      }

      pyodideInstance = await self.loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.27.2/full/",
      });

      return pyodideInstance;
    })();
  }

  return pyodideReady;
}

function buildRuntimeDiagnostics(tracebackText: string): Diagnostic[] {
  if (!tracebackText.trim()) {
    return [];
  }

  const lineMatch = tracebackText.match(/line (\d+)/);
  const line = lineMatch ? Number.parseInt(lineMatch[1], 10) : 1;

  return [
    {
      code: "RUN001",
      message: tracebackText.split("\n").slice(-2).join(" ").trim() || "Runtime error",
      severity: "error",
      line,
      column: 1,
      endLine: line,
      endColumn: 1,
      hint: "Inspect generated Python and runtime state.",
    },
  ];
}

self.onmessage = async (event: MessageEvent<RunWorkerMessage>) => {
  const { id, request } = event.data;

  try {
    const pyodide = await getPyodide();
    if (!runtimeReadyNotified) {
      const statusMessage: WorkerStatusMessage = { kind: "runtime-status", status: "ready" };
      self.postMessage(statusMessage);
      runtimeReadyNotified = true;
    }

    pyodide.globals.set("__runner_source", request.pythonCode);
    pyodide.globals.set("__runner_stdin_json", JSON.stringify(request.stdinLines));
    pyodide.globals.set("__runner_vfs_json", JSON.stringify(request.virtualFiles));

    const resultProxy = await pyodide.runPythonAsync(`
import json
import traceback

_runtime_stdin = json.loads(__runner_stdin_json)
_runtime_vfs = json.loads(__runner_vfs_json)
_runtime_globals = {
    "__stdin_lines": _runtime_stdin,
    "__virtual_files": _runtime_vfs,
}
_runtime_error = ""

try:
    exec(__runner_source, _runtime_globals, _runtime_globals)
except Exception:
    _runtime_error = traceback.format_exc()

_runtime_out = _runtime_globals.get("__stdout", [])
_runtime_vfs_out = _runtime_globals.get("__vfs", _runtime_globals.get("__virtual_files", {}))
{
    "stdout": "\\n".join(str(value) for value in _runtime_out),
    "error": _runtime_error,
    "vfs": {str(name): list(values) for name, values in _runtime_vfs_out.items()},
}
`);

    const resultData = (resultProxy.toJs
      ? resultProxy.toJs({ dict_converter: Object.fromEntries })
      : resultProxy) as WorkerRunData;
    if (resultProxy.destroy) {
      resultProxy.destroy();
    }

    const diagnostics = buildRuntimeDiagnostics(String(resultData.error ?? ""));

    const result: RunResult = {
      success: diagnostics.length === 0,
      stdout: String(resultData.stdout ?? ""),
      stderr: String(resultData.error ?? ""),
      diagnostics,
      virtualFiles: (resultData.vfs ?? {}) as Record<string, string[]>,
    };

    const response: WorkerRunResponseMessage = { kind: "run-result", id, result };
    self.postMessage(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown worker error";
    const result: RunResult = {
      success: false,
      stdout: "",
      stderr: message,
      diagnostics: [
        {
          code: "RUN500",
          message,
          severity: "error",
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 1,
        },
      ],
      virtualFiles: request.virtualFiles,
    };

    const response: WorkerRunResponseMessage = { kind: "run-result", id, result };
    self.postMessage(response);
  }
};

export {};
