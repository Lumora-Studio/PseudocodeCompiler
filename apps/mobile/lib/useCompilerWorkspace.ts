import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { RefObject } from "react";
import { Alert } from "react-native";
import type WebView from "react-native-webview";
import type { WebViewMessageEvent } from "react-native-webview";
import { compilePseudocode } from "@igcse/compiler";
import type { Diagnostic, RunResult } from "@igcse/compiler/types";
import {
  createDocument,
  createFolder,
  deleteNodes,
  getActiveDocument,
  getNodePath,
  moveNodes,
  setActiveDocument,
  setDocumentCompileSummary,
  setExpandedFolders,
  updateDocumentSource,
  workspaceHasFolder,
  type CompileSummary,
  type WorkspaceState,
} from "@igcse/workspace";
import { PythonRunner } from "./pythonRunner";
import { loadWorkspace, saveWorkspace } from "./storage";

const DEFAULT_SOURCE = `DECLARE name : STRING
DECLARE value : INTEGER
DECLARE active : BOOLEAN

INPUT name
OUTPUT "Hello, ", name

IF name = "Alex" THEN
    OUTPUT "Welcome User"
ENDIF

FOR count ← 1 TO 5
    OUTPUT count
NEXT count

WHILE total < limit DO
    OUTPUT "looping"
ENDWHILE`;

const INITIAL_TERMINAL_TEXT = `$ pseudocode run layout.pseudo
Enter name: Alex
Hello, Alex
Welcome User`;

const INPUT_REQUEST_ERROR_TEXT = "INPUT requested but no stdin lines remain";
const MAX_INTERACTIVE_INPUTS = 200;
const TERMINAL_PROMPT = ">";

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
        `[${diagnostic.code}] ${diagnostic.severity.toUpperCase()} ` +
        `L${diagnostic.line}:C${diagnostic.column} ${diagnostic.message}`,
    )
    .join("\n");
}

function summarizeDiagnostics(diagnostics: Diagnostic[]): CompileSummary {
  const errorCount = diagnostics.filter(
    (diagnostic) => diagnostic.severity === "error",
  ).length;
  const warningCount = diagnostics.filter(
    (diagnostic) => diagnostic.severity === "warning",
  ).length;

  return {
    severity:
      errorCount > 0 ? "error" : warningCount > 0 ? "warning" : "success",
    errorCount,
    warningCount,
    updatedAt: new Date().toISOString(),
  };
}

interface CompilePayload {
  document: ReturnType<typeof getActiveDocument>;
  result: ReturnType<typeof compilePseudocode>;
}

export interface CompilerWorkspaceController {
  workspace: WorkspaceState | null;
  activeDocument: ReturnType<typeof getActiveDocument> | null;
  breadcrumbs: ReturnType<typeof getNodePath>;
  compileDiagnostics: Diagnostic[];
  terminalText: string;
  pendingInputPrompt: string | null;
  pendingInputText: string;
  isRunning: boolean;
  saveError: string | null;
  pyodideWebViewRef: RefObject<WebView | null>;
  handlePyodideMessage: (event: WebViewMessageEvent) => void;
  setPendingInputText: (text: string) => void;
  submitPendingInput: () => void;
  cancelPendingInput: () => void;
  runCurrent: () => Promise<void>;
  selectDocument: (documentId: string) => void;
  updateActiveDocumentSource: (source: string) => void;
  toggleFolder: (folderId: string) => void;
  createFolderInWorkspace: (parentId?: string) => void;
  createDocumentInWorkspace: (parentId?: string) => void;
  deleteNodesInWorkspace: (nodeIds: string[]) => boolean;
  moveNodesInWorkspace: (
    nodeIds: string[],
    targetFolderId: string,
    targetIndex: number,
  ) => boolean;
  clearTerminal: () => void;
}

export function useCompilerWorkspace(): CompilerWorkspaceController {
  const [workspace, setWorkspace] = useState<WorkspaceState | null>(null);
  const [compileDiagnostics, setCompileDiagnostics] = useState<Diagnostic[]>([]);
  const [terminalText, setTerminalText] = useState(INITIAL_TERMINAL_TEXT);
  const [pendingInputPrompt, setPendingInputPrompt] = useState<string | null>(
    null,
  );
  const [pendingInputText, setPendingInputText] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const pendingInputResolverRef = useRef<((value: string | null) => void) | null>(
    null,
  );
  const pyodideWebViewRef = useRef<WebView | null>(null);
  const pythonRunnerRef = useRef<PythonRunner | null>(null);
  const workspaceRef = useRef<WorkspaceState | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedRef = useRef(false);
  const lastActiveDocumentIdRef = useRef<string | null>(null);

  useEffect(() => {
    pythonRunnerRef.current = new PythonRunner(pyodideWebViewRef);

    return () => {
      pythonRunnerRef.current?.dispose();
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      const resolver = pendingInputResolverRef.current;
      if (resolver) {
        pendingInputResolverRef.current = null;
        resolver(null);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    loadWorkspace(DEFAULT_SOURCE).then((loadedWorkspace) => {
      if (cancelled) {
        return;
      }

      workspaceRef.current = loadedWorkspace;
      startTransition(() => {
        setWorkspace(loadedWorkspace);
      });
      loadedRef.current = true;
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const persistWorkspace = useCallback(async (nextWorkspace: WorkspaceState) => {
    try {
      await saveWorkspace(nextWorkspace);
      setSaveError(null);
    } catch {
      setSaveError("Autosave failed.");
    }
  }, []);

  const commitWorkspace = useCallback(
    (nextWorkspace: WorkspaceState, mode: "immediate" | "debounced") => {
      workspaceRef.current = nextWorkspace;
      startTransition(() => {
        setWorkspace(nextWorkspace);
      });

      if (!loadedRef.current) {
        return;
      }

      if (mode === "immediate") {
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
        void persistWorkspace(nextWorkspace);
        return;
      }

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null;
        void persistWorkspace(nextWorkspace);
      }, 400);
    },
    [persistWorkspace],
  );

  const updateWorkspaceState = useCallback(
    (
      updater: (current: WorkspaceState) => WorkspaceState,
      mode: "immediate" | "debounced",
    ) => {
      const current = workspaceRef.current;
      if (!current) {
        return;
      }

      commitWorkspace(updater(current), mode);
    },
    [commitWorkspace],
  );

  const activeDocument = useMemo(() => {
    return workspace ? getActiveDocument(workspace) : null;
  }, [workspace]);

  const breadcrumbs = useMemo(() => {
    return workspace && activeDocument
      ? getNodePath(workspace, activeDocument.id)
      : [];
  }, [workspace, activeDocument]);

  const handlePyodideMessage = useCallback((event: WebViewMessageEvent) => {
    let data: { type: string; id?: number; status?: string; result?: RunResult };

    try {
      data = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }

    pythonRunnerRef.current?.handleMessage(data);
  }, []);

  const resolvePendingInput = useCallback((value: string | null) => {
    const resolver = pendingInputResolverRef.current;
    if (!resolver) {
      return;
    }

    pendingInputResolverRef.current = null;
    setPendingInputPrompt(null);
    setPendingInputText("");
    resolver(value);
  }, []);

  const waitForTerminalInput = useCallback(
    (prompt: string) => {
      const existing = pendingInputResolverRef.current;
      if (existing) {
        pendingInputResolverRef.current = null;
        existing(null);
      }

      setPendingInputPrompt(prompt);
      setPendingInputText("");

      return new Promise<string | null>((resolve) => {
        pendingInputResolverRef.current = resolve;
      });
    },
    [],
  );

  useEffect(() => {
    if (!activeDocument) {
      return;
    }

    if (lastActiveDocumentIdRef.current === null) {
      lastActiveDocumentIdRef.current = activeDocument.id;
      return;
    }

    lastActiveDocumentIdRef.current = activeDocument.id;
    resolvePendingInput(null);
    setCompileDiagnostics([]);
    setTerminalText("");
  }, [activeDocument?.id, resolvePendingInput]);

  const syncCompileSummary = useCallback(
    (documentId: string, diagnostics: Diagnostic[]) => {
      updateWorkspaceState(
        (current) =>
          setDocumentCompileSummary(
            current,
            documentId,
            summarizeDiagnostics(diagnostics),
          ),
        "immediate",
      );
    },
    [updateWorkspaceState],
  );

  const compileCurrent = useCallback((): CompilePayload | null => {
    const currentWorkspace = workspaceRef.current;
    if (!currentWorkspace) {
      return null;
    }

    const document = getActiveDocument(currentWorkspace);
    return {
      document,
      result: compilePseudocode({
        source: document.source,
        filename: document.name,
        strict: true,
      }),
    };
  }, []);

  const runCurrent = useCallback(async () => {
    const payload = compileCurrent();
    if (!payload) {
      return;
    }

    const { document, result: compileResult } = payload;
    setCompileDiagnostics(compileResult.diagnostics);
    syncCompileSummary(document.id, compileResult.diagnostics);

    if (!compileResult.success || !compileResult.pythonCode) {
      setTerminalText(
        `Compile failed for ${document.name}.\n\n${formatDiagnostics(
          compileResult.diagnostics,
        )}`,
      );
      return;
    }

    if (!pythonRunnerRef.current) {
      return;
    }

    setIsRunning(true);
    setTerminalText("");

    const stdinLines: string[] = [];
    const transcript: string[] = [];
    let renderedStdout = "";

    const syncStdoutToTranscript = (stdout: string) => {
      const normalizedStdout = stdout.replace(/\r\n/g, "\n");
      if (normalizedStdout === renderedStdout) {
        return;
      }

      let delta = normalizedStdout;
      if (normalizedStdout.startsWith(renderedStdout)) {
        delta = normalizedStdout.slice(renderedStdout.length);
      }

      if (delta.startsWith("\n")) {
        delta = delta.slice(1);
      }

      if (delta.length > 0) {
        transcript.push(...delta.split("\n"));
        setTerminalText(transcript.join("\n"));
      }

      renderedStdout = normalizedStdout;
    };

    try {
      let runResult = await pythonRunnerRef.current.run({
        pythonCode: compileResult.pythonCode,
        stdinLines: [...stdinLines],
        virtualFiles: {},
      });

      while (isInputRequestRuntimeError(runResult.stderr)) {
        syncStdoutToTranscript(runResult.stdout);

        if (stdinLines.length >= MAX_INTERACTIVE_INPUTS) {
          setTerminalText(
            [...transcript, `Stopped after ${MAX_INTERACTIVE_INPUTS} INPUT requests.`].join(
              "\n",
            ),
          );
          return;
        }

        const nextInput = await waitForTerminalInput(TERMINAL_PROMPT);
        if (nextInput === null) {
          setTerminalText([...transcript, "Run cancelled."].join("\n"));
          return;
        }

        stdinLines.push(nextInput);
        transcript.push(`${TERMINAL_PROMPT} ${nextInput}`);
        setTerminalText(transcript.join("\n"));

        runResult = await pythonRunnerRef.current.run({
          pythonCode: compileResult.pythonCode,
          stdinLines: [...stdinLines],
          virtualFiles: {},
        });
      }

      syncStdoutToTranscript(runResult.stdout);

      if (runResult.stderr.trim().length > 0) {
        transcript.push(...runResult.stderr.trim().split("\n"));
      } else if (runResult.diagnostics.length > 0) {
        transcript.push(...formatDiagnostics(runResult.diagnostics).split("\n"));
      }

      if (transcript.length === 0) {
        transcript.push("Program finished with no output.");
      }

      setTerminalText(transcript.join("\n"));
    } finally {
      resolvePendingInput(null);
      setIsRunning(false);
    }
  }, [compileCurrent, resolvePendingInput, syncCompileSummary, waitForTerminalInput]);

  const selectDocument = useCallback(
    (documentId: string) => {
      updateWorkspaceState(
        (current) => setActiveDocument(current, documentId),
        "immediate",
      );
    },
    [updateWorkspaceState],
  );

  const updateActiveDocumentSource = useCallback(
    (source: string) => {
      if (!activeDocument) {
        return;
      }

      setCompileDiagnostics([]);
      updateWorkspaceState(
        (current) => updateDocumentSource(current, activeDocument.id, source),
        "debounced",
      );
    },
    [activeDocument, updateWorkspaceState],
  );

  const toggleFolder = useCallback(
    (folderId: string) => {
      updateWorkspaceState((current) => {
        const expanded = new Set(current.expandedFolderIds ?? []);
        if (expanded.has(folderId)) {
          expanded.delete(folderId);
        } else {
          expanded.add(folderId);
        }

        expanded.add(current.rootFolderId);
        return setExpandedFolders(current, Array.from(expanded));
      }, "immediate");
    },
    [updateWorkspaceState],
  );

  const createFolderInWorkspace = useCallback(
    (parentId?: string) => {
      updateWorkspaceState(
        (current) =>
          createFolder(current, {
            parentId:
              parentId && workspaceHasFolder(current, parentId)
                ? parentId
                : current.rootFolderId,
          }),
        "immediate",
      );
    },
    [updateWorkspaceState],
  );

  const createDocumentInWorkspace = useCallback(
    (parentId?: string) => {
      updateWorkspaceState(
        (current) =>
          createDocument(current, {
            parentId:
              parentId && workspaceHasFolder(current, parentId)
                ? parentId
                : current.rootFolderId,
            source: "",
          }),
        "immediate",
      );
    },
    [updateWorkspaceState],
  );

  const deleteNodesInWorkspace = useCallback(
    (nodeIds: string[]) => {
      try {
        updateWorkspaceState(
          (current) => deleteNodes(current, nodeIds),
          "immediate",
        );
        return true;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to delete the selected items.";
        Alert.alert("Workspace Error", message);
        return false;
      }
    },
    [updateWorkspaceState],
  );

  const moveNodesInWorkspace = useCallback(
    (nodeIds: string[], targetFolderId: string, targetIndex: number) => {
      try {
        updateWorkspaceState(
          (current) =>
            moveNodes(current, nodeIds, targetFolderId, targetIndex),
          "immediate",
        );
        return true;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to move the selected items.";
        Alert.alert("Workspace Error", message);
        return false;
      }
    },
    [updateWorkspaceState],
  );

  const clearTerminal = useCallback(() => {
    resolvePendingInput(null);
    setTerminalText("");
  }, [resolvePendingInput]);

  return {
    workspace,
    activeDocument,
    breadcrumbs,
    compileDiagnostics,
    terminalText,
    pendingInputPrompt,
    pendingInputText,
    isRunning,
    saveError,
    pyodideWebViewRef,
    handlePyodideMessage,
    setPendingInputText,
    submitPendingInput: () => resolvePendingInput(pendingInputText),
    cancelPendingInput: () => resolvePendingInput(null),
    runCurrent,
    selectDocument,
    updateActiveDocumentSource,
    toggleFolder,
    createFolderInWorkspace,
    createDocumentInWorkspace,
    deleteNodesInWorkspace,
    moveNodesInWorkspace,
    clearTerminal,
  };
}
