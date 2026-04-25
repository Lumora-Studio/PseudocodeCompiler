"use client";
import dynamic from "next/dynamic";
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
import {
  BookOpen,
  ChevronDown,
  FileCode,
  GitBranch,
  Play,
  Save as SaveIcon,
  Settings,
  X,
} from "lucide-react";
import {
  getNodePath,
  type WorkspaceEditorPanelInstance,
} from "@pseudocode-compiler/workspace";
import { Breadcrumbs } from "@/app/components/Breadcrumbs";
import { WorkspaceSidebar } from "@/app/components/WorkspaceSidebar";
import { useWorkspaceSession } from "@/app/hooks/useWorkspaceSession";
import { getAuthRouteHref } from "@/lib/auth/urls";
import { AppAuthProvider, useAppAuth, type AppAuthInitialState } from "@/lib/auth-runtime";
import {
  applyResolvedTheme,
  getSystemTheme,
  loadThemeMode,
  resolveTheme,
  saveThemeMode,
  type ThemeMode,
} from "@/lib/theme";

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
const AUTOSAVE_INTERVAL_OPTIONS = [1, 5, 10, 15, 30];
const FLOWCHART_MODE_STORAGE_KEY = "pseudocode-compiler-flowchart-mode-enabled";

/* ── dialog state types ── */

interface RenameDialogState {
  nodeId: string;
  currentName: string;
}

interface DeleteDialogState {
  nodeIds: string[];
  message: string;
}

interface DesktopSaveRequest {
  reason?: "manual" | "close";
}

interface DesktopElectronBridge {
  isDesktop?: boolean;
  onSaveRequested?: (
    listener: (request: DesktopSaveRequest) => boolean | Promise<boolean>,
  ) => (() => void) | void;
  setDirtyState?: (dirty: boolean) => void;
}

function EditorLoadingState() {
  return (
    <div className="flex h-full items-center justify-center bg-[var(--bg)] px-6">
      <div className="max-w-sm rounded-3xl border border-[var(--separator)] bg-[var(--surface)] px-5 py-4 text-center shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
        <p className="text-sm font-semibold text-[var(--text)]">Loading editor</p>
        <p className="mt-2 text-sm leading-6 text-[var(--text3)]">
          Monaco is deferred until the workspace is visible so the page can paint faster.
        </p>
      </div>
    </div>
  );
}

function ManualLoadingState() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center px-6 py-12">
      <div className="max-w-sm rounded-3xl border border-[var(--separator)] bg-[var(--surface)] px-5 py-4 text-center shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
        <p className="text-sm font-semibold text-[var(--text)]">Loading manual</p>
        <p className="mt-2 text-sm leading-6 text-[var(--text3)]">
          The guide is loaded on demand to keep the editor shell lean.
        </p>
      </div>
    </div>
  );
}

const MonacoPseudocodeEditor = dynamic(
  () =>
    import("@/app/components/MonacoPseudocodeEditor").then(
      (module) => module.MonacoPseudocodeEditor,
    ),
  {
    ssr: false,
    loading: () => <EditorLoadingState />,
  },
);

const ManualGuideContent = dynamic(
  () => import("@/app/manual/page").then((module) => module.ManualGuideContent),
  {
    loading: () => <ManualLoadingState />,
  },
);

const FlowchartEditor = dynamic(
  () => import("@/app/components/flowchart/FlowchartEditor"),
  {
    ssr: false,
    loading: () => <EditorLoadingState />,
  },
);

const THEME_OPTIONS: Array<{ value: ThemeMode; label: string; description: string }> = [
  {
    value: "system",
    label: "System",
    description: "Follow the operating system appearance automatically.",
  },
  {
    value: "dark",
    label: "Dark",
    description: "Use the current graphite shell and dark editor palette.",
  },
  {
    value: "light",
    label: "Light",
    description: "Switch to the warm paper light theme across the app.",
  },
];

/* ── component ── */

export interface HomePageClientProps {
  initialAuth?: AppAuthInitialState;
}

export function HomePageClient({ initialAuth }: HomePageClientProps) {
  return (
    <AppAuthProvider initialAuth={initialAuth}>
      <HomePageApp />
    </AppAuthProvider>
  );
}

function HomePageApp() {
  const {
    authAvailable,
    user,
    loading: authLoading,
    cloudSyncLoading,
    cloudSyncReady,
    signOut,
  } = useAppAuth();

  const persistenceScope = useMemo(
    () =>
      authLoading
        ? null
        : !authAvailable
          ? {
              kind: "local" as const,
              storageKey: "desktop-local",
            }
          : user && cloudSyncReady
            ? {
              kind: "authenticated" as const,
              userId: user.id,
            }
            : {
              kind: "anonymous" as const,
            },
    [authAvailable, authLoading, cloudSyncReady, user?.id],
  );

  const {
    workspace,
    activeDocument,
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
    cancelPendingInput,
    runNow,
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
  } = useWorkspaceSession(DEFAULT_SOURCE, persistenceScope);

  /* ── local state ── */

  const [renameDialog, setRenameDialog] = useState<RenameDialogState | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [terminalHeight, setTerminalHeight] = useState(DEFAULT_TERMINAL_HEIGHT);
  const [showTerminal, setShowTerminal] = useState(true);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [flowchartOpen, setFlowchartOpen] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => loadThemeMode());
  const [flowchartModeEnabled, setFlowchartModeEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(FLOWCHART_MODE_STORAGE_KEY) === "true";
  });
  const [systemTheme, setSystemTheme] = useState<"dark" | "light">(() => getSystemTheme());
  const [isDesktopShell] = useState(() => {
    if (typeof window === "undefined") return false;
    const w = window as Window & { electron?: DesktopElectronBridge };
    return Boolean(w.electron?.isDesktop);
  });

  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const desktopTerminalScrollRef = useRef<HTMLDivElement | null>(null);
  const accountButtonRef = useRef<HTMLButtonElement | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
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
    if (!workspace || !editorPanel?.activeDocumentId) return null;
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
  const flowchartVisible = flowchartModeEnabled && flowchartOpen;
  const resolvedTheme = resolveTheme(themeMode, systemTheme);
  const isAuthenticated = authAvailable ? Boolean(user) : true;
  const cloudSaveReady = !authAvailable || (isAuthenticated && cloudSyncReady);
  const isWorkspaceHydrating =
    authAvailable && isAuthenticated && cloudSyncLoading && !cloudSyncReady;
  const authDisplayName = authAvailable
    ? user?.firstName ?? user?.email ?? "Account"
    : "On this device";
  const authAvatarInitial = authDisplayName.trim().charAt(0).toUpperCase() || "A";
  const authIdentityLine =
    authAvailable && isAuthenticated && user?.email && user.email !== authDisplayName
      ? user.email
      : null;
  const authStatusLabel = authLoading
    ? "Checking session"
    : !authAvailable
      ? "Local workspace"
      : !isAuthenticated
        ? "Signed Out"
        : cloudSyncLoading
          ? "Finishing Sign In"
          : cloudSyncReady
        ? "Signed In"
        : "Signed In";
  const authStatusDetail = !authAvailable
    ? "Files stay on this device only."
    : !isAuthenticated
      ? "Guest session. Files are cleared when this session ends."
      : cloudSyncLoading
        ? "Signed in. Connecting your cloud workspace now."
        : cloudSyncReady
      ? "Cloud sync is active. Files and folders save to PseudocodeCompiler Cloud."
      : "Signed in. Cloud save is temporarily unavailable."
  const saveButtonText = authLoading
    ? "Checking…"
    : !authAvailable
      ? isSaving
        ? "Saving…"
        : "Save"
      : !isAuthenticated
        ? "Sign In to Save"
        : !cloudSaveReady
          ? "Connecting…"
          : isSaving
            ? "Saving…"
            : "Save";
  const saveStatusText = isSaving
    ? "Saving files and folders…"
    : !authAvailable
      ? hasUnsavedChanges
        ? "Unsaved changes"
        : "Workspace files and settings stay on this device."
      : !isAuthenticated
      ? hasUnsavedChanges
        ? "Guest session. Changes are wiped when you reload or close the app."
        : "Guest session. Sign in to keep files and folders across sessions."
      : cloudSyncLoading
        ? "Signed in. Finalizing cloud save for this workspace."
        : !cloudSyncReady
          ? "Signed in, but cloud save is not ready yet."
          : hasUnsavedChanges
            ? "Cloud sync ready. Unsaved changes are waiting to be uploaded."
            : "Cloud sync active. All files and folders are saved.";

  /* ── effects ── */

  useEffect(() => {
    if (renameDialog) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renameDialog]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    applyResolvedTheme(resolvedTheme);
    saveThemeMode(themeMode);
  }, [resolvedTheme, themeMode]);

  useEffect(() => {
    if (isAuthenticated) {
      setAuthDialogOpen(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!authAvailable || !isAuthenticated) {
      setShowAccountMenu(false);
    }
  }, [authAvailable, isAuthenticated]);

  useEffect(() => {
    if (!authDialogOpen || typeof window === "undefined") {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAuthDialogOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [authDialogOpen]);

  useEffect(() => {
    if (!manualOpen || typeof window === "undefined") {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setManualOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [manualOpen]);

  useEffect(() => {
    if (!showAccountMenu || typeof window === "undefined") {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (
        target &&
        (accountButtonRef.current?.contains(target) || accountMenuRef.current?.contains(target))
      ) {
        return;
      }
      setShowAccountMenu(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowAccountMenu(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showAccountMenu]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveWorkspaceNow("manual");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saveWorkspaceNow]);

  useEffect(() => {
    if (typeof window === "undefined" || !hasUnsavedChanges || isDesktopShell) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges, isDesktopShell]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const electron = (window as Window & { electron?: DesktopElectronBridge }).electron;
    if (!electron?.onSaveRequested) {
      return;
    }

    return electron.onSaveRequested((request) =>
      saveWorkspaceNow(request.reason === "close" ? "close" : "manual"),
    );
  }, [saveWorkspaceNow]);

  const scrollOutputToBottom = useCallback(() => {
    if (!shouldAutoScrollOutputRef.current) {
      return;
    }

    const element = desktopTerminalScrollRef.current;
    if (element) {
      element.scrollTop = element.scrollHeight;
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
  ]);

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

  const openAuthDialog = useCallback(() => {
    if (!authAvailable) {
      return;
    }
    setAuthDialogOpen(true);
  }, [authAvailable]);

  const closeAuthDialog = useCallback(() => {
    setAuthDialogOpen(false);
  }, []);

  const beginAuthFlow = useCallback((mode: "sign-in" | "sign-up" = "sign-in") => {
    if (typeof window === "undefined") {
      return;
    }

    const returnTo = `${window.location.pathname}${window.location.search}` || "/";
    window.location.assign(getAuthRouteHref(mode, returnTo));
  }, []);

  const handleSignIn = useCallback(() => {
    openAuthDialog();
  }, [openAuthDialog]);

  const handleCreateAccount = useCallback(() => {
    beginAuthFlow("sign-up");
  }, [beginAuthFlow]);

  const handleSignOut = useCallback(() => {
    if (!authAvailable) {
      return;
    }
    setShowAccountMenu(false);
    const returnTo =
      typeof window === "undefined"
        ? "/"
        : `${window.location.pathname}${window.location.search}` || "/";
    void signOut({ returnTo });
  }, [authAvailable, signOut]);

  const handleOpenSettings = useCallback(() => {
    setShowAccountMenu(false);
    setShowSettingsPanel(true);
  }, []);

  const handleManualSave = useCallback(() => {
    if (!isAuthenticated) {
      handleSignIn();
      return;
    }

    if (!cloudSaveReady) {
      return;
    }

    void saveWorkspaceNow("manual");
  }, [cloudSaveReady, handleSignIn, isAuthenticated, saveWorkspaceNow]);

  const handleOpenManual = useCallback(() => {
    setManualOpen(true);
  }, []);

  const handleCloseManual = useCallback(() => {
    setManualOpen(false);
  }, []);

  const handleThemeModeChange = useCallback((mode: ThemeMode) => {
    setThemeMode(mode);
  }, []);

  const handleFlowchartModeEnabledChange = useCallback((enabled: boolean) => {
    setFlowchartModeEnabled(enabled);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(FLOWCHART_MODE_STORAGE_KEY, String(enabled));
    }
    if (!enabled) {
      setFlowchartOpen(false);
    }
  }, []);

  const handleToggleFlowchart = useCallback(() => {
    if (!flowchartModeEnabled) {
      setShowSettingsPanel(true);
      return;
    }
    setFlowchartOpen((current) => !current);
  }, [flowchartModeEnabled]);

  const handleFlowchartCodeChange = useCallback(
    (code: string) => {
      if (currentDocument && currentDocument.source !== code) {
        handleDocumentSourceChange(currentDocument.id, code);
      }
    },
    [currentDocument, handleDocumentSourceChange],
  );

  const handleGenerateFlowchartCode = useCallback(
    (code: string) => {
      if (currentDocument) {
        handleDocumentSourceChange(currentDocument.id, code);
        setFlowchartOpen(false);
      }
    },
    [currentDocument, handleDocumentSourceChange],
  );

  const renderThemeSettings = (compact = false) => (
    <div className={compact ? "mt-6 space-y-3" : "space-y-3"}>
      <div>
        <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--text3)]">
          APPEARANCE
        </p>
        <h3 className="mt-2 text-[22px] font-semibold text-[var(--text)]">Theme</h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-[var(--text2)]">
          Choose how the compiler shell should look on this device. The editor, workspace,
          output, and dialogs all follow the same setting.
        </p>
      </div>

      <div className="grid gap-3">
        {THEME_OPTIONS.map((option) => {
          const selected = themeMode === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => handleThemeModeChange(option.value)}
              aria-pressed={selected}
              className={`rounded-2xl border px-4 py-3 text-left transition ${
                selected
                  ? "border-[var(--accent)] bg-[var(--selected)]"
                  : "border-[var(--separator)] bg-[var(--surface)] hover:bg-[var(--surface2)]"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-[var(--text)]">{option.label}</span>
                {selected ? (
                  <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white">
                    Active
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm leading-5 text-[var(--text2)]">{option.description}</p>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-[var(--text3)]">
        Current resolved appearance:{" "}
        <span className="font-semibold capitalize text-[var(--text2)]">{resolvedTheme}</span>
      </p>
    </div>
  );

  const renderSaveSettings = (compact = false) => (
    <div className={compact ? "mt-6 space-y-3" : "space-y-3"}>
      <div>
        <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--text3)]">
          SAVE
        </p>
        <h3 className="mt-2 text-[22px] font-semibold text-[var(--text)]">Files and folders</h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-[var(--text2)]">
          Save the current workspace manually with Command/Ctrl+S or let the app autosave it on a
          timer.
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--separator)] bg-[var(--surface)] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--text)]">Workspace status</p>
            <p className="mt-1 text-sm text-[var(--text2)]">{saveStatusText}</p>
          </div>
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-2xl bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
            onClick={handleManualSave}
            disabled={isSaving || authLoading || (isAuthenticated && !cloudSaveReady)}
          >
            {authLoading
              ? "Checking…"
              : !isAuthenticated
                ? "Sign In to Save"
                : !cloudSaveReady
                  ? "Connecting…"
                  : isSaving
                    ? "Saving…"
                    : "Save Now"}
          </button>
        </div>
      </div>

      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-[var(--text)]">Autosave every</span>
        <select
          aria-label="Autosave interval"
          value={String(autosaveIntervalMinutes)}
          onChange={(event) => updateAutosaveInterval(Number(event.target.value))}
          disabled={!isAuthenticated || !cloudSaveReady}
          className="h-11 w-full rounded-2xl border border-[var(--separator)] bg-[var(--surface)] px-4 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
        >
          {AUTOSAVE_INTERVAL_OPTIONS.map((minutes) => (
            <option key={minutes} value={minutes}>
              {minutes} {minutes === 1 ? "minute" : "minutes"}
            </option>
          ))}
        </select>
      </label>
    </div>
  );

  const renderBetaSettings = (compact = false) => (
    <div className={compact ? "mt-6 space-y-4" : "space-y-4"}>
      <div>
        <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--text3)]">
          FEATURE PREVIEWS
        </p>
        <h3 className="mt-2 text-[22px] font-semibold text-[var(--text)]">Beta features</h3>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--separator)] bg-[var(--surface2)] px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-[var(--text)]">Flowchart mode</span>
            <span className="rounded-full border border-[var(--accent)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--accent)]">
              Beta
            </span>
          </div>
          <p className="mt-0.5 text-sm leading-5 text-[var(--text2)]">
            Enable the visual flowchart editor from the toolbar.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={flowchartModeEnabled}
          aria-label="Enable Flowchart mode beta"
          onClick={() => handleFlowchartModeEnabledChange(!flowchartModeEnabled)}
          className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
            flowchartModeEnabled ? "bg-[var(--accent)]" : "bg-[var(--separator)]"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
              flowchartModeEnabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
    </div>
  );

  const renderAccountSettings = (compact = false) => (
    <div className={compact ? "mt-6 space-y-3" : "space-y-3"}>
      <div>
        <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--text3)]">
          ACCOUNT
        </p>
        <h3 className="mt-2 text-[22px] font-semibold text-[var(--text)]">Workspace access</h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-[var(--text2)]">
          Signed-in users get persistent workspaces. Guest sessions stay in memory only and are
          cleared as soon as the app reloads or restarts.
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--separator)] bg-[var(--surface)] px-4 py-3">
        {authLoading ? (
          <p className="text-sm text-[var(--text2)]">Checking sign-in status…</p>
        ) : !authAvailable ? (
          <p className="text-sm text-[var(--text2)]">
            The desktop app stores your workspace locally on this device. No account setup or
            internet connection is required. Cloud sync is only available in the hosted web build.
          </p>
        ) : isAuthenticated ? (
          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-semibold text-white">
                  {authAvatarInitial}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-[var(--green)]" aria-hidden="true" />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                      {authStatusLabel}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-[var(--text)]">{authDisplayName}</p>
                </div>
              </div>
              {authIdentityLine ? (
                <p className="mt-2 text-sm text-[var(--text2)]">{authIdentityLine}</p>
              ) : null}
              <p className="mt-1 text-sm text-[var(--text2)]">{authStatusDetail}</p>
            </div>
            <p className="text-sm text-[var(--text2)]">
              {cloudSaveReady
                ? "Open the account menu in the top-right corner for settings and log out."
                : "Your account is signed in. Cloud save will unlock as soon as the workspace handshake finishes."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                {authStatusLabel}
              </p>
              <p className="mt-1 text-sm text-[var(--text2)]">
                You are using a guest session. Files, folders, and autosave preferences will be
                discarded when this session ends.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center rounded-2xl bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:brightness-110"
                onClick={handleSignIn}
              >
                Sign In
              </button>
            </div>
            <p className="text-xs leading-5 text-[var(--text3)]">
              Need a new account? Use <span className="font-semibold text-[var(--text2)]">Create an account</span> on the sign-in screen.
            </p>
          </div>
        )}
      </div>
    </div>
  );

  const renderStarterPanel = (compact = false) => (
    <div
      className={`flex h-full min-h-0 items-center justify-center px-5 ${
        compact ? "py-8" : "py-12"
      }`}
    >
      <section className="relative w-full max-w-2xl overflow-hidden rounded-[28px] border border-[var(--separator)] bg-[linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(10,132,255,0.18),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(52,199,89,0.12),transparent_32%)]" />
        <div className="relative">
          <p className="text-[11px] font-semibold tracking-[0.22em] text-[var(--accent)]">
            START HERE
          </p>
          <h2 className="mt-4 text-3xl font-semibold text-[var(--text)]">
            Create your first file.
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--text2)]">
            This workspace starts empty on purpose. Add a pseudocode file from the explorer, then write, compile, and run from there.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-[var(--accent)] px-5 text-sm font-semibold text-white transition hover:brightness-110"
              onClick={() => createDocumentInWorkspace()}
            >
              Create First File
            </button>
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-[var(--separator)] bg-[var(--surface)] px-5 text-sm font-semibold text-[var(--text2)] transition hover:bg-[var(--surface2)]"
              onClick={() => createFolderInWorkspace()}
            >
              Create Folder
            </button>
          </div>
        </div>
      </section>
    </div>
  );

  const renderWorkspaceHydrationPanel = (compact = false) => (
    <div
      className={`flex h-full min-h-0 items-center justify-center px-5 ${
        compact ? "py-8" : "py-12"
      }`}
    >
      <section className="relative w-full max-w-2xl overflow-hidden rounded-[28px] border border-[var(--separator)] bg-[linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(10,132,255,0.18),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(52,199,89,0.12),transparent_32%)]" />
        <div className="relative">
          <p className="text-[11px] font-semibold tracking-[0.22em] text-[var(--accent)]">
            CONNECTING
          </p>
          <h2 className="mt-4 text-3xl font-semibold text-[var(--text)]">
            Loading your workspace.
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--text2)]">
            You are signed in. Waiting for cloud sync to finish before showing your files and folders.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-[var(--separator)] bg-[var(--surface)] px-3 py-1.5 text-[11px] font-semibold text-[var(--text2)]">
            <span className="h-2 w-2 rounded-full bg-[var(--green)]" aria-hidden="true" />
            {authStatusLabel}
          </div>
        </div>
      </section>
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

  if (!workspace) {
    return (
      <main className="min-h-dvh bg-[var(--bg)]">
        <div className="flex min-h-dvh items-center justify-center px-4 py-10">
          <section className="w-full max-w-lg rounded-xl border border-[var(--separator)] bg-[var(--surface)] p-6">
            <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--accent)]">
              {authLoading ? "Account" : "Workspace"}
            </p>
            <h1 className="mt-3 text-2xl font-semibold text-[var(--text)]">
              {authLoading ? "Checking session…" : "Loading workspace…"}
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--text2)]">
              {authLoading
                ? "Preparing sign-in state before loading your workspace."
                : "Preparing the editor layout and runtime panels."}
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-[var(--separator)] bg-[var(--bg)] px-3 py-1.5 text-[11px] font-semibold text-[var(--text2)]">
              <span
                className={`h-2 w-2 rounded-full ${isAuthenticated ? "bg-[var(--green)]" : "bg-[var(--text3)]"}`}
                aria-hidden="true"
              />
              {authStatusLabel}
            </div>
            <p className="mt-2 text-xs leading-5 text-[var(--text3)]">{authStatusDetail}</p>
          </section>
        </div>
      </main>
    );
  }

  const authDialog = authAvailable && !isAuthenticated && authDialogOpen ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-dialog-title"
      onClick={closeAuthDialog}
    >
      <section
        className="w-full max-w-md rounded-[28px] border border-[var(--separator)] bg-[var(--surface)] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--accent)]">
              ACCOUNT
            </p>
            <h2 id="auth-dialog-title" className="mt-2 text-2xl font-semibold text-[var(--text)]">
              Save your workspace
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--text2)]">
              Sign in to unlock cloud saving for files, folders, and autosave settings. If you need
              a new account, use <span className="font-semibold text-[var(--text)]">Create an account</span> on the sign-in page.
            </p>
          </div>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text3)] transition hover:bg-[var(--surface2)] hover:text-[var(--text2)]"
            aria-label="Close sign in dialog"
            onClick={closeAuthDialog}
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-6 grid gap-3">
          <button
            type="button"
            className="inline-flex h-12 items-center justify-center rounded-2xl bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:brightness-110"
            onClick={() => beginAuthFlow("sign-in")}
          >
            Sign In
          </button>
        </div>

        <button
          type="button"
          className="mt-4 inline-flex self-start text-xs font-medium text-[var(--accent)] underline decoration-[length:3px] underline-offset-4 transition hover:opacity-80"
          onClick={handleCreateAccount}
        >
          Need an account? Create one here.
        </button>

        <p className="mt-4 text-xs leading-5 text-[var(--text3)]">
          Guest sessions stay in memory only and are cleared when you reload or close the app.
        </p>
      </section>
    </div>
  ) : null;

  const manualDialog = manualOpen ? (
    <div
      className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-dialog-title"
      onClick={handleCloseManual}
    >
      <div className="flex h-full w-full items-stretch justify-center p-3 md:p-6">
        <section
          className="exam-shell flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-[var(--separator)] shadow-[0_30px_80px_rgba(0,0,0,0.35)]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 md:p-6">
            <div className="sr-only" id="manual-dialog-title">
              Pseudocode Compiler manual
            </div>
            <ManualGuideContent onClose={handleCloseManual} />
          </div>
        </section>
      </div>
    </div>
  ) : null;

  /* ── render ── */

  return (
    <main className="flex h-dvh flex-col overflow-hidden">
      {authDialog}
      {manualDialog}
      {/* ════════════ Title Bar ════════════ */}
      <header
        className={`flex h-[52px] shrink-0 items-center px-4 bg-[var(--titlebar)] ${
          isDesktopShell ? "app-drag-region" : ""
        }`}
      >
        <div className={`flex items-center gap-2 ${isDesktopShell ? "w-[80px]" : "min-w-0 flex-1"}`}>
          {isDesktopShell ? null : (
            <p className="truncate text-[13px] font-medium text-[var(--text2)]">Pseudocode Compiler</p>
          )}
        </div>

        {isDesktopShell ? (
          <>
            <div className="flex-1" />
            <p className="text-[13px] font-medium text-[var(--text2)]">Pseudocode Compiler</p>
            <div className="flex-1" />
          </>
        ) : null}

        {/* Toolbar */}
        <div className="app-no-drag flex items-center gap-1.5">
          {authLoading ? (
            <span className="px-2 text-[11px] font-medium text-[var(--text3)]">Auth…</span>
          ) : !authAvailable ? (
            <span className="inline-flex h-7 items-center rounded-full border border-[var(--separator)] px-3 text-[11px] font-semibold text-[var(--text2)]">
              {authStatusLabel}
            </span>
          ) : isAuthenticated ? (
            <>
              <span className="inline-flex h-7 items-center gap-2 rounded-full border border-[var(--separator)] px-3 text-[11px] font-semibold text-[var(--text2)]">
                <span className="h-2 w-2 rounded-full bg-[var(--green)]" aria-hidden="true" />
                {authStatusLabel}
              </span>
              <div className="relative">
                <button
                  ref={accountButtonRef}
                  type="button"
                  className="flex h-7 max-w-[220px] items-center gap-2 rounded-full border border-[var(--separator)] px-2 text-[11px] font-medium text-[var(--text2)] transition hover:bg-[var(--hover)]"
                  aria-label={`Open account menu for ${authDisplayName}`}
                  aria-haspopup="menu"
                  aria-expanded={showAccountMenu}
                  aria-controls={showAccountMenu ? "account-menu" : undefined}
                  onClick={() => setShowAccountMenu((current) => !current)}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[10px] font-semibold text-white">
                    {authAvatarInitial}
                  </span>
                  <span className="truncate">{authDisplayName}</span>
                  <ChevronDown
                    size={14}
                    className={`shrink-0 transition ${showAccountMenu ? "rotate-180" : ""}`}
                  />
                </button>
                {showAccountMenu ? (
                  <div
                    ref={accountMenuRef}
                    id="account-menu"
                    role="menu"
                    aria-label="Account menu"
                    className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-56 overflow-hidden rounded-2xl border border-[var(--separator)] bg-[var(--surface)] shadow-[0_18px_40px_rgba(0,0,0,0.22)]"
                  >
                    <div className="border-b border-[var(--separator)] px-4 py-3">
                      <p className="truncate text-sm font-semibold text-[var(--text)]">
                        {authDisplayName}
                      </p>
                      {authIdentityLine ? (
                        <p className="mt-1 truncate text-xs text-[var(--text3)]">
                          {authIdentityLine}
                        </p>
                      ) : null}
                    </div>
                    <div className="p-1.5">
                      <button
                        type="button"
                        role="menuitem"
                        className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm font-medium text-[var(--text2)] transition hover:bg-[var(--surface2)] hover:text-[var(--text)]"
                        onClick={handleOpenSettings}
                      >
                        Settings
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm font-medium text-[var(--text2)] transition hover:bg-[var(--surface2)] hover:text-[var(--text)]"
                        onClick={handleSignOut}
                      >
                        Log Out
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <span className="inline-flex h-7 items-center rounded-full border border-[var(--separator)] px-3 text-[11px] font-semibold text-[var(--text2)]">
                {authStatusLabel}
              </span>
              <button
                type="button"
                className="flex h-7 items-center gap-1.5 rounded-[14px] border border-[var(--separator)] px-3 py-[5px] text-[var(--text2)] transition hover:bg-[var(--hover)]"
                onClick={handleSignIn}
              >
                <span className="text-xs font-semibold">Sign In</span>
              </button>
            </>
          )}
          <button
            type="button"
            className="flex h-7 items-center gap-1.5 rounded-[14px] border border-[var(--separator)] px-3 py-[5px] text-[var(--text2)] transition hover:bg-[var(--hover)] disabled:opacity-60"
            aria-label={
              authLoading
                ? "Checking save access"
                : !authAvailable
                  ? isSaving
                    ? "Saving workspace"
                    : "Save workspace"
                : isAuthenticated
                  ? !cloudSaveReady
                    ? "Connecting cloud workspace"
                    : isSaving
                      ? "Saving workspace"
                      : "Save workspace"
                  : "Sign in to save workspace"
            }
            onClick={handleManualSave}
            disabled={isSaving || authLoading || (isAuthenticated && !cloudSaveReady)}
          >
            <SaveIcon size={12} />
            <span className="text-xs font-semibold">
              {saveButtonText}
            </span>
          </button>
          <button
            type="button"
            className="flex h-7 items-center gap-1.5 rounded-[14px] bg-[var(--green)] px-3.5 py-[5px] text-white transition hover:brightness-110 disabled:opacity-50"
            aria-label={isRunning ? "Running" : "Run"}
            onClick={handleRun}
            disabled={isRunning || !currentDocument}
          >
            <Play size={12} fill="white" />
            <span className="text-xs font-semibold">Run</span>
          </button>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text3)] transition hover:text-[var(--text2)]"
            aria-label="Manual"
            onClick={handleOpenManual}
          >
            <BookOpen size={18} />
          </button>
          {flowchartModeEnabled ? (
            <button
              type="button"
              className={`flex h-7 w-7 items-center justify-center rounded-md transition ${
                flowchartVisible
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--text3)] hover:text-[var(--text2)]"
              } disabled:opacity-50`}
              aria-label={flowchartVisible ? "Switch to code view" : "Switch to flowchart view"}
              title={flowchartVisible ? "Switch to code view" : "Switch to flowchart view"}
              onClick={handleToggleFlowchart}
              disabled={!currentDocument}
            >
              <GitBranch size={18} />
            </button>
          ) : null}
          {authLoading || !authAvailable || !isAuthenticated ? (
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text3)] transition hover:text-[var(--text2)]"
              aria-label="Settings"
              onClick={() => setShowSettingsPanel(true)}
            >
              <Settings size={18} />
            </button>
          ) : null}
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
            actionsDisabled={isWorkspaceHydrating && !editorActiveDoc}
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
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--bg)]">
          <div className="relative min-h-0 flex-1 overflow-hidden">
            {flowchartModeEnabled ? (
              <div
                aria-hidden={!flowchartVisible}
                className={`absolute inset-0 z-20 min-h-0 min-w-0 transition-transform duration-500 ease-in-out ${
                  flowchartVisible ? "translate-x-0" : "translate-x-full pointer-events-none"
                }`}
              >
                <FlowchartEditor
                  source={currentDocument?.source ?? ""}
                  onCodeChange={handleFlowchartCodeChange}
                  onGenerateCode={handleGenerateFlowchartCode}
                />
              </div>
            ) : null}

            <div
              aria-hidden={flowchartVisible}
              className={`absolute inset-0 flex min-h-0 min-w-0 flex-col transition-transform duration-500 ease-in-out ${
                flowchartVisible ? "-translate-x-full pointer-events-none" : "translate-x-0"
              }`}
            >
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
            {editorActiveDoc ? (
              <MonacoPseudocodeEditor
                documentKey={editorActiveDoc.id}
                value={editorActiveDoc.source}
                onChange={(value) => handleDocumentSourceChange(editorActiveDoc.id, value)}
                diagnostics={
                  activeDocument?.id === editorActiveDoc.id ? compileDiagnostics : []
                }
                theme={resolvedTheme}
              />
            ) : isWorkspaceHydrating ? (
              renderWorkspaceHydrationPanel()
            ) : (
              renderStarterPanel()
            )}
          </div>
            </div>
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

      {showSettingsPanel && (
        <div className="fixed inset-0 z-[65] overflow-y-auto bg-[rgba(18,15,12,0.45)] p-4 sm:flex sm:items-center sm:justify-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-dialog-title"
            className="mx-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-[24px] border border-[var(--separator)] bg-[var(--surface)] shadow-[0_20px_60px_rgba(0,0,0,0.22)]"
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--separator)] px-6 py-6">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Settings</p>
                <h2
                  id="settings-dialog-title"
                  className="mt-2 text-2xl font-semibold text-[var(--text)]"
                >
                  Workspace
                </h2>
              </div>
              <button
                type="button"
                className="rounded-md border border-[var(--separator)] bg-[var(--surface2)] px-3 py-1.5 text-sm text-[var(--text2)] hover:bg-[var(--surface3)]"
                onClick={() => setShowSettingsPanel(false)}
              >
                Close
              </button>
            </div>
            <div
              data-testid="settings-dialog-scroll-region"
              className="min-h-0 overflow-y-auto overscroll-contain px-6 pb-6 pt-5"
            >
              <div className="space-y-6">
                {renderAccountSettings()}
                {renderSaveSettings()}
                {renderBetaSettings()}
                {renderThemeSettings()}
              </div>
            </div>
          </div>
        </div>
      )}

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

export default HomePageClient;
