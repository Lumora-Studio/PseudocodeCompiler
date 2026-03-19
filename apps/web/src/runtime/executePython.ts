import { RunRequest, RunResult } from "@/compiler/types";

interface PendingRequest {
  resolve: (result: RunResult) => void;
  reject: (error: Error) => void;
}

interface WorkerRunResponse {
  kind: "run-result";
  id: number;
  result: RunResult;
}

interface WorkerStatusMessage {
  kind: "runtime-status";
  status: "ready";
}

type WorkerMessage = WorkerRunResponse | WorkerStatusMessage;

const DEFAULT_EXECUTION_TIMEOUT_MS = 12_000;
const INITIALIZATION_TIMEOUT_MS = 45_000;

class PythonRunner {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<number, PendingRequest>();
  private runtimeReady = false;

  private ensureWorker(): Worker {
    if (this.worker) {
      return this.worker;
    }

    this.worker = new Worker(new URL("../workers/pythonRunner.worker.ts", import.meta.url));

    this.worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      if (event.data.kind === "runtime-status") {
        this.runtimeReady = event.data.status === "ready";
        return;
      }

      const { id, result } = event.data;
      const pending = this.pending.get(id);
      if (!pending) {
        return;
      }
      this.pending.delete(id);
      pending.resolve(result);
    };

    this.worker.onerror = (event) => {
      const error = new Error(event.message || "Python worker crashed.");
      for (const pending of this.pending.values()) {
        pending.reject(error);
      }
      this.pending.clear();
      this.resetWorker();
    };

    return this.worker;
  }

  private resetWorker() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.runtimeReady = false;
  }

  async run(request: RunRequest, timeoutMs = DEFAULT_EXECUTION_TIMEOUT_MS): Promise<RunResult> {
    const worker = this.ensureWorker();
    const id = this.nextId;
    this.nextId += 1;
    const runtimeWasReadyAtStart = this.runtimeReady;
    const effectiveTimeoutMs = runtimeWasReadyAtStart ? timeoutMs : Math.max(timeoutMs, INITIALIZATION_TIMEOUT_MS);

    const workerPromise = new Promise<RunResult>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      worker.postMessage({ id, request });
    });

    const timeoutPromise = new Promise<RunResult>((resolve) => {
      const timer = window.setTimeout(() => {
        this.pending.delete(id);
        const runtimeInitialized = this.runtimeReady || runtimeWasReadyAtStart;
        if (runtimeInitialized) {
          this.resetWorker();
        }
        resolve({
          success: false,
          stdout: "",
          stderr: runtimeInitialized
            ? "Execution timed out."
            : "Python runtime initialization timed out.",
          diagnostics: [
            {
              code: runtimeInitialized ? "RUN408" : "RUN409",
              message: runtimeInitialized
                ? `Execution exceeded ${effectiveTimeoutMs / 1000} seconds and was stopped.`
                : `Python runtime initialization exceeded ${effectiveTimeoutMs / 1000} seconds.`,
              severity: "error",
              line: 1,
              column: 1,
              endLine: 1,
              endColumn: 1,
              hint: runtimeInitialized
                ? "Check for infinite loops or large computations."
                : "The first run downloads Python runtime files. Check your internet connection and retry.",
            },
          ],
          virtualFiles: request.virtualFiles,
        });
      }, effectiveTimeoutMs);

      workerPromise.finally(() => {
        window.clearTimeout(timer);
      });
    });

    try {
      return await Promise.race([workerPromise, timeoutPromise]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown runtime error";
      return {
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
    }
  }
}

export const pythonRunner = new PythonRunner();
