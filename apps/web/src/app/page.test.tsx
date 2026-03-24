import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultWorkspace, createDocument, createEmptyWorkspace, createFolder, getChildNodes, setActiveDocument, type WorkspaceState } from "@igcse/workspace";

const { loadWorkspaceMock, saveWorkspaceMock, compilePseudocodeMock, runMock, routerPushMock } = vi.hoisted(() => ({
  loadWorkspaceMock: vi.fn<() => Promise<WorkspaceState>>(),
  saveWorkspaceMock: vi.fn<(state: WorkspaceState) => Promise<void>>(),
  compilePseudocodeMock: vi.fn(),
  runMock: vi.fn(),
  routerPushMock: vi.fn(),
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

describe("HomePage workspace flow", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    loadWorkspaceMock.mockReset();
    saveWorkspaceMock.mockReset();
    compilePseudocodeMock.mockReset();
    runMock.mockReset();
    routerPushMock.mockReset();
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
});
