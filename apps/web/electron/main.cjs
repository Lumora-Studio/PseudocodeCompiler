const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require("electron");
const http = require("http");
const path = require("path");
const fs = require("fs");
const serveHandler = require("serve-handler");
const fsp = fs.promises;

const isDev = !app.isPackaged;
const shouldOpenDevTools = process.env.ELECTRON_OPEN_DEVTOOLS === "1";
const devToolsMode = process.env.ELECTRON_DEVTOOLS_MODE || "detach";
const preferredStaticPort = Number(process.env.PSEUDOCODE_COMPILER_STATIC_PORT || "32123");
let staticServer;
let staticPort;
let nextSaveRequestId = 1;

const rendererSaveState = new Map();
const pendingSaveRequests = new Map();
const allowCloseWindows = new WeakSet();

function sanitizeStorageKey(storageKey) {
  if (typeof storageKey !== "string" || storageKey.trim().length === 0) {
    return "local-device";
  }

  return storageKey.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function getDesktopPersistenceDirectory(storageKey) {
  return path.join(app.getPath("userData"), "local-workspace", sanitizeStorageKey(storageKey));
}

function getDesktopWorkspaceFilePath(storageKey) {
  return path.join(getDesktopPersistenceDirectory(storageKey), "workspace.json");
}

function getDesktopSettingsFilePath(storageKey) {
  return path.join(getDesktopPersistenceDirectory(storageKey), "settings.json");
}

async function readDesktopPersistence(filePath) {
  try {
    const raw = await fsp.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function writeDesktopPersistence(filePath, value) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

function completePendingSaveRequest(requestId, success) {
  const pending = pendingSaveRequests.get(requestId);
  if (!pending) {
    return;
  }

  clearTimeout(pending.timeoutId);
  pendingSaveRequests.delete(requestId);
  pending.resolve(Boolean(success));
}

function requestRendererSave(win, reason = "manual") {
  if (!win || win.isDestroyed()) {
    return Promise.resolve(false);
  }

  const requestId = nextSaveRequestId;
  nextSaveRequestId += 1;

  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      pendingSaveRequests.delete(requestId);
      resolve(false);
    }, 15000);

    pendingSaveRequests.set(requestId, {
      resolve,
      timeoutId,
      webContentsId: win.webContents.id,
    });

    win.webContents.send("app:request-save", {
      requestId,
      reason,
    });
  });
}

async function confirmWindowClose(win) {
  const saveState = rendererSaveState.get(win.webContents.id);
  if (!saveState?.dirty) {
    return true;
  }

  const { response } = await dialog.showMessageBox(win, {
    type: "question",
    buttons: ["Save", "Don't Save", "Cancel"],
    defaultId: 0,
    cancelId: 2,
    title: "Save before quitting?",
    message: "Do you want to save files and folders before quitting?",
    detail: "Unsaved changes in this workspace will be lost if you quit without saving.",
  });

  if (response === 2) {
    return false;
  }

  if (response === 1) {
    return true;
  }

  const saved = await requestRendererSave(win, "close");
  if (saved) {
    return true;
  }

  await dialog.showMessageBox(win, {
    type: "error",
    buttons: ["OK"],
    defaultId: 0,
    title: "Save failed",
    message: "The workspace could not be saved.",
    detail: "The window will stay open so you can try saving again.",
  });
  return false;
}

function buildAppMenu() {
  const template = [];

  if (process.platform === "darwin") {
    template.push({
      label: app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    });
  }

  template.push({
    label: "File",
    submenu: [
      {
        label: "Save",
        accelerator: "CommandOrControl+S",
        click: () => {
          const focusedWindow = BrowserWindow.getFocusedWindow();
          if (focusedWindow) {
            void requestRendererSave(focusedWindow, "manual");
          }
        },
      },
      { type: "separator" },
      process.platform === "darwin" ? { role: "close" } : { role: "quit" },
    ],
  });

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function startStaticServer() {
  const staticPath = path.join(__dirname, "..", "out");

  staticServer = http.createServer((request, response) =>
    serveHandler(request, response, {
      public: staticPath,
      cleanUrls: true,
    }),
  );

  await new Promise((resolve, reject) => {
    staticServer.once("error", reject);
    staticServer.listen(preferredStaticPort, "127.0.0.1", () => {
      const address = staticServer.address();
      if (!address || typeof address === "string") {
        reject(new Error("Unable to start static server."));
        return;
      }

      staticPort = address.port;
      resolve();
    });
  });
}

async function createWindow() {
  const windowIconPath = path.join(__dirname, "assets", "icon.png");
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    autoHideMenuBar: true,
    icon: windowIconPath,
    backgroundColor: "#111111",
    titleBarStyle: process.platform === "darwin" ? "hidden" : "default",
    ...(process.platform === "darwin"
      ? {
          trafficLightPosition: {
            x: 16,
            y: 20,
          },
        }
      : {}),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  const webContentsId = win.webContents.id;

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  win.on("close", (event) => {
    if (allowCloseWindows.has(win)) {
      return;
    }

    event.preventDefault();
    void (async () => {
      const shouldClose = await confirmWindowClose(win);
      if (!shouldClose) {
        return;
      }

      allowCloseWindows.add(win);
      win.close();
    })();
  });

  win.on("closed", () => {
    rendererSaveState.delete(webContentsId);

    for (const [requestId, pending] of pendingSaveRequests.entries()) {
      if (pending.webContentsId === webContentsId) {
        completePendingSaveRequest(requestId, false);
      }
    }
  });

  if (isDev) {
    const devUrl = process.env.ELECTRON_START_URL || "http://localhost:3000";
    await win.loadURL(devUrl);
    if (shouldOpenDevTools) {
      win.webContents.openDevTools({ mode: devToolsMode });
    }
    return;
  }

  await startStaticServer();
  await win.loadURL(`http://127.0.0.1:${staticPort}`);
}

app.whenReady().then(() => {
  const dockIconPath = path.join(__dirname, "assets", "icon.png");
  if (isDev && process.platform === "darwin" && fs.existsSync(dockIconPath)) {
    app.dock.setIcon(dockIconPath);
  }

  buildAppMenu();

  createWindow().catch((error) => {
    console.error("Failed to create window:", error);
    app.quit();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow().catch((error) => {
        console.error("Failed to re-create window:", error);
      });
    }
  });
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("before-quit", () => {
  if (staticServer) {
    staticServer.close();
  }
});

ipcMain.on("app:update-save-state", (event, payload) => {
  rendererSaveState.set(event.sender.id, {
    dirty: Boolean(payload?.dirty),
  });
});

ipcMain.on("app:save-response", (event, payload) => {
  const requestId = payload?.requestId;
  const pending = pendingSaveRequests.get(requestId);
  if (!pending || pending.webContentsId !== event.sender.id) {
    return;
  }

  completePendingSaveRequest(requestId, payload?.success);
});

ipcMain.handle("app:load-local-workspace", async (_event, payload) => {
  return readDesktopPersistence(getDesktopWorkspaceFilePath(payload?.storageKey));
});

ipcMain.handle("app:save-local-workspace", async (_event, payload) => {
  await writeDesktopPersistence(
    getDesktopWorkspaceFilePath(payload?.storageKey),
    payload?.workspace ?? null,
  );
});

ipcMain.handle("app:load-local-workspace-settings", async (_event, payload) => {
  return readDesktopPersistence(getDesktopSettingsFilePath(payload?.storageKey));
});

ipcMain.handle("app:save-local-workspace-settings", async (_event, payload) => {
  await writeDesktopPersistence(
    getDesktopSettingsFilePath(payload?.storageKey),
    payload?.settings ?? null,
  );
});
