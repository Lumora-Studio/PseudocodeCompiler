import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultWorkspace, createDocument, createEmptyWorkspace, createFolder, getChildNodes, setActiveDocument, type WorkspaceState } from "@pseudocode-compiler/workspace";

const {
  loadWorkspaceMock,
  saveWorkspaceMock,
  loadWorkspaceSettingsMock,
  saveWorkspaceSettingsMock,
  compilePseudocodeMock,
  runMock,
  routerPushMock,
  getAuthMock,
  getAccessTokenMock,
  refreshAccessTokenMock,
  signOutMock,
  authState,
} = vi.hoisted(() => ({
  loadWorkspaceMock: vi.fn<() => Promise<WorkspaceState>>(),
  saveWorkspaceMock: vi.fn<(state: WorkspaceState) => Promise<void>>(),
  loadWorkspaceSettingsMock: vi.fn<() => Promise<{ autosaveIntervalMinutes: number }>>(),
  saveWorkspaceSettingsMock: vi.fn<(settings: { autosaveIntervalMinutes: number }) => Promise<void>>(),
  compilePseudocodeMock: vi.fn(),
  runMock: vi.fn(),
  routerPushMock: vi.fn(),
  getAuthMock: vi.fn<() => Promise<void>>(),
  getAccessTokenMock: vi.fn<() => Promise<string | null>>(),
  refreshAccessTokenMock: vi.fn<() => Promise<string | undefined>>(),
  signOutMock: vi.fn<() => Promise<void>>(),
  authState: {
    authAvailable: true,
    cloudSyncLoading: false,
    cloudSyncReady: true,
    user: {
      id: "user_test",
      email: "student@example.com",
      firstName: "Student",
    } as null | {
      id: string;
      email: string;
      firstName: string;
    },
    loading: false,
  },
}));
const localStore = new Map<string, string>();

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPushMock,
  }),
}));

vi.mock("@/lib/auth-runtime", () => ({
  AppAuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAppAuth: () => ({
    authAvailable: authState.authAvailable,
    cloudSyncLoading: authState.cloudSyncLoading,
    cloudSyncReady: authState.cloudSyncReady,
    user: authState.user,
    loading: authState.loading,
    getAuth: getAuthMock,
    signOut: signOutMock,
  }),
}));

vi.mock("@/lib/storage", () => ({
  DEFAULT_AUTOSAVE_INTERVAL_MINUTES: 5,
  loadWorkspace: loadWorkspaceMock,
  loadWorkspaceSettings: loadWorkspaceSettingsMock,
  saveWorkspace: saveWorkspaceMock,
  saveWorkspaceSettings: saveWorkspaceSettingsMock,
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

let HomePage: (typeof import("@/app/HomePageClient"))["default"];

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

function restoreProperty<T extends object>(
  target: T,
  key: keyof T,
  descriptor: PropertyDescriptor | undefined,
) {
  if (descriptor) {
    Object.defineProperty(target, key, descriptor);
    return;
  }

  delete (target as Record<PropertyKey, unknown>)[key];
}

function setTouchPhoneViewport() {
  const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(window.navigator, "platform");
  const originalUserAgentDescriptor = Object.getOwnPropertyDescriptor(window.navigator, "userAgent");
  const originalMaxTouchPointsDescriptor = Object.getOwnPropertyDescriptor(window.navigator, "maxTouchPoints");
  const originalInnerWidthDescriptor = Object.getOwnPropertyDescriptor(window, "innerWidth");
  const originalInnerHeightDescriptor = Object.getOwnPropertyDescriptor(window, "innerHeight");

  Object.defineProperty(window.navigator, "platform", {
    configurable: true,
    value: "iPhone",
  });
  Object.defineProperty(window.navigator, "userAgent", {
    configurable: true,
    value: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
  });
  Object.defineProperty(window.navigator, "maxTouchPoints", {
    configurable: true,
    value: 5,
  });
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 390,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: 844,
  });

  return () => {
    restoreProperty(window.navigator, "platform", originalPlatformDescriptor);
    restoreProperty(window.navigator, "userAgent", originalUserAgentDescriptor);
    restoreProperty(window.navigator, "maxTouchPoints", originalMaxTouchPointsDescriptor);
    restoreProperty(window, "innerWidth", originalInnerWidthDescriptor);
    restoreProperty(window, "innerHeight", originalInnerHeightDescriptor);
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

function getSaveButton(): HTMLElement {
  return screen.getByRole("button", { name: "Save workspace" });
}

function getAccountMenuButton(name = "Student"): HTMLElement {
  return screen.getByRole("button", { name: `Open account menu for ${name}` });
}

async function longPressExplorerRow(row: HTMLElement) {
  vi.useFakeTimers();
  try {
    fireEvent.pointerDown(row, {
      pointerType: "touch",
      pointerId: 1,
      clientX: 96,
      clientY: 148,
    });

    await act(async () => {
      vi.advanceTimersByTime(430);
    });

    fireEvent.pointerUp(row, {
      pointerType: "touch",
      pointerId: 1,
      clientX: 96,
      clientY: 148,
    });
  } finally {
    vi.useRealTimers();
  }
}

describe("HomePage workspace flow", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(async () => {
    vi.resetModules();
    loadWorkspaceMock.mockReset();
    saveWorkspaceMock.mockReset();
    loadWorkspaceSettingsMock.mockReset();
    saveWorkspaceSettingsMock.mockReset();
    getAccessTokenMock.mockReset();
    refreshAccessTokenMock.mockReset();
    compilePseudocodeMock.mockReset();
    runMock.mockReset();
    routerPushMock.mockReset();
    getAuthMock.mockReset();
    signOutMock.mockReset();
    authState.authAvailable = true;
    authState.cloudSyncLoading = false;
    authState.cloudSyncReady = true;
    authState.user = {
      id: "user_test",
      email: "student@example.com",
      firstName: "Student",
    };
    authState.loading = false;
    getAccessTokenMock.mockResolvedValue("token");
    refreshAccessTokenMock.mockResolvedValue("token");
    loadWorkspaceSettingsMock.mockResolvedValue({ autosaveIntervalMinutes: 5 });
    saveWorkspaceSettingsMock.mockResolvedValue();
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
    HomePage = (await import("@/app/HomePageClient")).default;
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

  it("saves the current workspace with Command/Ctrl+S", async () => {
    loadWorkspaceMock.mockResolvedValue(createWorkspaceFixture());
    render(<HomePage />);

    const editor = await screen.findByRole("textbox", { name: "Mock editor" });
    fireEvent.change(editor, { target: { value: 'OUTPUT "Saved from shortcut"' } });
    fireEvent.keyDown(window, { key: "s", ctrlKey: true });

    await waitFor(() => {
      expect(saveWorkspaceMock).toHaveBeenCalled();
    });

    const savedState = saveWorkspaceMock.mock.lastCall?.[0] as WorkspaceState;
    expect(savedState.nodes["doc-main"]).toMatchObject({
      source: 'OUTPUT "Saved from shortcut"',
    });
  });

  it("loads guest sessions anonymously and asks WorkOS to sign in before saving", async () => {
    authState.user = null;
    loadWorkspaceMock.mockResolvedValue(createWorkspaceFixture());
    render(<HomePage />);

    await screen.findByRole("textbox", { name: "Mock editor" });

    const guestLoadWorkspaceCall =
      loadWorkspaceMock.mock.calls[0] as unknown as [string, unknown] | undefined;
    const guestLoadSettingsCall =
      loadWorkspaceSettingsMock.mock.calls[0] as unknown as [unknown] | undefined;

    expect(guestLoadWorkspaceCall?.[1]).toEqual({ kind: "anonymous" });
    expect(guestLoadSettingsCall?.[0]).toEqual({ kind: "anonymous" });
    expect(screen.getByText("Signed Out")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "Mock editor" }), {
      target: { value: 'OUTPUT "Guest"' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in to save workspace" }));

    const dialog = screen.getByRole("dialog", { name: "Save your workspace" });
    expect(within(dialog).getByRole("button", { name: "Sign In" })).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Need an account? Create one here." }),
    ).toBeInTheDocument();
    expect(getAuthMock).not.toHaveBeenCalled();
    expect(saveWorkspaceMock).not.toHaveBeenCalled();
  });

  it("uses local persistence for the desktop shell without requiring sign-in", async () => {
    authState.authAvailable = false;
    authState.user = null;
    loadWorkspaceMock.mockResolvedValue(createWorkspaceFixture());
    render(<HomePage />);

    await screen.findByRole("textbox", { name: "Mock editor" });

    const localLoadWorkspaceCall =
      loadWorkspaceMock.mock.calls[0] as unknown as [string, unknown] | undefined;
    const localLoadSettingsCall =
      loadWorkspaceSettingsMock.mock.calls[0] as unknown as [unknown] | undefined;

    expect(localLoadWorkspaceCall?.[1]).toEqual({
      kind: "local",
      storageKey: "desktop-local",
    });
    expect(localLoadSettingsCall?.[0]).toEqual({
      kind: "local",
      storageKey: "desktop-local",
    });
    expect(screen.getByText("Local workspace")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(
      screen.getByText(/No account setup or internet connection is required/i),
    ).toBeInTheDocument();
  });

  it("skips the browser beforeunload prompt for the desktop shell close flow", async () => {
    const desktopWindow = window as Window & { electron?: { isDesktop?: boolean } };
    const originalElectronDescriptor = Object.getOwnPropertyDescriptor(desktopWindow, "electron");

    Object.defineProperty(desktopWindow, "electron", {
      configurable: true,
      value: { isDesktop: true },
    });

    authState.authAvailable = false;
    authState.user = null;
    loadWorkspaceMock.mockResolvedValue(createWorkspaceFixture());

    try {
      render(<HomePage />);

      const editor = await screen.findByRole("textbox", { name: "Mock editor" });
      fireEvent.change(editor, { target: { value: 'OUTPUT "Desktop unsaved"' } });

      await waitFor(() => {
        const beforeUnloadEvent = new Event("beforeunload", { cancelable: true });
        const dispatchResult = window.dispatchEvent(beforeUnloadEvent);

        expect(dispatchResult).toBe(true);
        expect(beforeUnloadEvent.defaultPrevented).toBe(false);
      });
    } finally {
      restoreProperty(desktopWindow, "electron", originalElectronDescriptor);
    }
  });

  it("keeps the browser beforeunload prompt for unsaved web sessions", async () => {
    authState.authAvailable = false;
    authState.user = null;
    loadWorkspaceMock.mockResolvedValue(createWorkspaceFixture());
    render(<HomePage />);

    const editor = await screen.findByRole("textbox", { name: "Mock editor" });
    fireEvent.change(editor, { target: { value: 'OUTPUT "Browser unsaved"' } });

    await waitFor(() => {
      const beforeUnloadEvent = new Event("beforeunload", { cancelable: true });
      const dispatchResult = window.dispatchEvent(beforeUnloadEvent);

      expect(dispatchResult).toBe(false);
      expect(beforeUnloadEvent.defaultPrevented).toBe(true);
    });
  });

  it("shows signed-in status and exposes settings and log out from the account menu", async () => {
    loadWorkspaceMock.mockResolvedValue(createWorkspaceFixture());
    render(<HomePage />);

    await screen.findByRole("textbox", { name: "Mock editor" });

    expect(screen.getByText("Signed In")).toBeInTheDocument();
    expect(screen.getByText("Student")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Settings" })).not.toBeInTheDocument();

    fireEvent.click(getAccountMenuButton());

    expect(screen.getByRole("menuitem", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Log Out" })).toBeInTheDocument();
  });

  it("shows a finishing-sign-in state while cloud save is connecting", async () => {
    authState.cloudSyncLoading = true;
    authState.cloudSyncReady = false;
    loadWorkspaceMock.mockResolvedValue(createWorkspaceFixture());
    render(<HomePage />);

    await screen.findByRole("textbox", { name: "Mock editor" });

    expect(screen.getByText("Finishing Sign In")).toBeInTheDocument();
    expect(screen.getByText("Student")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connecting cloud workspace" })).toBeDisabled();
    expect(screen.getByText("Connecting…")).toBeInTheDocument();
  });

  it("hides the starter panel while a signed-in workspace is still connecting", async () => {
    authState.cloudSyncLoading = true;
    authState.cloudSyncReady = false;
    loadWorkspaceMock.mockResolvedValue(createEmptyWorkspace("2026-03-15T00:00:00.000Z"));
    render(<HomePage />);

    expect(
      await screen.findByText(
        "You are signed in. Waiting for cloud sync to finish before showing your files and folders.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Create your first file.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create File" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Create Folder" })).toBeDisabled();
  });

  it("keeps the settings dialog scrollable when its content exceeds the viewport", async () => {
    loadWorkspaceMock.mockResolvedValue(createWorkspaceFixture());
    render(<HomePage />);

    await screen.findByRole("textbox", { name: "Mock editor" });

    fireEvent.click(getAccountMenuButton());
    fireEvent.click(screen.getByRole("menuitem", { name: "Settings" }));

    const dialog = screen.getByRole("dialog", { name: "Workspace" });
    const scrollRegion = within(dialog).getByTestId("settings-dialog-scroll-region");

    expect(dialog.className).toContain("max-h-[calc(100dvh-2rem)]");
    expect(scrollRegion.className).toContain("overflow-y-auto");
    expect(scrollRegion.className).toContain("min-h-0");
  });

  it("autosaves after the selected interval", async () => {
    const realSetTimeout = window.setTimeout.bind(window);
    const setTimeoutSpy = vi
      .spyOn(window, "setTimeout")
      .mockImplementation(((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
        if (timeout === 60_000 && typeof handler === "function") {
          queueMicrotask(() => handler(...args));
          return 1;
        }

        return realSetTimeout(handler, timeout, ...(args as []));
      }) as typeof window.setTimeout);

    try {
      loadWorkspaceMock.mockResolvedValue(createWorkspaceFixture());
      render(<HomePage />);

      const editor = await screen.findByRole("textbox", { name: "Mock editor" });
      fireEvent.click(getAccountMenuButton());
      fireEvent.click(screen.getByRole("menuitem", { name: "Settings" }));

      await act(async () => {
        fireEvent.change(screen.getByLabelText("Autosave interval"), {
          target: { value: "1" },
        });
        await Promise.resolve();
      });

      expect(saveWorkspaceSettingsMock).toHaveBeenCalledWith(
        {
          autosaveIntervalMinutes: 1,
        },
        {
          kind: "authenticated",
          userId: "user_test",
        },
      );

      await act(async () => {
        fireEvent.change(editor, { target: { value: 'OUTPUT "Autosaved"' } });
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(saveWorkspaceMock).toHaveBeenCalled();
      });

      const savedState = saveWorkspaceMock.mock.lastCall?.[0] as WorkspaceState;
      expect(savedState.nodes["doc-main"]).toMatchObject({
        source: 'OUTPUT "Autosaved"',
      });
    } finally {
      setTimeoutSpy.mockRestore();
    }
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
    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Rename Item" })).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText("Item name"), { target: { value: "Renamed Doc" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Name" }));
    await waitFor(() => {
      expect(getExplorerButton("Renamed Doc.pseudo")).toBeInTheDocument();
    });
    fireEvent.click(getSaveButton());
    expect(saveWorkspaceMock).toHaveBeenCalled();
  });

  it("creates the first file from the starter panel and opens the editor", async () => {
    loadWorkspaceMock.mockResolvedValue(createEmptyWorkspace("2026-03-15T00:00:00.000Z"));
    render(<HomePage />);

    expect(await screen.findByText("Create your first file.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create First File" }));

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "Mock editor" })).toHaveValue("");
    });
  });

  it("reorders documents through workspace controls", async () => {
    loadWorkspaceMock.mockResolvedValue(createWorkspaceFixture());
    render(<HomePage />);
    await screen.findByRole("textbox", { name: "Mock editor" });

    fireEvent.contextMenu(getExplorerButton("Helper.pseudo"));
    fireEvent.click(await screen.findByRole("button", { name: "Move Up" }));
    fireEvent.click(getSaveButton());

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

    await longPressExplorerRow(helperRow);

    expect(screen.getByRole("menu", { name: "Explorer actions" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rename" })).toBeInTheDocument();
  });

  it("renames from the touch long-press explorer menu", async () => {
    loadWorkspaceMock.mockResolvedValue(createWorkspaceFixture());
    render(<HomePage />);
    await screen.findByRole("textbox", { name: "Mock editor" });

    await longPressExplorerRow(getExplorerRow("Helper.pseudo"));
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Rename Item" })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Item name"), { target: { value: "Renamed Helper" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Name" }));

    await waitFor(() => {
      expect(getExplorerButton("Renamed Helper.pseudo")).toBeInTheDocument();
    });
  });

  it("creates a file inside a folder from the touch long-press explorer menu", async () => {
    let workspace = createWorkspaceFixture();
    workspace = createFolder(workspace, {
      parentId: workspace.rootFolderId,
      name: "Archive",
      id: "folder-archive",
      now: "2026-03-15T00:02:00.000Z",
    });
    loadWorkspaceMock.mockResolvedValue(workspace);
    render(<HomePage />);
    await screen.findByRole("textbox", { name: "Mock editor" });

    await longPressExplorerRow(getExplorerRow("Archive"));
    fireEvent.click(screen.getByRole("button", { name: "New File Here" }));

    await waitFor(() => {
      fireEvent.click(getSaveButton());
      const savedState = saveWorkspaceMock.mock.lastCall?.[0] as WorkspaceState;
      const createdDocument = Object.values(savedState.nodes).find(
        (node) => node.type === "document" && node.parentId === "folder-archive" && node.name === "Untitled.pseudo",
      );
      expect(createdDocument).toBeDefined();
    });
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
    fireEvent.click(getSaveButton());

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
    fireEvent.click(getSaveButton());

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
    fireEvent.click(getSaveButton());

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

  it("keeps the desktop browser shell on touch devices and opens the manual without leaving the workspace", async () => {
    const restoreTouchPhoneViewport = setTouchPhoneViewport();
    authState.user = null;
    loadWorkspaceMock.mockResolvedValue(createWorkspaceFixture());

    try {
      render(<HomePage />);
      await screen.findByRole("textbox", { name: "Mock editor" });

      expect(screen.queryByTestId("touch-auth-status")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "SETTINGS" })).not.toBeInTheDocument();
      expect(screen.getByTestId("terminal-scroll-region")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Create Folder" })).toBeInTheDocument();

      const manualButton = screen.getByRole("button", { name: "Manual" });
      expect(manualButton.querySelector("svg")).not.toBeNull();

      fireEvent.click(manualButton);
      expect(routerPushMock).not.toHaveBeenCalled();
      expect(
        await screen.findByText("Detailed Pseudocode Compiler Guidelines"),
      ).toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: "Mock editor" })).toBeInTheDocument();
    } finally {
      restoreTouchPhoneViewport();
    }
  });
});
