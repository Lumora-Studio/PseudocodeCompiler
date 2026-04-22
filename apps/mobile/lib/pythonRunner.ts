import { RefObject } from "react";
import type WebView from "react-native-webview";
import type { RunRequest, RunResult } from "@pseudocode-compiler/compiler/types";

interface PendingRequest {
  resolve: (result: RunResult) => void;
  timer: ReturnType<typeof setTimeout>;
}

const DEFAULT_TIMEOUT_MS = 12_000;
const INIT_TIMEOUT_MS = 45_000;

export class PythonRunner {
  private webViewRef: RefObject<WebView | null>;
  private nextId = 1;
  private pending = new Map<number, PendingRequest>();
  private runtimeReady = false;

  constructor(webViewRef: RefObject<WebView | null>) {
    this.webViewRef = webViewRef;
  }

  handleMessage(data: {
    type: string;
    id?: number;
    status?: string;
    result?: RunResult;
  }): void {
    if (data.type === "runtime-status" && data.status === "ready") {
      this.runtimeReady = true;
      return;
    }

    if (data.type === "run-result" && data.id !== undefined && data.result) {
      const pending = this.pending.get(data.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(data.id);
      pending.resolve(data.result);
    }
  }

  private injectMessage(msg: object): void {
    this.webViewRef.current?.injectJavaScript(
      `(function(){
        var evt = new MessageEvent("message", { data: ${JSON.stringify(JSON.stringify(msg))} });
        window.dispatchEvent(evt);
      })(); true;`
    );
  }

  async run(
    request: RunRequest,
    timeoutMs = DEFAULT_TIMEOUT_MS
  ): Promise<RunResult> {
    const id = this.nextId++;
    const effectiveTimeout = this.runtimeReady
      ? timeoutMs
      : Math.max(timeoutMs, INIT_TIMEOUT_MS);

    return new Promise<RunResult>((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        const initialized = this.runtimeReady;
        resolve({
          success: false,
          stdout: "",
          stderr: initialized
            ? "Execution timed out."
            : "Python runtime initialization timed out.",
          diagnostics: [
            {
              code: initialized ? "RUN408" : "RUN409",
              message: initialized
                ? `Execution exceeded ${effectiveTimeout / 1000} seconds and was stopped.`
                : `Python runtime initialization exceeded ${effectiveTimeout / 1000} seconds.`,
              severity: "error",
              line: 1,
              column: 1,
              endLine: 1,
              endColumn: 1,
              hint: initialized
                ? "Check for infinite loops or large computations."
                : "The first run downloads Python runtime files. Check your internet connection and retry.",
            },
          ],
          virtualFiles: request.virtualFiles,
        });
      }, effectiveTimeout);

      this.pending.set(id, { resolve, timer });
      this.injectMessage({ type: "run", id, request });
    });
  }

  dispose(): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.resolve({
        success: false,
        stdout: "",
        stderr: "Runner disposed.",
        diagnostics: [],
        virtualFiles: {},
      });
    }
    this.pending.clear();
  }
}
