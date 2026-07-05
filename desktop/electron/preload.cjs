const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("AGORA_DESKTOP", {
  platform: process.platform,
  shell: "electron",
  offlineCapable: true,
  storage: "local-device",
  secureSession: {
    available: () => ipcRenderer.invoke("agora-secure-session:available"),
    load: () => ipcRenderer.invoke("agora-secure-session:load"),
    save: (value) => ipcRenderer.invoke("agora-secure-session:save", String(value || "")),
    clear: () => ipcRenderer.invoke("agora-secure-session:clear")
  }
});
