const {
  app,
  BrowserWindow,
  ipcMain,
  protocol,
  net,
  Tray,
  Menu,
  nativeImage,
  screen,
  dialog,
  powerMonitor,
} = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const fs = require("node:fs");
const { LocalAI } = require("./ai.cjs");
const ai = new LocalAI(path.resolve(__dirname, ".."));
const root = path.resolve(__dirname, "../dist");
let dashboard,
  pet,
  tray,
  passThrough = false;
protocol.registerSchemesAsPrivileged([
  {
    scheme: "momo",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);
const profile = process.env.MOMO_PROFILE_DIR;
if (profile) app.setPath("userData", path.resolve(profile));
ai.logFile = path.join(app.getPath("userData"), "MOMO-ai-diagnostic.log");
const desktopSettingsFile = path.join(app.getPath("userData"), "desktop-settings.json");
let desktopSettings = { startupPet: true };
try {
  const saved = JSON.parse(fs.readFileSync(desktopSettingsFile, "utf8"));
  if (typeof saved.startupPet === "boolean") desktopSettings.startupPet = saved.startupPet;
} catch {}
function saveDesktopSettings() {
  fs.mkdirSync(path.dirname(desktopSettingsFile), {recursive:true});
  fs.writeFileSync(desktopSettingsFile, JSON.stringify(desktopSettings), "utf8");
}
const lock = app.requestSingleInstanceLock();
if (!lock) app.quit();
function secureWindow(win) {
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("momo://app/")) event.preventDefault();
  });
  win.webContents.on("will-attach-webview", (event) => event.preventDefault());
}
function makeWindow(options) {
  const win = new BrowserWindow({
    ...options,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  secureWindow(win);
  return win;
}
function openDashboard(page = 0) {
  page = Number.isInteger(page) && page >= 0 && page <= 4 ? page : 0;
  if (dashboard && !dashboard.isDestroyed()) {
    dashboard.show();
    dashboard.focus();
    dashboard.webContents.send("momo:navigate", page);
    return;
  }
  dashboard = makeWindow({
    width: 1180,
    height: 850,
    minWidth: 360,
    minHeight: 600,
    title: "MOMO · 你的数字小伙伴",
    backgroundColor: "#f7f7fa",
    autoHideMenuBar: true,
    show: false,
    icon: path.join(root, "icon-192.png"),
  });
  dashboard.loadURL(`momo://app/?page=${page}`);
  dashboard.once("ready-to-show", () => dashboard.show());
  dashboard.on("hide", () => ai.cancel());
  dashboard.on("minimize", () => ai.cancel());
  dashboard.on("closed", () => {
    ai.cancel();
    dashboard = null;
  });
}
function openPet() {
  if (pet && !pet.isDestroyed()) {
    pet.show();
    return;
  }
  const area = screen.getPrimaryDisplay().workArea;
  pet = makeWindow({
    width: 360,
    height: 450,
    x: area.x + area.width - 380,
    y: area.y + area.height - 470,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    title: "MOMO 桌面伙伴",
    hasShadow: false,
  });
  pet.loadURL("momo://app/?pet=1");
  pet.once("ready-to-show", () => pet.show());
  pet.on("closed", () => {
    pet = null;
    passThrough = false;
  });
}
async function runAI(action) {
  const broadcast = busy => {
    for (const win of [dashboard, pet])
      if (win && !win.isDestroyed()) win.webContents.send("momo:ai-busy", busy);
  };
  broadcast(true);
  try { return await action(); }
  finally { broadcast(ai.busy); }
}
function setPassThrough(value) {
  passThrough = !!value;
  if (pet && !pet.isDestroyed())
    pet.setIgnoreMouseEvents(passThrough, { forward: true });
  return passThrough;
}
app.on("second-instance", () => openDashboard());
app
  .whenReady()
  .then(async () => {
    protocol.handle("momo", (request) => {
      const url = new URL(request.url);
      if (url.hostname !== "app")
        return new Response("Not found", { status: 404 });
      let relative;
      try {
        relative = decodeURIComponent(url.pathname);
      } catch {
        return new Response("Invalid URL", { status: 400 });
      }
      const file = path.resolve(
        root,
        "." + (relative === "/" ? "/index.html" : relative),
      );
      if (!file.startsWith(root + path.sep))
        return new Response("Forbidden", { status: 403 });
      if (!fs.existsSync(file) || !fs.statSync(file).isFile())
        return new Response("Not found", { status: 404 });
      return net.fetch(pathToFileURL(file).toString());
    });
    ipcMain.handle("momo:native", async (event, action, value) => {
      if (
        ![dashboard, pet].some(
          (win) =>
            win && !win.isDestroyed() && win.webContents === event.sender,
        )
      )
        throw Error("Unknown window");
      switch (action) {
        case "openPet":
          openPet();
          return true;
        case "hidePet":
          pet?.hide();
          return true;
        case "dashboard":
          openDashboard(value);
          return true;
        case "clickThrough":
          return setPassThrough(value);
        case "alwaysOnTop":
          pet?.setAlwaysOnTop(!!value);
          return !!value;
        case "autoLaunch": {
          if (!app.isPackaged || !["win32", "darwin"].includes(process.platform))
            throw Error("开机自启仅支持打包后的 Windows / macOS 电脑版");
          app.setLoginItemSettings({openAtLogin:!!value,path:process.execPath,args:[]});
          return app.getLoginItemSettings({path:process.execPath,args:[]}).openAtLogin;
        }
        case "startupPet":
          desktopSettings.startupPet = !!value;
          saveDesktopSettings();
          return desktopSettings.startupPet;
        case "aiStatus":
          return ai.status();
        case "aiLoad":
          return runAI(() => ai.load());
        case "aiSelect": {
          const result = await dialog.showOpenDialog({
            properties: ["openFile"],
            filters: [{ name: "GGUF model", extensions: ["gguf"] }],
          });
          if (!result.canceled) ai.select(result.filePaths[0]);
          return ai.status();
        }
        case "aiChat": {
          if (
            !Array.isArray(value) ||
            value.length > 8 ||
            value.some(
              (m) =>
                !["system", "user", "assistant"].includes(m.role) ||
                typeof m.content !== "string" ||
                m.content.length > 4000,
            )
          )
            throw Error("Invalid messages");
          return runAI(() => ai.chat(value));
        }
        case "aiCancel":
          ai.cancel();
          return true;
        case "aiUnload":
          ai.cancel();
          return true;
        case "status":
          return {
            platform: process.platform,
            petVisible: !!pet?.isVisible(),
            startupPet: desktopSettings.startupPet,
            autoLaunchAvailable: app.isPackaged && ["win32", "darwin"].includes(process.platform),
            autoLaunch: app.isPackaged && ["win32", "darwin"].includes(process.platform)
              ? app.getLoginItemSettings({path:process.execPath,args:[]}).openAtLogin : false,
            clickThrough: passThrough,
          };
        default:
          throw Error("Unsupported action");
      }
    });
    if (!process.argv.includes("--momo-smoke") && !process.argv.includes("--momo-no-tray")) {
      tray = new Tray(
        nativeImage
          .createFromPath(path.join(root, "icon-192.png"))
          .resize({ width: 20, height: 20 }),
      );
      tray.setToolTip("MOMO · 桌面伙伴");
      tray.setContextMenu(
        Menu.buildFromTemplate([
          { label: "打开控制面板", click: () => openDashboard() },
          { label: "显示桌面宠物", click: openPet },
          { label: "恢复宠物鼠标交互", click: () => setPassThrough(false) },
          { type: "separator" },
          { label: "退出 MOMO", click: () => app.quit() },
        ]),
      );
      tray.on("double-click", () => openDashboard());
    }
    if (process.argv.includes("--momo-smoke") || !desktopSettings.startupPet) openDashboard();
    else openPet();
  })
  .catch((error) => {
    dialog.showErrorBox("MOMO 启动失败", error.message);
    app.quit();
  });
app.on("window-all-closed", () => {
  if (!tray) app.quit();
});
app.on("activate", () => openDashboard());

app.on("before-quit", () => ai.cancel());

app.whenReady().then(() => {
  for (const name of ["suspend", "lock-screen"])
    powerMonitor.on(name, () => {
      ai.cancel();
      for (const win of [dashboard, pet])
        if (win && !win.isDestroyed()) win.webContents.send("momo:power", true);
    });
  for (const name of ["resume", "unlock-screen"])
    powerMonitor.on(name, () => {
      for (const win of [dashboard, pet])
        if (win && !win.isDestroyed())
          win.webContents.send("momo:power", false);
    });
});
