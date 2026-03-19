const { app, BrowserWindow, shell } = require("electron");
const http = require("http");
const path = require("path");
const fs = require("fs");
const serveHandler = require("serve-handler");

const isDev = !app.isPackaged;
const shouldOpenDevTools = process.env.ELECTRON_OPEN_DEVTOOLS === "1";
const devToolsMode = process.env.ELECTRON_DEVTOOLS_MODE || "detach";
let staticServer;
let staticPort;

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
    staticServer.listen(0, "127.0.0.1", () => {
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

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
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
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (staticServer) {
    staticServer.close();
  }
});
