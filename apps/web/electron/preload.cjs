const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  isDesktop: true,
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
