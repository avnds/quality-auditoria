const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("qualitySetup", {
  instalar: dados => ipcRenderer.invoke("quality:install", dados),
  reiniciar: () => ipcRenderer.invoke("quality:restart"),
});
