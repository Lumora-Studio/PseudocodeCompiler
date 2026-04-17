"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  closeEditorTab,
  closePanel,
  createDocument,
  createFolder,
  createPanel,
  deleteNodes,
  dockPanel,
  ensureTerminalPanel,
  focusPanel,
  getActiveDocument,
  getNodePath,
  moveEditorTab,
  moveNodes,
  openDocumentInFocusedEditor,
  renameNode,
  resizeSplit,
  resetWorkspaceLayout,
  setDocumentCompileSummary,
  setEditorPanelActiveDocument,
  setExpandedFolders,
  setFilesPanelSelection,
  splitEditorPanel,
  type CompileSummary,
  type WorkspaceDockPosition,
  type WorkspacePanelKind,
  type WorkspaceState,
  updateDocumentSource,
  updateVirtualFiles,
  workspaceHasFolder,
} from "@igcse/workspace";
import { compilePseudocode } from "@/compiler";
import type { Diagnostic } from "@/compiler/types";
import {
  DEFAULT_AUTOSAVE_INTERVAL_MINUTES,
  loadWorkspace,
  loadWorkspaceSettings,
  saveWorkspace,
  saveWorkspaceSettings,
} from "@/lib/storage";
import { pythonRunner } from "@/runtime/executePython";

const INPUT_REQUEST_ERROR_TEXT = "INPUT requested but no stdin lines remain";
const MAX_INTERACTIVE_INPUTS = 200;
const TERMINAL_PROMPT = ">";

export interface AppNotice {
  tone: "error" | "info";
  message: string;
}

interface PendingTerminalInput {
  panelId: string | null;
  prompt: string | null;
  text: string;
}

type SaveBehavior = "tracked" | "untracked";
type SaveReason = "manual" | "autosave" | "background" | "close";

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

function summarizeDiagnostics(diagnostics: Diagnostic[]): CompileSummary {
  const errorCount = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
  const warningCount = diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length;
  return {
    severity: errorCount > 0 ? "error" : warningCount > 0 ? "warning" : "success",
    errorCount,
    warningCount,
    updatedAt: new Date().toISOString(),
  };
}

function getTrackedWorkspaceFingerprint(workspace: WorkspaceState): string {
  const trackedNodes = Object.values(workspace.nodes)
    .filter((node) => node.type === "document" || node.type === "folder")
    .map((node) =>
      node.type === "document"
        ? {
            id: node.id,
            type: node.type,
            parentId: node.parentId,
            name: node.name,
            order: node.order,
            source: node.source,
          }
        : {
            id: node.id,
            type: node.type,
            parentId: node.parentId,
            name: node.name,
            order: node.order,
          },
    )
    .sort((left, right) => left.id.localeCompare(right.id));

  return JSON.stringify({
    rootFolderId: workspace.rootFolderId,
    nodes: trackedNodes,
  });
}

export function useWorkspaceSession(defaultSource: string) {
  const [workspace, setWorkspace] = useState<WorkspaceState | null>(null);
  const [compileDiagnostics, setCompileDiagnostics] = useState<Diagnostic[]>([]);
  const [terminalOutputs, setTerminalOutputs] = useState<Record<string, string>>({});
  const [pendingInput, setPendingInput] = useState<PendingTerminalInput>({
    panelId: null,
    prompt: null,
    text: "",
  });
  const [isRunning, setIsRunning] = useState(false);
  const [runningTerminalPanelId, setRunningTerminalPanelId] = useState<string | null>(null);
  const [autosaveIntervalMinutes, setAutosaveIntervalMinutes] = useState(
    DEFAULT_AUTOSAVE_INTERVAL_MINUTES,
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [appNotice, setAppNotice] = useState<AppNotice | null>(null);

  const workspaceRef = useRef<WorkspaceState | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const autosaveIntervalRef = useRef(DEFAULT_AUTOSAVE_INTERVAL_MINUTES);
  const hasUnsavedChangesRef = useRef(false);
  const lastSavedTrackedFingerprintRef = useRef("");
  const savePromiseRef = useRef<Promise<boolean> | null>(null);
  const loadedRef = useRef(false);
  const pendingInputResolverRef = useRef<((value: string | null) => void) | null>(null);

  const updateDirtyState = useCallback((value: boolean) => {
    hasUnsavedChangesRef.current = value;
    setHasUnsavedChanges(value);
  }, []);

  const clearScheduledSave = useCallback(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      loadWorkspace(defaultSource),
      loadWorkspaceSettings().catch(() => ({
        autosaveIntervalMinutes: DEFAULT_AUTOSAVE_INTERVAL_MINUTES,
      })),
    ]).then(([loadedWorkspace, loadedSettings]) => {
      if (cancelled) {
        return;
      }

      const trackedFingerprint = getTrackedWorkspaceFingerprint(loadedWorkspace);
      workspaceRef.current = loadedWorkspace;
      lastSavedTrackedFingerprintRef.current = trackedFingerprint;
      autosaveIntervalRef.current = loadedSettings.autosaveIntervalMinutes;
      setWorkspace(loadedWorkspace);
      setAutosaveIntervalMinutes(loadedSettings.autosaveIntervalMinutes);
      updateDirtyState(false);
      loadedRef.current = true;
    });

    return () => {
      cancelled = true;
      clearScheduledSave();
      const resolver = pendingInputResolverRef.current;
      if (resolver) {
        pendingInputResolverRef.current = null;
        resolver(null);
      }
    };
  }, [clearScheduledSave, defaultSource, updateDirtyState]);

  const persistWorkspace = useCallback(
    async (reason: SaveReason) => {
      if (savePromiseRef.current) {
        return savePromiseRef.current;
      }

      const currentWorkspace = workspaceRef.current;
      if (!currentWorkspace) {
        return false;
      }

      const saveTask = (async () => {
        setIsSaving(true);

        try {
          await saveWorkspace(currentWorkspace);
          lastSavedTrackedFingerprintRef.current = getTrackedWorkspaceFingerprint(currentWorkspace);
          updateDirtyState(false);
          setSaveError(null);

          if (reason === "manual") {
            setAppNotice({
              tone: "info",
              message: "All files and folders were saved.",
            });
          }

          return true;
        } catch {
          if (reason === "manual" || reason === "close") {
            setSaveError("Save failed. Changes remain in memory on this device.");
          } else {
            setSaveError("Autosave failed. Changes remain in memory on this device.");
          }
          return false;
        } finally {
          setIsSaving(false);
        }
      })();

      savePromiseRef.current = saveTask.finally(() => {
        savePromiseRef.current = null;
      });

      return savePromiseRef.current;
    },
    [updateDirtyState],
  );

  const scheduleWorkspaceSave = useCallback(
    (reason: SaveReason, delayMs: number) => {
      clearScheduledSave();
      saveTimerRef.current = window.setTimeout(() => {
        saveTimerRef.current = null;
        void persistWorkspace(reason);
      }, delayMs);
    },
    [clearScheduledSave, persistWorkspace],
  );

  const commitWorkspace = useCallback(
    (nextWorkspace: WorkspaceState, mode: SaveBehavior) => {
      workspaceRef.current = nextWorkspace;
      setWorkspace(nextWorkspace);

      if (!loadedRef.current) {
        return;
      }

      const trackedFingerprint = getTrackedWorkspaceFingerprint(nextWorkspace);
      const isDirty = trackedFingerprint !== lastSavedTrackedFingerprintRef.current;
      updateDirtyState(isDirty);

      if (mode === "tracked") {
        scheduleWorkspaceSave("autosave", autosaveIntervalRef.current * 60 * 1000);
        return;
      }

      if (isDirty) {
        scheduleWorkspaceSave("autosave", autosaveIntervalRef.current * 60 * 1000);
        return;
      }

      scheduleWorkspaceSave("background", 500);
    },
    [scheduleWorkspaceSave, updateDirtyState],
  );

  const resolvePendingInput = useCallback((value: string | null) => {
    const resolver = pendingInputResolverRef.current;
    if (!resolver) {
      return;
    }
    pendingInputResolverRef.current = null;
    setPendingInput({
      panelId: null,
      prompt: null,
      text: "",
    });
    resolver(value);
  }, []);

  const waitForTerminalInput = useCallback((panelId: string, prompt: string) => {
    const existingResolver = pendingInputResolverRef.current;
    if (existingResolver) {
      pendingInputResolverRef.current = null;
      existingResolver(null);
    }
    setPendingInput({
      panelId,
      prompt,
      text: "",
    });
    return new Promise<string | null>((resolve) => {
      pendingInputResolverRef.current = resolve;
    });
  }, []);

  const showAppError = useCallback((message: string) => {
    setAppNotice({
      tone: "error",
      message,
    });
  }, []);

  const dismissNotice = useCallback(() => setAppNotice(null), []);

  const applyWorkspaceUpdate = useCallback(
    (updater: (current: WorkspaceState) => WorkspaceState, mode: SaveBehavior) => {
      const current = workspaceRef.current;
      if (!current) {
        return null;
      }

      try {
        const next = updater(current);
        commitWorkspace(next, mode);
        return next;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to update the workspace.";
        showAppError(message);
        return null;
      }
    },
    [commitWorkspace, showAppError],
  );

  const saveWorkspaceNow = useCallback(
    async (reason: SaveReason = "manual") => {
      clearScheduledSave();
      return persistWorkspace(reason);
    },
    [clearScheduledSave, persistWorkspace],
  );

  const updateAutosaveInterval = useCallback(
    async (minutes: number) => {
      const normalized = Math.max(1, Math.min(60, Math.round(minutes)));
      autosaveIntervalRef.current = normalized;
      setAutosaveIntervalMinutes(normalized);

      try {
        await saveWorkspaceSettings({
          autosaveIntervalMinutes: normalized,
        });
      } catch {
        showAppError("Unable to save autosave settings.");
      }

      if (hasUnsavedChangesRef.current) {
        scheduleWorkspaceSave("autosave", normalized * 60 * 1000);
      }
    },
    [scheduleWorkspaceSave, showAppError],
  );

  const activeDocument = useMemo(() => {
    return workspace ? getActiveDocument(workspace) : null;
  }, [workspace]);

  const breadcrumbs = useMemo(() => {
    return workspace && activeDocument ? getNodePath(workspace, activeDocument.id) : [];
  }, [workspace, activeDocument]);

  const activeDocumentId = activeDocument?.id ?? null;
  const activeDocumentName = activeDocument?.name ?? "";
  const terminalPanelIds = useMemo(() => {
    if (!workspace) {
      return [];
    }
    return Object.entries(workspace.panelInstances)
      .filter(([, panel]) => panel.kind === "terminal")
      .map(([panelId]) => panelId)
      .sort();
  }, [workspace]);

  useEffect(() => {
    if (!activeDocumentId) {
      return;
    }
    resolvePendingInput(null);
    setCompileDiagnostics([]);
  }, [activeDocumentId, resolvePendingInput]);

  useEffect(() => {
    if (!workspace || !activeDocumentName) {
      return;
    }

    setTerminalOutputs((current) => {
      const next: Record<string, string> = {};
      for (const panelId of terminalPanelIds) {
        next[panelId] = current[panelId] ?? `Terminal ready for ${activeDocumentName}.`;
      }
      return next;
    });
  }, [activeDocumentName, terminalPanelIds, workspace]);

  const updateTerminalOutput = useCallback((panelId: string, text: string) => {
    setTerminalOutputs((current) => ({
      ...current,
      [panelId]: text,
    }));
  }, []);

  const updateWorkspaceCompileSummary = useCallback(
    (documentId: string, diagnostics: Diagnostic[]) => {
      applyWorkspaceUpdate(
        (current) => setDocumentCompileSummary(current, documentId, summarizeDiagnostics(diagnostics)),
        "untracked",
      );
    },
    [applyWorkspaceUpdate],
  );

  const compileSource = useCallback((workspaceState?: WorkspaceState) => {
    const currentWorkspace = workspaceState ?? workspaceRef.current;
    if (!currentWorkspace) {
      return null;
    }

    const document = getActiveDocument(currentWorkspace);
    if (!document) {
      return null;
    }
    return {
      document,
      result: compilePseudocode({
        source: document.source,
        filename: document.name,
        strict: true,
      }),
    };
  }, []);

  const ensureTerminalTarget = useCallback(() => {
    let targetPanelId: string | null = null;
    const nextWorkspace = applyWorkspaceUpdate((current) => {
      const ensured = ensureTerminalPanel(current);
      targetPanelId = ensured.panelId;
      return ensured.state;
    }, "untracked");

    if (!nextWorkspace || !targetPanelId) {
      return null;
    }

    return {
      workspace: nextWorkspace,
      panelId: targetPanelId,
    };
  }, [applyWorkspaceUpdate]);

  const compileNow = useCallback(() => {
    const target = ensureTerminalTarget();
    if (!target) {
      return null;
    }

    const payload = compileSource(target.workspace);
    if (!payload) {
      updateTerminalOutput(target.panelId, "Create your first file to compile and run code.");
      return null;
    }

    const { document, result } = payload;
    setCompileDiagnostics(result.diagnostics);
    updateWorkspaceCompileSummary(document.id, result.diagnostics);

    updateTerminalOutput(
      target.panelId,
      result.success
        ? result.diagnostics.length > 0
          ? `Compile succeeded with notes for ${document.name}.\n\n${formatDiagnostics(result.diagnostics)}`
          : `Compile succeeded for ${document.name}.`
        : `Compile failed for ${document.name}.\n\n${formatDiagnostics(result.diagnostics)}`,
    );

    return {
      panelId: target.panelId,
      document,
      result,
    };
  }, [compileSource, ensureTerminalTarget, updateTerminalOutput, updateWorkspaceCompileSummary]);

  const runNow = useCallback(async () => {
    const target = ensureTerminalTarget();
    if (!target) {
      return;
    }

    const payload = compileSource(target.workspace);
    if (!payload) {
      updateTerminalOutput(target.panelId, "Create your first file to compile and run code.");
      return;
    }

    const { document, result: compileResult } = payload;
    setCompileDiagnostics(compileResult.diagnostics);
    updateWorkspaceCompileSummary(document.id, compileResult.diagnostics);

    if (!compileResult.success || !compileResult.pythonCode) {
      updateTerminalOutput(target.panelId, `Compile failed for ${document.name}.\n\n${formatDiagnostics(compileResult.diagnostics)}`);
      return;
    }

    setIsRunning(true);
    setRunningTerminalPanelId(target.panelId);
    updateTerminalOutput(target.panelId, "");

    const stdinLines: string[] = [];
    const transcript: string[] = [];
    let renderedStdout = "";
    let latestVirtualFiles = target.workspace.virtualFiles;

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
        updateTerminalOutput(target.panelId, transcript.join("\n"));
      }

      renderedStdout = normalizedStdout;
    };

    try {
      let runResult = await pythonRunner.run({
        pythonCode: compileResult.pythonCode,
        stdinLines: [...stdinLines],
        virtualFiles: latestVirtualFiles,
      });

      while (isInputRequestRuntimeError(runResult.stderr)) {
        syncStdoutToTranscript(runResult.stdout);

        if (stdinLines.length >= MAX_INTERACTIVE_INPUTS) {
          updateTerminalOutput(
            target.panelId,
            [...transcript, `Stopped after ${MAX_INTERACTIVE_INPUTS} INPUT requests to avoid an infinite input loop.`].join(
              "\n",
            ),
          );
          return;
        }

        const nextInput = await waitForTerminalInput(target.panelId, TERMINAL_PROMPT);
        if (nextInput === null) {
          updateTerminalOutput(target.panelId, [...transcript, "Run cancelled."].join("\n"));
          return;
        }

        stdinLines.push(nextInput);
        transcript.push(`${TERMINAL_PROMPT} ${nextInput}`);
        updateTerminalOutput(target.panelId, transcript.join("\n"));

        runResult = await pythonRunner.run({
          pythonCode: compileResult.pythonCode,
          stdinLines: [...stdinLines],
          virtualFiles: latestVirtualFiles,
        });
      }

      syncStdoutToTranscript(runResult.stdout);
      latestVirtualFiles = runResult.virtualFiles;

      if (runResult.stderr.trim().length > 0) {
        transcript.push(...runResult.stderr.trim().split("\n"));
      } else if (runResult.diagnostics.length > 0) {
        transcript.push(...formatDiagnostics(runResult.diagnostics).split("\n"));
      }

      if (transcript.length === 0) {
        transcript.push("Program finished with no output.");
      }

      updateTerminalOutput(target.panelId, transcript.join("\n"));
      applyWorkspaceUpdate((current) => updateVirtualFiles(current, latestVirtualFiles), "untracked");
    } finally {
      resolvePendingInput(null);
      setIsRunning(false);
      setRunningTerminalPanelId(null);
    }
  }, [
    applyWorkspaceUpdate,
    compileSource,
    ensureTerminalTarget,
    resolvePendingInput,
    updateTerminalOutput,
    updateWorkspaceCompileSummary,
    waitForTerminalInput,
  ]);

  const selectDocument = useCallback(
    (documentId: string) => {
      applyWorkspaceUpdate((current) => openDocumentInFocusedEditor(current, documentId), "untracked");
    },
    [applyWorkspaceUpdate],
  );

  const handleDocumentSourceChange = useCallback(
    (documentId: string, source: string) => {
      setCompileDiagnostics([]);
      applyWorkspaceUpdate((current) => updateDocumentSource(current, documentId, source), "tracked");
    },
    [applyWorkspaceUpdate],
  );

  const toggleFolder = useCallback(
    (folderId: string) => {
      applyWorkspaceUpdate((current) => {
        const expanded = new Set(current.expandedFolderIds ?? []);
        if (expanded.has(folderId)) {
          expanded.delete(folderId);
        } else {
          expanded.add(folderId);
        }
        expanded.add(current.rootFolderId);
        return setExpandedFolders(current, Array.from(expanded));
      }, "untracked");
    },
    [applyWorkspaceUpdate],
  );

  const expandFolder = useCallback(
    (folderId: string) => {
      applyWorkspaceUpdate((current) => {
        const expanded = new Set(current.expandedFolderIds ?? []);
        if (expanded.has(folderId)) {
          return current;
        }
        expanded.add(current.rootFolderId);
        expanded.add(folderId);
        return setExpandedFolders(current, Array.from(expanded));
      }, "untracked");
    },
    [applyWorkspaceUpdate],
  );

  const createFolderInWorkspace = useCallback(
    (parentId?: string) => {
      applyWorkspaceUpdate(
        (current) =>
          createFolder(current, {
            parentId: parentId && workspaceHasFolder(current, parentId) ? parentId : current.rootFolderId,
          }),
        "tracked",
      );
    },
    [applyWorkspaceUpdate],
  );

  const createDocumentInWorkspace = useCallback(
    (parentId?: string) => {
      applyWorkspaceUpdate(
        (current) =>
          createDocument(current, {
            parentId: parentId && workspaceHasFolder(current, parentId) ? parentId : current.rootFolderId,
            source: "",
          }),
        "tracked",
      );
    },
    [applyWorkspaceUpdate],
  );

  const renameNodeInWorkspace = useCallback(
    (nodeId: string, name: string) => {
      return !!applyWorkspaceUpdate((current) => renameNode(current, nodeId, name), "tracked");
    },
    [applyWorkspaceUpdate],
  );

  const deleteNodesInWorkspace = useCallback(
    (nodeIds: string[]) => {
      return !!applyWorkspaceUpdate((current) => deleteNodes(current, nodeIds), "tracked");
    },
    [applyWorkspaceUpdate],
  );

  const moveNodesInWorkspace = useCallback(
    (nodeIds: string[], targetFolderId: string, targetIndex: number) => {
      return !!applyWorkspaceUpdate((current) => moveNodes(current, nodeIds, targetFolderId, targetIndex), "tracked");
    },
    [applyWorkspaceUpdate],
  );

  const focusWorkspacePanel = useCallback(
    (panelId: string) => {
      applyWorkspaceUpdate((current) => focusPanel(current, panelId), "untracked");
    },
    [applyWorkspaceUpdate],
  );

  const createWorkspacePanel = useCallback(
    (kind: WorkspacePanelKind) => {
      applyWorkspaceUpdate((current) => createPanel(current, kind).state, "untracked");
    },
    [applyWorkspaceUpdate],
  );

  const dockWorkspacePanel = useCallback(
    (panelId: string, targetStackId: string, position: WorkspaceDockPosition, targetIndex?: number) => {
      applyWorkspaceUpdate(
        (current) => dockPanel(current, panelId, targetStackId, position, targetIndex),
        "untracked",
      );
    },
    [applyWorkspaceUpdate],
  );

  const closeWorkspacePanel = useCallback(
    (panelId: string) => {
      if (runningTerminalPanelId === panelId) {
        showAppError("A terminal panel cannot be closed while a run is still active.");
        return;
      }
      applyWorkspaceUpdate((current) => closePanel(current, panelId), "untracked");
    },
    [applyWorkspaceUpdate, runningTerminalPanelId, showAppError],
  );

  const resizeWorkspaceSplit = useCallback(
    (splitId: string, sizes: number[]) => {
      applyWorkspaceUpdate((current) => resizeSplit(current, splitId, sizes), "untracked");
    },
    [applyWorkspaceUpdate],
  );

  const resetDockLayout = useCallback(() => {
    applyWorkspaceUpdate((current) => resetWorkspaceLayout(current), "untracked");
  }, [applyWorkspaceUpdate]);

  const splitEditor = useCallback(
    (panelId: string, direction: "right" | "bottom") => {
      applyWorkspaceUpdate((current) => splitEditorPanel(current, panelId, direction).state, "untracked");
    },
    [applyWorkspaceUpdate],
  );

  const setEditorActiveDocument = useCallback(
    (panelId: string, documentId: string) => {
      applyWorkspaceUpdate((current) => setEditorPanelActiveDocument(current, panelId, documentId), "untracked");
    },
    [applyWorkspaceUpdate],
  );

  const moveEditorDocumentTab = useCallback(
    (fromPanelId: string, toPanelId: string, documentId: string, targetIndex?: number) => {
      applyWorkspaceUpdate(
        (current) => moveEditorTab(current, fromPanelId, toPanelId, documentId, targetIndex),
        "untracked",
      );
    },
    [applyWorkspaceUpdate],
  );

  const closeEditorDocumentTab = useCallback(
    (panelId: string, documentId: string) => {
      applyWorkspaceUpdate((current) => closeEditorTab(current, panelId, documentId), "untracked");
    },
    [applyWorkspaceUpdate],
  );

  const updateFilesPanelSelection = useCallback(
    (panelId: string, fileName: string | undefined) => {
      applyWorkspaceUpdate((current) => setFilesPanelSelection(current, panelId, fileName), "untracked");
    },
    [applyWorkspaceUpdate],
  );

  const updateWorkspaceVirtualFiles = useCallback(
    (virtualFiles: Record<string, string[]>) => {
      applyWorkspaceUpdate((current) => updateVirtualFiles(current, virtualFiles), "untracked");
    },
    [applyWorkspaceUpdate],
  );

  const clearTerminal = useCallback(
    (panelId?: string) => {
      const current = workspaceRef.current;
      if (!current || !activeDocument) {
        return;
      }

      const resolvedPanelId =
        panelId ??
        current.lastFocusedTerminalPanelId ??
        Object.entries(current.panelInstances).find(([, panel]) => panel.kind === "terminal")?.[0] ??
        null;

      if (!resolvedPanelId) {
        return;
      }

      resolvePendingInput(null);
      updateTerminalOutput(
        resolvedPanelId,
        activeDocument ? `Terminal ready for ${activeDocument.name}.` : "Create your first file to run code.",
      );
    },
    [activeDocument, resolvePendingInput, updateTerminalOutput],
  );

  const submitPendingInput = useCallback(() => {
    resolvePendingInput(pendingInput.text);
  }, [pendingInput.text, resolvePendingInput]);

  const setPendingInputText = useCallback((value: string) => {
    setPendingInput((current) => ({
      ...current,
      text: value,
    }));
  }, []);

  return {
    workspace,
    activeDocument,
    breadcrumbs,
    compileDiagnostics,
    terminalOutputs,
    pendingInput,
    isRunning,
    runningTerminalPanelId,
    autosaveIntervalMinutes,
    hasUnsavedChanges,
    isSaving,
    saveError,
    appNotice,
    dismissNotice,
    saveWorkspaceNow,
    updateAutosaveInterval,
    setPendingInputText,
    submitPendingInput,
    cancelPendingInput: () => resolvePendingInput(null),
    compileNow,
    runNow,
    clearTerminal,
    selectDocument,
    handleDocumentSourceChange,
    toggleFolder,
    expandFolder,
    createFolderInWorkspace,
    createDocumentInWorkspace,
    renameNodeInWorkspace,
    deleteNodesInWorkspace,
    moveNodesInWorkspace,
    focusWorkspacePanel,
    createWorkspacePanel,
    dockWorkspacePanel,
    closeWorkspacePanel,
    resizeWorkspaceSplit,
    resetDockLayout,
    splitEditor,
    setEditorActiveDocument,
    moveEditorDocumentTab,
    closeEditorDocumentTab,
    updateFilesPanelSelection,
    updateWorkspaceVirtualFiles,
  };
}
