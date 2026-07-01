const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("AGORA_DESKTOP", {
  platform: process.platform,
  shell: "electron"
});
