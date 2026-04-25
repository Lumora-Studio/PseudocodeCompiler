const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  isDesktop: true,
  loadLocalWorkspace(storageKey) {
    return ipcRenderer.invoke("app:load-local-workspace", {
      storageKey,
    });
  },
  saveLocalWorkspace(storageKey, workspace) {
    return ipcRenderer.invoke("app:save-local-workspace", {
      storageKey,
      workspace,
    });
  },
  loadLocalWorkspaceSettings(storageKey) {
    return ipcRenderer.invoke("app:load-local-workspace-settings", {
      storageKey,
    });
  },
  saveLocalWorkspaceSettings(storageKey, settings) {
    return ipcRenderer.invoke("app:save-local-workspace-settings", {
      storageKey,
      settings,
    });
  },
  onSaveRequested(listener) {
    if (typeof listener !== "function") {
      return () => {};
    }

    const handler = async (_event, request) => {
      try {
        const success = await listener(request ?? {});
        ipcRenderer.send("app:save-response", {
          requestId: request?.requestId,
          success: Boolean(success),
        });
      } catch {
        ipcRenderer.send("app:save-response", {
          requestId: request?.requestId,
          success: false,
        });
      }
    };

    ipcRenderer.on("app:request-save", handler);
    return () => {
      ipcRenderer.removeListener("app:request-save", handler);
    };
  },
  setDirtyState(dirty) {
    ipcRenderer.send("app:update-save-state", {
      dirty: Boolean(dirty),
    });
  },
});
