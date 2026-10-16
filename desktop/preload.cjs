const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("momoDesktop", {
  onAIBusy: (callback) => {
    const listener = (_event, busy) => callback(!!busy);
    ipcRenderer.on("momo:ai-busy", listener);
    return () => ipcRenderer.removeListener("momo:ai-busy", listener);
  },
  onNavigate: (callback) => {
    const listener = (_event, page) => callback(page);
    ipcRenderer.on("momo:navigate", listener);
    return () => ipcRenderer.removeListener("momo:navigate", listener);
  },
  onPower: (callback) => {
    const listener = (_event, paused) => callback(!!paused);
    ipcRenderer.on("momo:power", listener);
    return () => ipcRenderer.removeListener("momo:power", listener);
  },
  openPet: () => ipcRenderer.invoke("momo:native", "openPet"),
  hidePet: () => ipcRenderer.invoke("momo:native", "hidePet"),
  openDashboard: (page = 0) => ipcRenderer.invoke("momo:native", "dashboard", page),
  setAutoLaunch: value => ipcRenderer.invoke("momo:native", "autoLaunch", !!value),
  setStartupPet: value => ipcRenderer.invoke("momo:native", "startupPet", !!value),
  setClickThrough: (value) =>
    ipcRenderer.invoke("momo:native", "clickThrough", !!value),
  setAlwaysOnTop: (value) =>
    ipcRenderer.invoke("momo:native", "alwaysOnTop", !!value),
  aiStatus: () => ipcRenderer.invoke("momo:native", "aiStatus"),
  aiLoad: () => ipcRenderer.invoke("momo:native", "aiLoad"),
  aiSelect: () => ipcRenderer.invoke("momo:native", "aiSelect"),
  aiChat: (messages) => ipcRenderer.invoke("momo:native", "aiChat", messages),
  aiCancel: () => ipcRenderer.invoke("momo:native", "aiCancel"),
  aiUnload: () => ipcRenderer.invoke("momo:native", "aiUnload"),
  status: () => ipcRenderer.invoke("momo:native", "status"),
});
