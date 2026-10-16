const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("momoDesktop", {
  onPower: (callback) => {
    const listener = (_event, paused) => callback(!!paused);
    ipcRenderer.on("momo:power", listener);
    return () => ipcRenderer.removeListener("momo:power", listener);
  },
  openPet: () => ipcRenderer.invoke("momo:native", "openPet"),
  hidePet: () => ipcRenderer.invoke("momo:native", "hidePet"),
  openDashboard: () => ipcRenderer.invoke("momo:native", "dashboard"),
  setClickThrough: (value) =>
    ipcRenderer.invoke("momo:native", "clickThrough", !!value),
  setAlwaysOnTop: (value) =>
    ipcRenderer.invoke("momo:native", "alwaysOnTop", !!value),
  aiStatus: () => ipcRenderer.invoke("momo:native", "aiStatus"),
  aiSelect: () => ipcRenderer.invoke("momo:native", "aiSelect"),
  aiChat: (messages) => ipcRenderer.invoke("momo:native", "aiChat", messages),
  aiCancel: () => ipcRenderer.invoke("momo:native", "aiCancel"),
  aiUnload: () => ipcRenderer.invoke("momo:native", "aiUnload"),
  status: () => ipcRenderer.invoke("momo:native", "status"),
});
