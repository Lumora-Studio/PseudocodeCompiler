"use client";

import {
  DragEvent,
  FormEvent,
  PointerEvent as ReactPointerEvent,
  UIEvent as ReactUIEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  ChevronLeft,
  ChevronUp,
  Code,
  Ellipsis,
  FileCode,
  Folder,
  PanelLeft,
  Play,
  Settings,
  Terminal,
  Trash2,
  X,
} from "lucide-react";
import {
  getNodePath,
  type WorkspaceEditorPanelInstance,
} from "@igcse/workspace";
import { Breadcrumbs } from "@/app/components/Breadcrumbs";
import { MonacoPseudocodeEditor } from "@/app/components/MonacoPseudocodeEditor";
import { WorkspaceSidebar } from "@/app/components/WorkspaceSidebar";
import { useWorkspaceSession } from "@/app/hooks/useWorkspaceSession";
import { isAppleTouchDevice } from "@/lib/appleTouch";

/* ── constants ── */

const DEFAULT_SOURCE = `DECLARE Number : INTEGER
DECLARE Total : INTEGER

FOR Number <- 1 TO 5
    Total <- Total + Number
NEXT Number

OUTPUT "Total = ", Total`;

const DEFAULT_SIDEBAR_WIDTH = 260;
const MIN_SIDEBAR_WIDTH = 180;
const MAX_SIDEBAR_WIDTH = 480;
const DEFAULT_TERMINAL_HEIGHT = 160;
const MIN_TERMINAL_HEIGHT = 60;
const TOUCH_TABLET_BREAKPOINT = 744;
const TOUCH_SIDEBAR_WIDTH = 280;
const TOUCH_OUTPUT_HEIGHT = 140;

type TouchTab = "editor" | "files" | "output" | "settings";

/* ── dialog state types ── */

interface RenameDialogState {
  nodeId: string;
  currentName: string;
}

interface DeleteDialogState {
  nodeIds: string[];
  message: string;
}

/* ── component ── */

export default function HomePage() {
  const router = useRouter();

  const {
    workspace,
    activeDocument,
    compileDiagnostics,
    terminalOutputs,
    pendingInput,
    isRunning,
    runningTerminalPanelId,
    saveError,
    appNotice,
    dismissNotice,
    setPendingInputText,
    submitPendingInput,
    cancelPendingInput,
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
    setEditorActiveDocument,
    moveEditorDocumentTab,
    closeEditorDocumentTab,
  } = useWorkspaceSession(DEFAULT_SOURCE);

  /* ── local state ── */

  const [renameDialog, setRenameDialog] = useState<RenameDialogState | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [terminalHeight, setTerminalHeight] = useState(DEFAULT_TERMINAL_HEIGHT);
  const [showTerminal, setShowTerminal] = useState(true);
  const [touchTab, setTouchTab] = useState<TouchTab>("editor");
  const [touchSidebarVisible, setTouchSidebarVisible] = useState(true);
  const [touchOutputVisible, setTouchOutputVisible] = useState(true);
  const [viewportSize, setViewportSize] = useState(() => ({
    width: typeof window === "undefined" ? 1280 : window.innerWidth,
    height: typeof window === "undefined" ? 800 : window.innerHeight,
  }));
  const [isDesktopShell] = useState(() => {
    if (typeof window === "undefined") return false;
    const w = window as Window & { electron?: { isDesktop?: boolean } };
    return Boolean(w.electron?.isDesktop);
  });
  const [isAppleTouchUi] = useState(() =>
    isAppleTouchDevice(typeof navigator === "undefined" ? undefined : navigator),
  );

  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const desktopTerminalScrollRef = useRef<HTMLDivElement | null>(null);
  const touchOutputScrollRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollOutputRef = useRef(true);

  /* ── derived workspace data ── */

  const editorPanel = useMemo<WorkspaceEditorPanelInstance | null>(() => {
    if (!workspace) return null;
    const entry = Object.entries(workspace.panelInstances).find(
      ([, p]) => p.kind === "editor",
    );
    return entry ? (entry[1] as WorkspaceEditorPanelInstance) : null;
  }, [workspace]);

  const editorPanelId = editorPanel?.id ?? null;

  const terminalPanelId = useMemo(() => {
    if (!workspace) return null;
    const entry = Object.entries(workspace.panelInstances).find(
      ([, p]) => p.kind === "terminal",
    );
    return entry?.[0] ?? null;
  }, [workspace]);

  const editorActiveDoc = useMemo(() => {
    if (!workspace || !editorPanel) return null;
    const node = workspace.nodes[editorPanel.activeDocumentId];
    return node?.type === "document" ? node : null;
  }, [workspace, editorPanel]);
  const currentDocument = editorActiveDoc ?? activeDocument;

  const breadcrumbs = useMemo(() => {
    if (!workspace || !currentDocument) return [];
    return getNodePath(workspace, currentDocument.id);
  }, [workspace, currentDocument]);

  const terminalOutput = terminalPanelId
    ? (terminalOutputs[terminalPanelId] ?? "")
    : "";

  /* ── effects ── */

  useEffect(() => {
    if (renameDialog) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renameDialog]);

  const scrollOutputToBottom = useCallback(() => {
    if (!shouldAutoScrollOutputRef.current) {
      return;
    }

    for (const element of [desktopTerminalScrollRef.current, touchOutputScrollRef.current]) {
      if (element) {
        element.scrollTop = element.scrollHeight;
      }
    }
  }, []);

  const handleOutputScroll = useCallback((event: ReactUIEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    shouldAutoScrollOutputRef.current = distanceFromBottom <= 24;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      scrollOutputToBottom();
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [
    isRunning,
    pendingInput.panelId,
    pendingInput.prompt,
    runningTerminalPanelId,
    scrollOutputToBottom,
    showTerminal,
    terminalOutput,
    touchOutputVisible,
    touchTab,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncViewport = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    syncViewport();
    window.addEventListener("resize", syncViewport);
    window.addEventListener("orientationchange", syncViewport);
    return () => {
      window.removeEventListener("resize", syncViewport);
      window.removeEventListener("orientationchange", syncViewport);
    };
  }, []);

  /* ── resize handlers ── */

  const handleSidebarResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const startX = event.clientX;
      const startW = sidebarWidth;
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";

      const onMove = (e: PointerEvent) => {
        setSidebarWidth(
          Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, startW + e.clientX - startX)),
        );
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [sidebarWidth],
  );

  const handleTerminalResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const startY = event.clientY;
      const startH = terminalHeight;
      document.body.style.userSelect = "none";
      document.body.style.cursor = "row-resize";

      const onMove = (e: PointerEvent) => {
        setTerminalHeight(Math.max(MIN_TERMINAL_HEIGHT, startH + startY - e.clientY));
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [terminalHeight],
  );

  /* ── actions ── */

  const handleRun = useCallback(() => {
    shouldAutoScrollOutputRef.current = true;
    setShowTerminal(true);
    runNow();
  }, [runNow]);

  const handleClearTerminal = useCallback(() => {
    shouldAutoScrollOutputRef.current = true;
    if (terminalPanelId) clearTerminal(terminalPanelId);
  }, [clearTerminal, terminalPanelId]);
  const isTouchTablet = isAppleTouchUi && viewportSize.width >= TOUCH_TABLET_BREAKPOINT;
  const isTouchPhone = isAppleTouchUi && viewportSize.width < TOUCH_TABLET_BREAKPOINT;

  const handleTouchRun = useCallback(() => {
    if (isTouchTablet) {
      setTouchOutputVisible(true);
    }
    if (isTouchPhone) {
      setTouchTab("output");
    }
    handleRun();
  }, [handleRun, isTouchPhone, isTouchTablet]);

  const handlePhoneBack = useCallback(() => {
    setTouchTab((current) => (current === "editor" ? "files" : "editor"));
  }, []);

  const handleTouchDocumentSelect = useCallback(
    (documentId: string) => {
      selectDocument(documentId);
      if (isTouchPhone) {
        setTouchTab("editor");
      }
    },
    [isTouchPhone, selectDocument],
  );

  const touchSafeAreaStyle = {
    paddingTop: "env(safe-area-inset-top, 0px)",
    paddingRight: "env(safe-area-inset-right, 0px)",
    paddingBottom: "env(safe-area-inset-bottom, 0px)",
    paddingLeft: "env(safe-area-inset-left, 0px)",
  } as const;

  const renderTouchOutputSurface = (title: string, onClose?: () => void) => (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--surface)]">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-[var(--separator)] px-4">
        <span className="text-[13px] font-semibold text-[var(--text2)]">{title}</span>
        <div className="flex-1" />
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text3)] transition hover:bg-[var(--hover)] hover:text-[var(--text2)]"
          aria-label="Clear output"
          onClick={handleClearTerminal}
        >
          <Trash2 size={16} />
        </button>
        {onClose ? (
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text3)] transition hover:bg-[var(--hover)] hover:text-[var(--text2)]"
            aria-label={`Close ${title.toLowerCase()}`}
            onClick={onClose}
          >
            <X size={16} />
          </button>
        ) : null}
      </div>

      <div
        ref={touchOutputScrollRef}
        data-testid="touch-output-scroll-region"
        tabIndex={0}
        onScroll={handleOutputScroll}
        className="min-h-0 flex-1 overflow-auto overscroll-contain px-4 py-2 touch-pan-y"
      >
        <pre className="min-w-full whitespace-pre-wrap break-words font-mono text-[13px] leading-[1.5]">
          {terminalOutput ? (
            <span className="text-[var(--text2)]">{terminalOutput}</span>
          ) : (
            <span className="text-[var(--text3)]">Ready</span>
          )}
        </pre>
      </div>

      {pendingInput.panelId === terminalPanelId && pendingInput.prompt ? (
        <form
          className="shrink-0 border-t border-[var(--separator)] px-4 py-2"
          onSubmit={(event) => {
            event.preventDefault();
            submitPendingInput();
          }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-[var(--green)]">{pendingInput.prompt}</span>
            <input
              value={pendingInput.text}
              onChange={(event) => setPendingInputText(event.target.value)}
              autoFocus
              aria-label="Terminal input"
              className="h-8 min-w-[140px] flex-1 rounded-md border border-[var(--separator)] bg-[var(--bg)] px-2 font-mono text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]"
              placeholder="Type here and press Enter"
            />
            <button
              type="submit"
              className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-[11px] font-semibold text-white"
            >
              Send
            </button>
            <button
              type="button"
              className="rounded-md px-2.5 py-1.5 text-[11px] text-[var(--text2)] transition hover:bg-[var(--hover)]"
              onClick={cancelPendingInput}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {isRunning &&
        runningTerminalPanelId === terminalPanelId &&
        !(pendingInput.panelId === terminalPanelId && pendingInput.prompt) && (
          <div className="shrink-0 border-t border-[var(--separator)] px-4 py-1.5">
            <p className="text-[11px] text-[var(--green)]">Running…</p>
          </div>
        )}
    </div>
  );

  /* ── dialog handlers ── */

  const handleRenameNode = (nodeId: string) => {
    if (!workspace) return;
    const node = workspace.nodes[nodeId];
    if (!node) return;
    setRenameDialog({ nodeId, currentName: node.name });
    setRenameValue(node.name);
  };

  const handleDeleteNodes = (nodeIds: string[]) => {
    if (!workspace) return;
    const ids = Array.from(new Set(nodeIds)).filter((id) => !!workspace.nodes[id]);
    if (ids.length === 0) return;
    setDeleteDialog({
      nodeIds: ids,
      message:
        ids.length === 1
          ? `Delete "${workspace.nodes[ids[0]].name}"?`
          : `Delete ${ids.length} selected items?`,
    });
  };

  const submitRename = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!renameDialog) return;
    const name = renameValue.trim();
    if (!name) return;
    if (renameNodeInWorkspace(renameDialog.nodeId, name)) {
      setRenameDialog(null);
    }
  };

  const confirmDelete = () => {
    if (!deleteDialog) return;
    if (deleteNodesInWorkspace(deleteDialog.nodeIds)) {
      setDeleteDialog(null);
    }
  };

  /* ── tab drag-and-drop ── */

  const handleTabDrop = (event: DragEvent<HTMLElement>, targetIndex: number) => {
    if (!editorPanelId) return;
    const payload = event.dataTransfer.getData("application/x-editor-tab");
    if (!payload) return;
    event.preventDefault();
    try {
      const parsed = JSON.parse(payload) as { panelId: string; documentId: string };
      if (typeof parsed.panelId === "string" && typeof parsed.documentId === "string") {
        moveEditorDocumentTab(parsed.panelId, editorPanelId, parsed.documentId, targetIndex);
      }
    } catch {
      /* ignore malformed drag data */
    }
  };

  /* ── loading state ── */

  if (!workspace || !activeDocument) {
    return (
      <main className="min-h-dvh bg-[var(--bg)]">
        <div className="flex min-h-dvh items-center justify-center px-4 py-10">
          <section className="w-full max-w-lg rounded-xl border border-[var(--separator)] bg-[var(--surface)] p-6">
            <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--accent)]">
              Workspace
            </p>
            <h1 className="mt-3 text-2xl font-semibold text-[var(--text)]">
              Loading project files…
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--text2)]">
              Preparing the editor layout, file tree, and runtime panels.
            </p>
          </section>
        </div>
      </main>
    );
  }

  /* ── render ── */

  if (isAppleTouchUi) {
    const phoneTabItems = [
      { key: "editor" as const, label: "EDITOR", icon: Code },
      { key: "files" as const, label: "FILES", icon: Folder },
      { key: "output" as const, label: "OUTPUT", icon: Terminal },
      { key: "settings" as const, label: "SETTINGS", icon: Settings },
    ];

    return (
      <main
        className="w-screen overflow-hidden bg-[var(--bg)]"
        style={{ height: "100dvh", minHeight: "100svh" }}
      >
        <div className="flex h-full min-h-0 flex-col overflow-hidden" style={touchSafeAreaStyle}>
          {(saveError || appNotice) && (
            <div className="shrink-0 border-b border-[var(--separator)] bg-[var(--surface)] px-4 py-1.5">
              <div className="flex flex-wrap items-center gap-3 text-[11px]">
                {saveError && <span className="text-[var(--red)]">{saveError}</span>}
                {appNotice && (
                  <div className="flex items-center gap-3">
                    <span
                      className={
                        appNotice.tone === "error" ? "text-[var(--red)]" : "text-[var(--text2)]"
                      }
                    >
                      {appNotice.message}
                    </span>
                    <button
                      type="button"
                      className="rounded-md border border-[var(--separator)] bg-[var(--surface2)] px-2.5 py-1 text-[11px] text-[var(--text2)] transition hover:bg-[var(--surface3)]"
                      onClick={dismissNotice}
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {isTouchTablet ? (
            <>
              <header className="flex h-[52px] shrink-0 items-center bg-[var(--titlebar)] px-5">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--accent)] transition hover:bg-[var(--hover)]"
                    aria-label={touchSidebarVisible ? "Hide sidebar" : "Show sidebar"}
                    onClick={() => setTouchSidebarVisible((current) => !current)}
                  >
                    <PanelLeft size={22} />
                  </button>
                  <div className="h-6 w-px bg-[var(--separator)]" />
                  <FileCode size={18} className="text-[var(--accent)]" />
                  <span className="truncate text-[17px] font-semibold text-[var(--text)]">
                    {currentDocument?.name}
                  </span>
                </div>

                <div className="flex flex-1 items-center justify-center">
                  <p className="text-[13px] font-medium text-[var(--text2)]">Pseudocode Compiler</p>
                </div>

                <div className="flex flex-1 items-center justify-end gap-3">
                  <button
                    type="button"
                    className="flex h-8 items-center gap-1.5 rounded-2xl bg-[var(--green)] px-4 text-white transition hover:brightness-110 disabled:opacity-50"
                    aria-label={isRunning ? "Running" : "Run"}
                    onClick={handleTouchRun}
                    disabled={isRunning}
                  >
                    <Play size={14} fill="white" />
                    <span className="text-sm font-semibold">Run</span>
                  </button>
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--accent)] transition hover:bg-[var(--hover)]"
                    aria-label="Open manual"
                    onClick={() => router.push("/manual")}
                  >
                    <Settings size={22} />
                  </button>
                </div>
              </header>

              <div className="h-px shrink-0 bg-[var(--separator)]" />

              <div className="flex min-h-0 flex-1">
                {touchSidebarVisible ? (
                  <>
                    <div className="min-h-0 shrink-0 overflow-hidden bg-[var(--sidebar)]" style={{ width: TOUCH_SIDEBAR_WIDTH }}>
                      <WorkspaceSidebar
                        workspace={workspace}
                        onSelectDocument={handleTouchDocumentSelect}
                        onToggleFolder={toggleFolder}
                        onExpandFolder={expandFolder}
                        onCreateFolder={createFolderInWorkspace}
                        onCreateDocument={createDocumentInWorkspace}
                        onRenameNode={handleRenameNode}
                        onDeleteNodes={handleDeleteNodes}
                        onMoveNodes={moveNodesInWorkspace}
                      />
                    </div>
                    <div className="w-px shrink-0 bg-[var(--separator)]" />
                  </>
                ) : null}

                <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--bg)]">
                  <div className="flex h-8 shrink-0 items-center px-4">
                    <Breadcrumbs path={breadcrumbs} />
                  </div>
                  <div className="h-px shrink-0 bg-[var(--separator)]" />

                  <div className="min-h-0 flex-1">
                    {currentDocument && (
                      <MonacoPseudocodeEditor
                        value={currentDocument.source}
                        onChange={(value) => handleDocumentSourceChange(currentDocument.id, value)}
                        diagnostics={
                          activeDocument.id === currentDocument.id ? compileDiagnostics : []
                        }
                      />
                    )}
                  </div>

                  <div className="h-px shrink-0 bg-[var(--separator)]" />

                  {touchOutputVisible ? (
                    <div
                      className="min-h-0 shrink-0 overflow-hidden"
                      style={{ height: TOUCH_OUTPUT_HEIGHT }}
                    >
                      {renderTouchOutputSurface("Output", () => setTouchOutputVisible(false))}
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="flex h-9 shrink-0 items-center gap-2 px-4 text-left text-[var(--text2)] transition hover:bg-[var(--surface)]"
                      onClick={() => setTouchOutputVisible(true)}
                    >
                      <span className="text-[13px] font-semibold">Output</span>
                      <div className="flex-1" />
                      <ChevronUp size={16} className="rotate-180 text-[var(--text3)]" />
                    </button>
                  )}
                </section>
              </div>
            </>
          ) : (
            <>
              <header className="flex h-12 shrink-0 items-center gap-3 bg-[var(--titlebar)] px-4">
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--accent)] transition hover:bg-[var(--hover)]"
                  aria-label={touchTab === "editor" ? "Open files" : "Back to editor"}
                  onClick={handlePhoneBack}
                >
                  <ChevronLeft size={24} />
                </button>
                <span className="truncate text-[17px] font-semibold text-[var(--text)]">
                  {currentDocument?.name}
                </span>
                <div className="flex-1" />
                <button
                  type="button"
                  className="flex h-7 items-center gap-1 rounded-[14px] bg-[var(--green)] px-3 text-white transition hover:brightness-110 disabled:opacity-50"
                  aria-label={isRunning ? "Running" : "Run"}
                  onClick={handleTouchRun}
                  disabled={isRunning}
                >
                  <Play size={12} fill="white" />
                  <span className="text-xs font-semibold">Run</span>
                </button>
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--accent)] transition hover:bg-[var(--hover)]"
                  aria-label="Open manual"
                  onClick={() => router.push("/manual")}
                >
                  <Ellipsis size={22} />
                </button>
              </header>

              <div className="h-px shrink-0 bg-[var(--separator)]" />

              <section className="flex min-h-0 flex-1 flex-col bg-[var(--bg)]">
                <div className="min-h-0 flex-1">
                  {touchTab === "editor" && currentDocument ? (
                    <MonacoPseudocodeEditor
                      value={currentDocument.source}
                      onChange={(value) => handleDocumentSourceChange(currentDocument.id, value)}
                      diagnostics={
                        activeDocument.id === currentDocument.id ? compileDiagnostics : []
                      }
                    />
                  ) : null}

                  {touchTab === "files" ? (
                    <WorkspaceSidebar
                      workspace={workspace}
                      onSelectDocument={handleTouchDocumentSelect}
                      onToggleFolder={toggleFolder}
                      onExpandFolder={expandFolder}
                      onCreateFolder={createFolderInWorkspace}
                      onCreateDocument={createDocumentInWorkspace}
                      onRenameNode={handleRenameNode}
                      onDeleteNodes={handleDeleteNodes}
                      onMoveNodes={moveNodesInWorkspace}
                    />
                  ) : null}

                  {touchTab === "output" ? renderTouchOutputSurface("Output") : null}

                  {touchTab === "settings" ? (
                    <div className="flex h-full min-h-0 flex-col bg-[var(--bg)] px-6 py-8">
                      <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--text3)]">
                        SETTINGS
                      </p>
                      <h2 className="mt-3 text-[28px] font-semibold text-[var(--text)]">
                        Pseudocode Compiler
                      </h2>
                      <p className="mt-4 max-w-xs text-sm leading-6 text-[var(--text2)]">
                        Open the manual, review the language guide, and keep the workspace controls one tap away.
                      </p>
                      <button
                        type="button"
                        className="mt-6 inline-flex h-10 items-center justify-center self-start rounded-2xl bg-[var(--accent)] px-5 text-sm font-semibold text-white transition hover:brightness-110"
                        onClick={() => router.push("/manual")}
                      >
                        Open Manual
                      </button>
                    </div>
                  ) : null}
                </div>

                <div
                  className="shrink-0 bg-[var(--bg)] px-4 pt-3"
                  style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 21px)" }}
                >
                  <div className="flex h-[50px] items-center rounded-[26px] border border-[var(--separator)] bg-[var(--surface)] p-1">
                    {phoneTabItems.map((tab) => {
                      const Icon = tab.icon;
                      const isActive = touchTab === tab.key;
                      return (
                        <button
                          key={tab.key}
                          type="button"
                          className={`flex h-full flex-1 flex-col items-center justify-center gap-[3px] rounded-[22px] transition ${
                            isActive
                              ? "bg-[var(--accent)] text-white"
                              : "text-[var(--text3)]"
                          }`}
                          aria-label={tab.label}
                          onClick={() => setTouchTab(tab.key)}
                        >
                          <Icon size={18} />
                          <span className="text-[9px] font-semibold tracking-[0.5px]">
                            {tab.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>
            </>
          )}

          {renameDialog && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(0,0,0,0.6)] p-4">
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="rename-dialog-title"
                className="w-full max-w-md rounded-xl border border-[var(--separator)] bg-[var(--surface)] p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Explorer</p>
                    <h2
                      id="rename-dialog-title"
                      className="mt-2 text-xl font-semibold text-[var(--text)]"
                    >
                      Rename Item
                    </h2>
                    <p className="mt-2 text-sm text-[var(--text2)]">
                      Current name: {renameDialog.currentName}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="rounded-md border border-[var(--separator)] bg-[var(--surface2)] px-3 py-1.5 text-sm text-[var(--text2)] hover:bg-[var(--surface3)]"
                    onClick={() => setRenameDialog(null)}
                  >
                    Cancel
                  </button>
                </div>
                <form className="mt-5 space-y-4" onSubmit={submitRename}>
                  <label className="block">
                    <span className="mb-2 block text-sm text-[var(--text2)]">Item name</span>
                    <input
                      ref={renameInputRef}
                      aria-label="Item name"
                      value={renameValue}
                      onChange={(event) => setRenameValue(event.target.value)}
                      className="h-10 w-full rounded-lg border border-[var(--separator)] bg-[var(--bg)] px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
                    />
                  </label>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-[var(--separator)] bg-[var(--surface2)] px-3 py-1.5 text-sm text-[var(--text2)] hover:bg-[var(--surface3)]"
                      onClick={() => setRenameDialog(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                      disabled={!renameValue.trim()}
                    >
                      Save Name
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {deleteDialog && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(0,0,0,0.6)] p-4">
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="delete-dialog-title"
                className="w-full max-w-md rounded-xl border border-[var(--separator)] bg-[var(--surface)] p-6"
              >
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--red)]">Explorer</p>
                <h2
                  id="delete-dialog-title"
                  className="mt-2 text-xl font-semibold text-[var(--text)]"
                >
                  Confirm Delete
                </h2>
                <p className="mt-3 text-sm text-[var(--text2)]">{deleteDialog.message}</p>
                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-[var(--separator)] bg-[var(--surface2)] px-3 py-1.5 text-sm text-[var(--text2)] hover:bg-[var(--surface3)]"
                    onClick={() => setDeleteDialog(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="rounded-md bg-[var(--red)] px-3 py-1.5 text-sm font-semibold text-white"
                    onClick={confirmDelete}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-dvh flex-col overflow-hidden">
      {/* ════════════ Title Bar ════════════ */}
      <header
        className={`flex h-[52px] shrink-0 items-center px-4 bg-[var(--titlebar)] ${
          isDesktopShell ? "app-drag-region" : ""
        }`}
      >
        {/* Spacer for native traffic lights (desktop) / brand label (web) */}
        <div className={`flex items-center gap-2 ${isDesktopShell ? "w-[80px]" : "w-auto"}`}>
          {isDesktopShell ? null : (
            <span className="text-xs font-medium text-[var(--text2)]">IGCSE</span>
          )}
        </div>

        <div className="flex-1" />
        <p className="text-[13px] font-medium text-[var(--text2)]">Pseudocode Compiler</p>
        <div className="flex-1" />

        {/* Toolbar */}
        <div className="app-no-drag flex items-center gap-1.5">
          <button
            type="button"
            className="flex h-7 items-center gap-1.5 rounded-[14px] bg-[var(--green)] px-3.5 py-[5px] text-white transition hover:brightness-110 disabled:opacity-50"
            aria-label={isRunning ? "Running" : "Run"}
            onClick={handleRun}
            disabled={isRunning}
          >
            <Play size={12} fill="white" />
            <span className="text-xs font-semibold">Run</span>
          </button>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text3)] transition hover:text-[var(--text2)]"
            aria-label="Manual"
            onClick={() => router.push("/manual")}
          >
            <BookOpen size={18} />
          </button>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text3)] transition hover:text-[var(--text2)]"
            aria-label="Settings"
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      {/* ════════════ Title Divider ════════════ */}
      <div className="h-px shrink-0 bg-[var(--separator)]" />

      {/* ════════════ Notice Bar ════════════ */}
      {(saveError || appNotice) && (
        <div className="shrink-0 border-b border-[var(--separator)] bg-[var(--surface)] px-4 py-1.5">
          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            {saveError && <span className="text-[var(--red)]">{saveError}</span>}
            {appNotice && (
              <div className="flex items-center gap-3">
                <span
                  className={
                    appNotice.tone === "error" ? "text-[var(--red)]" : "text-[var(--text2)]"
                  }
                >
                  {appNotice.message}
                </span>
                <button
                  type="button"
                  className="rounded-md border border-[var(--separator)] bg-[var(--surface2)] px-2.5 py-1 text-[11px] text-[var(--text2)] transition hover:bg-[var(--surface3)]"
                  onClick={dismissNotice}
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════ Body ════════════ */}
      <div className="flex min-h-0 flex-1">
        {/* ──── Sidebar ──── */}
        <div className="shrink-0 overflow-hidden" style={{ width: sidebarWidth }}>
          <WorkspaceSidebar
            workspace={workspace}
            onSelectDocument={selectDocument}
            onToggleFolder={toggleFolder}
            onExpandFolder={expandFolder}
            onCreateFolder={createFolderInWorkspace}
            onCreateDocument={createDocumentInWorkspace}
            onRenameNode={handleRenameNode}
            onDeleteNodes={handleDeleteNodes}
            onMoveNodes={moveNodesInWorkspace}
          />
        </div>

        {/* ──── Sidebar Resize Handle ──── */}
        <div
          className="w-px shrink-0 cursor-col-resize bg-[var(--separator)]"
          onPointerDown={handleSidebarResize}
        />

        {/* ──── Editor Area ──── */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--bg)]">
          {/* Tab Bar */}
          {editorPanel && (
            <div className="flex h-[38px] shrink-0 items-center gap-0.5 overflow-x-auto px-2">
              {editorPanel.openDocumentIds.map((documentId, index) => {
                const doc = workspace.nodes[documentId];
                if (!doc || doc.type !== "document") return null;
                const isActive = documentId === editorPanel.activeDocumentId;
                return (
                  <div
                    key={documentId}
                    draggable
                    className={`group flex h-[30px] shrink-0 items-center gap-1.5 rounded-md px-3 text-[12px] font-medium transition ${
                      isActive
                        ? "bg-[var(--surface2)] text-[var(--text)]"
                        : "text-[var(--text3)] hover:bg-[var(--hover)] hover:text-[var(--text2)]"
                    }`}
                    onClick={() => setEditorActiveDocument(editorPanel.id, documentId)}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData(
                        "application/x-editor-tab",
                        JSON.stringify({ panelId: editorPanel.id, documentId }),
                      );
                      event.dataTransfer.setData("text/plain", doc.name);
                    }}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => handleTabDrop(event, index)}
                  >
                    <FileCode
                      size={14}
                      className={isActive ? "text-[var(--accent)]" : "text-[var(--text3)]"}
                    />
                    <span className="truncate">{doc.name}</span>
                    <button
                      type="button"
                      className="rounded p-0.5 text-[var(--text3)] opacity-0 hover:bg-[var(--hover)] hover:text-[var(--text)] group-hover:opacity-100"
                      aria-label={`Close ${doc.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        closeEditorDocumentTab(editorPanel.id, documentId);
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                );
              })}
              {/* Drop target at end of tab bar */}
              <div
                className="h-[38px] min-w-[32px] flex-1"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => handleTabDrop(event, editorPanel.openDocumentIds.length)}
              />
            </div>
          )}

          {/* Breadcrumb */}
          <div className="flex h-7 shrink-0 items-center px-4">
            <Breadcrumbs path={breadcrumbs} />
          </div>

          {/* Editor Separator */}
          <div className="h-px shrink-0 bg-[var(--separator)]" />

          {/* Editor Content */}
          <div className="min-h-0 flex-1">
            {editorActiveDoc && (
              <MonacoPseudocodeEditor
                value={editorActiveDoc.source}
                onChange={(value) => handleDocumentSourceChange(editorActiveDoc.id, value)}
                diagnostics={
                  activeDocument.id === editorActiveDoc.id ? compileDiagnostics : []
                }
              />
            )}
          </div>

          {/* Terminal Resize Handle */}
          {showTerminal && (
            <div
              className="h-px shrink-0 cursor-row-resize bg-[var(--separator)]"
              onPointerDown={handleTerminalResize}
            />
          )}

          {/* Terminal Panel */}
          {showTerminal && (
            <div
              className="flex shrink-0 flex-col overflow-hidden bg-[var(--surface)]"
              style={{ height: terminalHeight }}
            >
              {/* Terminal Header */}
              <div className="flex h-8 shrink-0 items-center gap-2 px-3">
                <span className="text-[11px] font-semibold tracking-[0.5px] text-[var(--text2)]">
                  Terminal
                </span>
                <div className="flex-1" />
                <button
                  type="button"
                  className="flex items-center justify-center rounded text-[var(--text3)] transition hover:text-[var(--text2)]"
                  aria-label="Close terminal"
                  onClick={() => setShowTerminal(false)}
                >
                  <X size={14} />
                </button>
              </div>

              {/* Terminal Content */}
              <div
                ref={desktopTerminalScrollRef}
                data-testid="terminal-scroll-region"
                tabIndex={0}
                onScroll={handleOutputScroll}
                className="min-h-0 flex-1 overflow-auto overscroll-contain px-3 py-2 touch-pan-y"
              >
                <pre className="min-w-full whitespace-pre-wrap break-words font-mono text-xs leading-5">
                  {terminalOutput ? (
                    <>
                      <span className="text-[var(--green)]">$ </span>
                      <span className="text-[var(--text2)]">{terminalOutput}</span>
                    </>
                  ) : (
                    <span className="text-[var(--text3)]">Ready</span>
                  )}
                </pre>
              </div>

              {/* Pending Input */}
              {pendingInput.panelId === terminalPanelId && pendingInput.prompt && (
                <form
                  className="shrink-0 border-t border-[var(--separator)] px-3 py-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    submitPendingInput();
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-[var(--green)]">
                      {pendingInput.prompt}
                    </span>
                    <input
                      value={pendingInput.text}
                      onChange={(event) => setPendingInputText(event.target.value)}
                      autoFocus
                      aria-label="Terminal input"
                      className="h-7 flex-1 rounded-md border border-[var(--separator)] bg-[var(--bg)] px-2 font-mono text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]"
                      placeholder="Type here and press Enter"
                    />
                    <button
                      type="submit"
                      className="rounded-md bg-[var(--accent)] px-2.5 py-1 text-[11px] font-medium text-white"
                    >
                      Send
                    </button>
                    <button
                      type="button"
                      className="rounded-md px-2.5 py-1 text-[11px] text-[var(--text2)] hover:bg-[var(--hover)]"
                      onClick={cancelPendingInput}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {/* Running indicator */}
              {isRunning &&
                runningTerminalPanelId === terminalPanelId &&
                !(pendingInput.panelId === terminalPanelId && pendingInput.prompt) && (
                  <div className="shrink-0 border-t border-[var(--separator)] px-3 py-1.5">
                    <p className="text-[11px] text-[var(--green)]">Running…</p>
                  </div>
                )}
            </div>
          )}
        </div>
      </div>

      {/* ════════════ Rename Dialog ════════════ */}
      {renameDialog && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(0,0,0,0.6)] p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="rename-dialog-title"
            className="w-full max-w-md rounded-xl border border-[var(--separator)] bg-[var(--surface)] p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Explorer</p>
                <h2
                  id="rename-dialog-title"
                  className="mt-2 text-xl font-semibold text-[var(--text)]"
                >
                  Rename Item
                </h2>
                <p className="mt-2 text-sm text-[var(--text2)]">
                  Current name: {renameDialog.currentName}
                </p>
              </div>
              <button
                type="button"
                className="rounded-md border border-[var(--separator)] bg-[var(--surface2)] px-3 py-1.5 text-sm text-[var(--text2)] hover:bg-[var(--surface3)]"
                onClick={() => setRenameDialog(null)}
              >
                Cancel
              </button>
            </div>
            <form className="mt-5 space-y-4" onSubmit={submitRename}>
              <label className="block">
                <span className="mb-2 block text-sm text-[var(--text2)]">Item name</span>
                <input
                  ref={renameInputRef}
                  aria-label="Item name"
                  value={renameValue}
                  onChange={(event) => setRenameValue(event.target.value)}
                  className="h-10 w-full rounded-lg border border-[var(--separator)] bg-[var(--bg)] px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
                />
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-md border border-[var(--separator)] bg-[var(--surface2)] px-3 py-1.5 text-sm text-[var(--text2)] hover:bg-[var(--surface3)]"
                  onClick={() => setRenameDialog(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                  disabled={!renameValue.trim()}
                >
                  Save Name
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════ Delete Dialog ════════════ */}
      {deleteDialog && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(0,0,0,0.6)] p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            className="w-full max-w-md rounded-xl border border-[var(--separator)] bg-[var(--surface)] p-6"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--red)]">Explorer</p>
            <h2
              id="delete-dialog-title"
              className="mt-2 text-xl font-semibold text-[var(--text)]"
            >
              Confirm Delete
            </h2>
            <p className="mt-3 text-sm text-[var(--text2)]">{deleteDialog.message}</p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-[var(--separator)] bg-[var(--surface2)] px-3 py-1.5 text-sm text-[var(--text2)] hover:bg-[var(--surface3)]"
                onClick={() => setDeleteDialog(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-md bg-[var(--red)] px-3 py-1.5 text-sm font-semibold text-white"
                onClick={confirmDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
