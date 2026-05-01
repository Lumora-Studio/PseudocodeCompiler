import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultWorkspace, createDocument, createEmptyWorkspace, createFolder, getChildNodes, setActiveDocument, type WorkspaceState } from "@igcse/workspace";
import type { WorkspacePersistenceMode } from "@/lib/platform";

const { loadWorkspaceMock, saveWorkspaceMock, compilePseudocodeMock, runMock, authState } = vi.hoisted(() => ({
  loadWorkspaceMock: vi.fn<(_sampleSource: string, options?: { mode?: WorkspacePersistenceMode }) => Promise<WorkspaceState>>(),
  saveWorkspaceMock: vi.fn<(state: WorkspaceState, options?: { mode?: WorkspacePersistenceMode }) => Promise<void>>(),
  compilePseudocodeMock: vi.fn(),
  runMock: vi.fn(),
  authState: {
    user: null as null | {
      id: string;
      email: string;
      firstName?: string | null;
      lastName?: string | null;
    },
    loading: false,
  },
}));
const localStore = new Map<string, string>();
const FLOWCHART_MODE_STORAGE_KEY = "pseudocode-compiler-flowchart-mode-enabled";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/auth-components", () => ({
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
  Show: ({ children, when }: { children: React.ReactNode; when: "signed-in" | "signed-out" }) => {
    const signedIn = Boolean(authState.user);
    return (when === "signed-in" && signedIn) || (when === "signed-out" && !signedIn)
      ? children
      : null;
  },
  isCloudAuthConfigured: () => true,
  SignInButton: ({ children }: { children: React.ReactNode }) => children,
  SignUpButton: ({ children }: { children: React.ReactNode }) => children,
  UserButton: () => <button type="button" aria-label="User profile" />,
  useAuth: () => ({
    isLoaded: !authState.loading,
    isSignedIn: Boolean(authState.user),
    userId: authState.user?.id ?? null,
  }),
}));

vi.mock("@/lib/storage", () => ({
  loadWorkspace: loadWorkspaceMock,
  saveWorkspace: saveWorkspaceMock,
}));

vi.mock("@/compiler", () => ({
  compilePseudocode: compilePseudocodeMock,
}));

vi.mock("@/runtime/executePython", () => ({
  pythonRunner: {
    run: runMock,
  },
}));

vi.mock("@/app/components/MonacoPseudocodeEditor", () => ({
  MonacoPseudocodeEditor: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: string) => void;
  }) => (
    <textarea
      aria-label="Mock editor"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

vi.mock("@/app/components/flowchart/FlowchartEditor", () => ({
  default: ({
    source,
    onCodeChange,
    onGenerateCode,
  }: {
    source?: string;
    onCodeChange?: (code: string) => void;
    onGenerateCode?: (code: string) => void;
  }) => (
    <div>
      <output aria-label="Mock flowchart source">{source ?? ""}</output>
      <button type="button" onClick={() => onCodeChange?.('OUTPUT "Live from blocks"')}>
        Mock Live Flowchart
      </button>
      <button type="button" onClick={() => onGenerateCode?.('OUTPUT "Generated from blocks"')}>
        Mock Generate Flowchart
      </button>
    </div>
  ),
}));

import HomePage from "@/app/page";

function createWorkspaceFixture(activeDocumentId = "doc-main") {
  let workspace = createDefaultWorkspace({
    sampleSource: 'OUTPUT "Main"',
    now: "2026-03-15T00:00:00.000Z",
  });
  workspace = createDocument(workspace, {
    parentId: workspace.rootFolderId,
    name: "Helper",
    source: 'OUTPUT "Helper"',
    id: "doc-helper",
    now: "2026-03-15T00:01:00.000Z",
  });
  return setActiveDocument(workspace, activeDocumentId);
}

function setDesktopRuntime() {
  Object.defineProperty(window as Window & { electron?: { isDesktop?: boolean } }, "electron", {
    configurable: true,
    value: { isDesktop: true },
  });
}

function setDeployedBrowserRuntime() {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: new URL("https://pseudocode-compiler-preview.vercel.app/"),
  });
}

function setLocalBrowserRuntime() {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: new URL("http://localhost:3000/"),
  });
}

function createDataTransferMock() {
  const store = new Map<string, string>();

  return {
    effectAllowed: "all",
    dropEffect: "move",
    setData: (type: string, value: string) => {
      store.set(type, value);
    },
    getData: (type: string) => store.get(type) ?? "",
  };
}

function mockRowRect(element: Element, top = 0, height = 40) {
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      x: 0,
      y: top,
      top,
      left: 0,
      bottom: top + height,
      right: 320,
      width: 320,
      height,
      toJSON: () => "",
    }),
  });
}

function getExplorerButton(name: string): HTMLElement {
  const match = screen
    .getAllByRole("button", { name })
    .find((button) => button.closest('[data-workspace-row="true"]'));
  if (!match) {
    throw new Error(`Explorer button "${name}" not found.`);
  }
  return match;
}

function getExplorerRow(name: string): HTMLElement {
  const row = getExplorerButton(name).closest('[data-workspace-row="true"]');
  if (!row) {
    throw new Error(`Explorer row "${name}" not found.`);
  }
  return row as HTMLElement;
}

function getExplorerHeaderButton(name: string): HTMLElement {
  const match = screen
    .getAllByRole("button", { name })
    .find((button) => !button.closest('[data-workspace-row="true"]'));
  if (!match) {
    throw new Error(`Explorer header button "${name}" not found.`);
  }
  return match;
}

function enableFlowchartModeBeta() {
  localStore.set(FLOWCHART_MODE_STORAGE_KEY, "true");
}

describe("HomePage workspace flow", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    setDeployedBrowserRuntime();
    loadWorkspaceMock.mockReset();
    saveWorkspaceMock.mockReset();
    compilePseudocodeMock.mockReset();
    runMock.mockReset();
    authState.user = {
      id: "user_123",
      email: "alex@example.com",
      firstName: "Alex",
      lastName: null,
    };
    authState.loading = false;
    Object.defineProperty(window as Window & { electron?: { isDesktop?: boolean } }, "electron", {
      configurable: true,
      value: undefined,
    });
    localStore.clear();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => localStore.get(key) ?? null,
        setItem: (key: string, value: string) => {
          localStore.set(key, value);
        },
        removeItem: (key: string) => {
          localStore.delete(key);
        },
        clear: () => {
          localStore.clear();
        },
      },
    });
  });

  it("opens documents and updates the editor content", async () => {
    loadWorkspaceMock.mockResolvedValue(createWorkspaceFixture());
    render(<HomePage />);

    expect(await screen.findByRole("textbox", { name: "Mock editor" })).toHaveValue('OUTPUT "Main"');

    fireEvent.click(getExplorerButton("Helper.pseudo"));

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "Mock editor" })).toHaveValue('OUTPUT "Helper"');
    });
  });

  it("creates and renames documents while persisting tree changes", async () => {
    loadWorkspaceMock.mockResolvedValue(createWorkspaceFixture());
    render(<HomePage />);
    await screen.findByRole("textbox", { name: "Mock editor" });

    fireEvent.click(getExplorerHeaderButton("Create File"));
    await waitFor(() => {
      expect(getExplorerButton("Untitled.pseudo")).toBeInTheDocument();
    });

    fireEvent.contextMenu(getExplorerButton("Untitled.pseudo"));
    fireEvent.click(await screen.findByRole("button", { name: "Rename" }));
    fireEvent.change(screen.getByLabelText("Item name"), { target: { value: "Renamed Doc" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Name" }));
    await waitFor(() => {
      expect(getExplorerButton("Renamed Doc.pseudo")).toBeInTheDocument();
    });
    expect(saveWorkspaceMock).toHaveBeenCalled();
  });

  it("creates the first desktop file from the starter dialog and opens the editor", async () => {
    setDesktopRuntime();
    loadWorkspaceMock.mockResolvedValue(createEmptyWorkspace("2026-03-15T00:00:00.000Z"));
    render(<HomePage />);

    expect(await screen.findByText("Welcome to Pseudocode Compiler")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create New File" }));
    const dialog = await screen.findByRole("dialog", { name: "Create New File" });
    fireEvent.change(within(dialog).getByLabelText("File name"), {
      target: { value: "main.pseudo" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create File" }));

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "Mock editor" })).toHaveValue("");
    });
  });

  it("live updates the editor when flowchart code changes", async () => {
    enableFlowchartModeBeta();
    loadWorkspaceMock.mockResolvedValue(createWorkspaceFixture());
    render(<HomePage />);

    expect(await screen.findByRole("textbox", { name: "Mock editor" })).toHaveValue('OUTPUT "Main"');

    fireEvent.click(screen.getByRole("button", { name: "Switch to flowchart view" }));
    fireEvent.click(screen.getByRole("button", { name: "Mock Live Flowchart" }));

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "Mock editor", hidden: true })).toHaveValue(
        'OUTPUT "Live from blocks"',
      );
    });
  });

  it("keeps the flowchart connected to the current pseudocode source", async () => {
    enableFlowchartModeBeta();
    loadWorkspaceMock.mockResolvedValue(createWorkspaceFixture());
    render(<HomePage />);

    const editor = await screen.findByRole("textbox", { name: "Mock editor" });

    fireEvent.click(screen.getByRole("button", { name: "Switch to flowchart view" }));
    expect(screen.getByLabelText("Mock flowchart source")).toHaveTextContent('OUTPUT "Main"');

    fireEvent.change(editor, { target: { value: 'OUTPUT "Updated from editor"' } });

    await waitFor(() => {
      expect(screen.getByLabelText("Mock flowchart source")).toHaveTextContent(
        'OUTPUT "Updated from editor"',
      );
    });
  });

  it("keeps the flowchart visible while terminal output appears underneath", async () => {
    enableFlowchartModeBeta();
    loadWorkspaceMock.mockResolvedValue(createWorkspaceFixture());
    compilePseudocodeMock.mockReturnValue({
      success: true,
      diagnostics: [],
      pythonCode: "print('flowchart')",
    });
    runMock.mockResolvedValue({
      success: true,
      stdout: "Hello from flowchart",
      stderr: "",
      diagnostics: [],
      virtualFiles: {},
    });

    render(<HomePage />);
    await screen.findByRole("textbox", { name: "Mock editor" });

    fireEvent.click(screen.getByRole("button", { name: "Switch to flowchart view" }));
    expect(screen.getByLabelText("Mock flowchart source")).toHaveTextContent('OUTPUT "Main"');

    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Mock flowchart source")).toBeInTheDocument();
      expect(screen.getByText(/Hello from flowchart/)).toBeInTheDocument();
    });
  });

  it("requires enabling Flowchart mode beta from settings before opening it", async () => {
    loadWorkspaceMock.mockResolvedValue(createWorkspaceFixture());
    render(<HomePage />);

    await screen.findByRole("textbox", { name: "Mock editor" });

    expect(
      screen.queryByRole("button", { name: "Switch to flowchart view" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));

    const dialog = await screen.findByRole("dialog", { name: "Settings" });
    expect(within(dialog).getByText("Beta features")).toBeInTheDocument();
    expect(within(dialog).getByText("Beta")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mock Live Flowchart" })).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("switch", { name: "Enable Flowchart mode beta" }));

    expect(localStore.get(FLOWCHART_MODE_STORAGE_KEY)).toBe("true");
    expect(
      screen.getByRole("button", { name: "Switch to flowchart view" }),
    ).toBeInTheDocument();
  });

  it("reorders documents through workspace controls", async () => {
    loadWorkspaceMock.mockResolvedValue(createWorkspaceFixture());
    render(<HomePage />);
    await screen.findByRole("textbox", { name: "Mock editor" });

    fireEvent.contextMenu(getExplorerButton("Helper.pseudo"));
    fireEvent.click(await screen.findByRole("button", { name: "Move Up" }));

    await waitFor(() => {
      const savedState = saveWorkspaceMock.mock.lastCall?.[0] as WorkspaceState;
      const order = getChildNodes(savedState, savedState.rootFolderId).map((node) => node.name);
      expect(order.slice(0, 2)).toEqual(["Helper.pseudo", "main.pseudo"]);
    });
  });

  it("opens explorer actions from a touch long press", async () => {
    loadWorkspaceMock.mockResolvedValue(createWorkspaceFixture());
    render(<HomePage />);
    await screen.findByRole("textbox", { name: "Mock editor" });

    const helperRow = getExplorerRow("Helper.pseudo");

    vi.useFakeTimers();
    try {
      fireEvent.pointerDown(helperRow, {
        pointerType: "touch",
        pointerId: 1,
        clientX: 96,
        clientY: 148,
      });

      await act(async () => {
        vi.advanceTimersByTime(430);
      });

      fireEvent.pointerUp(helperRow, {
        pointerType: "touch",
        pointerId: 1,
        clientX: 96,
        clientY: 148,
      });

      expect(screen.getByRole("menu", { name: "Explorer actions" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Rename" })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("deletes the selected item from the explorer context menu", async () => {
    let workspace = createWorkspaceFixture();
    workspace = createDocument(workspace, {
      parentId: workspace.rootFolderId,
      name: "Third",
      source: 'OUTPUT "Third"',
      id: "doc-third",
      now: "2026-03-15T00:02:00.000Z",
    });
    loadWorkspaceMock.mockResolvedValue(workspace);
    render(<HomePage />);
    await screen.findByRole("textbox", { name: "Mock editor" });

    fireEvent.contextMenu(getExplorerButton("Helper.pseudo"));
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    expect(screen.getByText('Delete "Helper.pseudo"?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      const savedState = saveWorkspaceMock.mock.lastCall?.[0] as WorkspaceState;
      expect(Object.values(savedState.nodes).filter((node) => node.type === "document")).toHaveLength(2);
      expect(savedState.nodes["doc-helper"]).toBeUndefined();
      expect(savedState.nodes["doc-third"]).toBeDefined();
    });
  });

  it("drags a file into a folder", async () => {
    let workspace = createWorkspaceFixture();
    workspace = createFolder(workspace, {
      parentId: workspace.rootFolderId,
      name: "Archive",
      id: "folder-archive",
      now: "2026-03-15T00:02:00.000Z",
    });
    loadWorkspaceMock.mockResolvedValue(workspace);
    const { container } = render(<HomePage />);
    await screen.findByRole("textbox", { name: "Mock editor" });

    const fileRow = getExplorerRow("main.pseudo");
    const folderRow = getExplorerRow("Archive");

    mockRowRect(folderRow, 0, 40);
    const dataTransfer = createDataTransferMock();

    fireEvent.dragStart(fileRow, { dataTransfer });
    fireEvent.dragOver(folderRow, { dataTransfer, clientY: 20 });
    fireEvent.drop(folderRow, { dataTransfer, clientY: 20 });

    await waitFor(() => {
      const savedState = saveWorkspaceMock.mock.lastCall?.[0] as WorkspaceState;
      expect(savedState.nodes["doc-main"].parentId).toBe("folder-archive");
    });

    container.remove();
  });

  it("drags a folder into another folder", async () => {
    let workspace = createWorkspaceFixture();
    workspace = createFolder(workspace, {
      parentId: workspace.rootFolderId,
      name: "Source",
      id: "folder-source",
      now: "2026-03-15T00:02:00.000Z",
    });
    workspace = createFolder(workspace, {
      parentId: workspace.rootFolderId,
      name: "Target",
      id: "folder-target",
      now: "2026-03-15T00:03:00.000Z",
    });
    loadWorkspaceMock.mockResolvedValue(workspace);
    render(<HomePage />);
    await screen.findByRole("textbox", { name: "Mock editor" });

    const sourceRow = getExplorerRow("Source");
    const targetRow = getExplorerRow("Target");

    mockRowRect(targetRow, 0, 40);
    const dataTransfer = createDataTransferMock();

    fireEvent.dragStart(sourceRow, { dataTransfer });
    fireEvent.dragOver(targetRow, { dataTransfer, clientY: 20 });
    fireEvent.drop(targetRow, { dataTransfer, clientY: 20 });

    await waitFor(() => {
      const savedState = saveWorkspaceMock.mock.lastCall?.[0] as WorkspaceState;
      expect(savedState.nodes["folder-source"].parentId).toBe("folder-target");
    });
  });

  it("compiles and runs the active document and clears pending input on switch", async () => {
    const workspace = createWorkspaceFixture("doc-helper");
    loadWorkspaceMock.mockResolvedValue(workspace);
    compilePseudocodeMock.mockReturnValue({
      success: true,
      diagnostics: [],
      pythonCode: "print('hi')",
    });
    runMock.mockResolvedValue({
      success: false,
      stdout: "",
      stderr: "INPUT requested but no stdin lines remain",
      diagnostics: [],
      virtualFiles: {},
    });

    render(<HomePage />);
    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "Mock editor" })).toHaveValue('OUTPUT "Helper"');
    });

    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    expect(compilePseudocodeMock).toHaveBeenLastCalledWith({
      source: 'OUTPUT "Helper"',
      filename: "Helper.pseudo",
      strict: true,
    });

    expect(await screen.findByLabelText("Terminal input")).toBeInTheDocument();

    fireEvent.click(getExplorerButton("main.pseudo"));
    await waitFor(() => {
      expect(screen.queryByLabelText("Terminal input")).not.toBeInTheDocument();
    });
  });

  it("lets the terminal scroll region keep its position when the user scrolls away from the bottom", async () => {
    loadWorkspaceMock.mockResolvedValue(createWorkspaceFixture("doc-helper"));
    compilePseudocodeMock.mockReturnValue({
      success: true,
      diagnostics: [],
      pythonCode: "print('hi')",
    });
    runMock
      .mockResolvedValueOnce({
        success: false,
        stdout: "Line 1\nLine 2\nLine 3",
        stderr: "INPUT requested but no stdin lines remain",
        diagnostics: [],
        virtualFiles: {},
      })
      .mockResolvedValueOnce({
        success: true,
        stdout: "Line 1\nLine 2\nLine 3\nLine 4",
        stderr: "",
        diagnostics: [],
        virtualFiles: {},
      });

    render(<HomePage />);
    await screen.findByRole("textbox", { name: "Mock editor" });

    const scrollRegion = screen.getByTestId("terminal-scroll-region");
    let scrollTop = 0;

    Object.defineProperty(scrollRegion, "scrollHeight", {
      configurable: true,
      get: () => 400,
    });
    Object.defineProperty(scrollRegion, "clientHeight", {
      configurable: true,
      get: () => 100,
    });
    Object.defineProperty(scrollRegion, "scrollTop", {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value;
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    expect(await screen.findByLabelText("Terminal input")).toBeInTheDocument();
    await waitFor(() => {
      expect(scrollTop).toBe(400);
    });

    act(() => {
      scrollTop = 40;
      fireEvent.scroll(scrollRegion);
    });

    fireEvent.change(screen.getByLabelText("Terminal input"), {
      target: { value: "42" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(runMock).toHaveBeenCalledTimes(2);
      expect(screen.getByText(/\bLine 4\b/)).toBeInTheDocument();
    });

    expect(scrollTop).toBe(40);
  });

  it("warns before refresh only while workspace changes are pending save", async () => {
    loadWorkspaceMock.mockResolvedValue(createWorkspaceFixture());
    render(<HomePage />);

    const editor = await screen.findByRole("textbox", { name: "Mock editor" });

    vi.useFakeTimers();
    try {
      fireEvent.change(editor, { target: { value: 'OUTPUT "Changed"' } });

      const pendingEvent = new Event("beforeunload", { cancelable: true });
      Object.defineProperty(pendingEvent, "returnValue", {
        configurable: true,
        writable: true,
        value: "",
      });

      expect(window.dispatchEvent(pendingEvent)).toBe(false);
      expect(pendingEvent.defaultPrevented).toBe(true);

      await act(async () => {
        vi.advanceTimersByTime(5 * 60 * 1000);
        await Promise.resolve();
      });

      expect(saveWorkspaceMock).toHaveBeenCalled();

      const savedEvent = new Event("beforeunload", { cancelable: true });
      Object.defineProperty(savedEvent, "returnValue", {
        configurable: true,
        writable: true,
        value: "",
      });

      expect(window.dispatchEvent(savedEvent)).toBe(true);
      expect(savedEvent.defaultPrevented).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("lets the user set the autosave interval from settings", async () => {
    loadWorkspaceMock.mockResolvedValue(createWorkspaceFixture());
    render(<HomePage />);

    const editor = await screen.findByRole("textbox", { name: "Mock editor" });
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));

    const intervalInput = await screen.findByRole("combobox", {
      name: "Autosave interval minutes",
    });
    expect(intervalInput).toHaveValue("5");

    fireEvent.change(intervalInput, { target: { value: "1" } });
    expect(localStore.get("pseudocode-compiler-autosave-minutes")).toBe("1");

    vi.useFakeTimers();
    try {
      fireEvent.change(editor, { target: { value: 'OUTPUT "One minute"' } });

      await act(async () => {
        vi.advanceTimersByTime(59_999);
        await Promise.resolve();
      });
      expect(saveWorkspaceMock).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(1);
        await Promise.resolve();
      });
      expect(saveWorkspaceMock).toHaveBeenCalledWith(expect.anything(), { mode: "cloud" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not warn before refresh when the workspace is still empty", async () => {
    loadWorkspaceMock.mockResolvedValue(createEmptyWorkspace("2026-03-15T00:00:00.000Z"));
    render(<HomePage />);

    expect(await screen.findByText("Welcome to Pseudocode Compiler")).toBeInTheDocument();

    const event = new Event("beforeunload", { cancelable: true });
    Object.defineProperty(event, "returnValue", {
      configurable: true,
      writable: true,
      value: "",
    });

    expect(window.dispatchEvent(event)).toBe(true);
    expect(event.defaultPrevented).toBe(false);
  });

  it("shows Clerk sign-in controls and asks for sign-in before cloud saving", async () => {
    authState.user = null;
    loadWorkspaceMock.mockResolvedValue(createWorkspaceFixture());
    render(<HomePage />);

    await screen.findByRole("textbox", { name: "Mock editor" });
    expect(loadWorkspaceMock).toHaveBeenCalledWith(expect.any(String), { mode: "memory" });
    const signInButton = screen.getByRole("button", { name: "Log In" });
    expect(signInButton).toHaveClass("bg-[var(--accent)]", "text-white");
    expect(screen.queryByText(/Need an account/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save workspace" }));

    const dialog = await screen.findByRole("dialog", { name: "Sign in to save" });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Log In" })).toBeInTheDocument();
    expect(saveWorkspaceMock).not.toHaveBeenCalled();
  });

  it("saves locally in the desktop shell without showing browser sign-in controls", async () => {
    authState.user = null;
    setDesktopRuntime();
    loadWorkspaceMock.mockResolvedValue(createWorkspaceFixture());
    render(<HomePage />);

    await screen.findByRole("textbox", { name: "Mock editor" });
    expect(loadWorkspaceMock).toHaveBeenCalledWith(expect.any(String), { mode: "local" });
    expect(screen.queryByRole("button", { name: "Log In" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save workspace" }));

    await waitFor(() => {
      expect(saveWorkspaceMock).toHaveBeenCalledWith(expect.anything(), { mode: "local" });
    });
  });

  it("saves locally on localhost without showing browser sign-in controls", async () => {
    authState.user = null;
    setLocalBrowserRuntime();
    loadWorkspaceMock.mockResolvedValue(createWorkspaceFixture());
    render(<HomePage />);

    await screen.findByRole("textbox", { name: "Mock editor" });
    expect(loadWorkspaceMock).toHaveBeenCalledWith(expect.any(String), { mode: "local" });
    expect(screen.queryByRole("button", { name: "Log In" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save workspace" }));

    await waitFor(() => {
      expect(saveWorkspaceMock).toHaveBeenCalledWith(expect.anything(), { mode: "local" });
    });
  });

  it("saves the workspace to cloud when signed in", async () => {
    authState.user = {
      id: "user_123",
      email: "alex@example.com",
      firstName: "Alex",
      lastName: null,
    };
    loadWorkspaceMock.mockResolvedValue(createWorkspaceFixture());
    render(<HomePage />);

    await screen.findByRole("textbox", { name: "Mock editor" });
    fireEvent.click(screen.getByRole("button", { name: "Save workspace" }));

    await waitFor(() => {
      expect(saveWorkspaceMock).toHaveBeenCalledWith(expect.anything(), { mode: "cloud" });
    });

    expect(screen.getByRole("button", { name: "User profile" })).toBeInTheDocument();
  });
});
