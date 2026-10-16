import { isAndroid, Native } from "./local-ai.js";
import "./native.css";
export function initNativeUI() {
  if (new URLSearchParams(location.search).get("pet") === "1")
    document.body.classList.add("native-pet", "companion-mode");
  if (isAndroid() && new URLSearchParams(location.search).get("pet") !== "1") {
    const panel = document.createElement("article");
    panel.className = "extended-settings";
    panel.innerHTML =
      '<h2>安卓桌面陪伴</h2><p>手动开启悬浮权限后显示宠物。息屏暂停渲染，不申请唤醒锁、不自启动。</p><div class="backup-actions"><button id="android-permission" class="secondary">开启悬浮权限</button><button id="android-notifications" class="secondary">允许通知</button><button id="android-show" class="primary">显示悬浮宠物</button><button id="android-hide" class="secondary">收起</button></div><p id="android-status" class="muted" role="status"></p>';
    document.getElementById("settings").appendChild(panel);
    const background = document.createElement("div");
    background.className = "android-background-settings";
    background.innerHTML = '<h3>后台陪伴</h3><label class="setting">后台常驻<input id="android-keep-alive" type="checkbox"></label><p class="muted">默认关闭。开启后保留一条常驻通知，可快速回到宠物；关闭主界面后不持续运行 AI。息屏暂停动画，空闲卸载模型，不使用唤醒锁。系统仍可能回收应用。</p><div class="backup-actions"><button class="secondary" id="android-battery-settings">后台省电设置</button><button class="secondary" id="android-autostart-settings">小米自启动设置</button></div><p id="android-background-status" class="muted" role="status"></p>';
    panel.appendChild(background);
    async function refreshBackground() {
      try {
        const status = await Native.status();
        document.getElementById("android-keep-alive").checked = !!status.keepAliveEnabled;
        document.getElementById("android-background-status").textContent = status.keepAliveEnabled
          ? (status.backgroundServiceRunning ? "后台陪伴已开启。" + (status.notificationsAllowed ? "" : "请允许通知，以便从通知栏回到宠物。") : "后台陪伴已启用，正在等待系统启动服务；可重新打开设置查看状态。")
          : "后台常驻已关闭。";
      } catch(error) { document.getElementById("android-background-status").textContent = error.message; }
    }
    document.getElementById("android-keep-alive").onchange = async e => {
      const input=e.target, requested=input.checked;input.disabled=true;
      try { if(requested)await Native.requestPermissions({permissions:["notifications"]});await Native.setKeepAlive({enabled:requested});await refreshBackground(); }
      catch(error) { input.checked=!requested;document.getElementById("android-background-status").textContent=error.message; }
      finally { input.disabled=false; }
    };
    for(const [id,action] of [["android-battery-settings",()=>Native.openBatterySettings()],["android-autostart-settings",()=>Native.openAutostartSettings()]])
      document.getElementById(id).onclick=async()=>{try{await action();}catch(error){document.getElementById("android-background-status").textContent=error.message;}};
    window.addEventListener('focus',refreshBackground);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshBackground();});
    refreshBackground();
    for (const [id, action] of [
      ["android-permission", () => Native.requestOverlayPermission()],
      [
        "android-notifications",
        () => Native.requestPermissions({ permissions: ["notifications"] }),
      ],
      ["android-show", () => Native.showOverlay()],
      ["android-hide", () => Native.hideOverlay()],
    ])
      document.getElementById(id).onclick = async () => {
        try {
          await action();
          document.getElementById("android-status").textContent =
            "操作已提交，可随时从通知栏收起宠物。";
        } catch (error) {
          document.getElementById("android-status").textContent = error.message;
        }
      };
  }
  if (!window.momoDesktop) return;
  window.momoDesktop.onAIBusy?.(busy =>
    window.dispatchEvent(new CustomEvent("momo-ai-busy", {detail:busy})),
  );
  window.momoDesktop.onPower?.((paused) =>
    window.dispatchEvent(new CustomEvent("momo-power", { detail: { paused } })),
  );
  const panel = document.createElement("article");
  panel.className = "extended-settings";
  panel.innerHTML = `<h2>电脑桌面陪伴</h2><label class="setting">开机自启（随系统登录启动）<input id="native-autolaunch" type="checkbox"></label><p id="native-autolaunch-status" class="muted" role="status"></p><label class="setting">启动时直接显示桌面宠物<input id="native-startup" type="checkbox" checked></label><p>透明窗口、置顶、托盘入口。鼠标穿透开启后，可从控制面板或托盘恢复交互。</p><div class="backup-actions"><button class="primary" id="native-show">显示桌面宠物</button><button class="secondary" id="native-hide">收起宠物</button></div><label class="setting">桌面宠物保持置顶<input id="native-top" type="checkbox" checked></label><label class="setting">鼠标穿透<input id="native-pass" type="checkbox"></label>`;
  document.getElementById("settings").appendChild(panel);
  window.momoDesktop.status().then(status => {
    document.getElementById("native-startup").checked = status.startupPet;
    const autolaunch = document.getElementById("native-autolaunch");
    autolaunch.checked = !!status.autoLaunch;
    autolaunch.disabled = !status.autoLaunchAvailable;
    document.getElementById("native-autolaunch-status").textContent = status.autoLaunchAvailable
      ? "默认关闭。开启后随系统登录启动；请保留解压后的应用目录。"
      : "开机自启可在 Windows / macOS 电脑版中设置。";
  });
  document.getElementById("native-autolaunch").onchange = async e => {
    const input = e.target, requested = input.checked;input.disabled = true;
    try {
      input.checked = await window.momoDesktop.setAutoLaunch(requested);
      document.getElementById("native-autolaunch-status").textContent = input.checked ? "已开启，下次登录系统时自动陪伴。" : "已关闭开机自启。";
    } catch(error) { input.checked = !requested;document.getElementById("native-autolaunch-status").textContent = error.message; }
    finally { input.disabled = false; }
  };
  document.getElementById("native-startup").onchange = async e => {
    const input = e.target;
    try { await window.momoDesktop.setStartupPet(input.checked); }
    catch { input.checked = !input.checked; }
  };
  document.getElementById("native-show").onclick = () =>
    window.momoDesktop.openPet();
  document.getElementById("native-hide").onclick = () =>
    window.momoDesktop.hidePet();
  document.getElementById("native-top").onchange = (e) =>
    window.momoDesktop.setAlwaysOnTop(e.target.checked);
  document.getElementById("native-pass").onchange = (e) =>
    window.momoDesktop.setClickThrough(e.target.checked);
  if (new URLSearchParams(location.search).get("pet") === "1") {
    document.body.classList.add("native-pet", "companion-mode");
    const toolbar = document.createElement("div");
    toolbar.className = "native-pet-toolbar";
    toolbar.innerHTML = '<span class="pet-drag-handle" title="拖动调整桌面位置">⠿ <b>MOMO</b></span><button id="native-menu-toggle" aria-label="宠物菜单" aria-expanded="false">⋯</button><button id="native-close" aria-label="收起宠物">×</button>';
    document.querySelector(".stage").appendChild(toolbar);
    const menu = document.createElement("div");
    menu.id = "pet-quick-menu";menu.hidden = true;
    menu.innerHTML = '<strong>今天也一起冒险</strong><button data-pet-page="2">✧ 说说话 <span>离线 AI</span></button><button data-pet-page="1">✦ 进化实验室 <span>成长与换装</span></button><button data-pet-page="3">◷ 专注与待办</button><button id="native-dashboard" data-pet-page="4">⚙ 偏好设置</button><button id="pet-rest">☾ 休息 / 醒来</button>';
    document.querySelector(".stage").appendChild(menu);
    const toggle = document.getElementById("native-menu-toggle");
    const setMenu = visible => { menu.hidden = !visible; toggle.setAttribute("aria-expanded",String(visible)); };
    toggle.onclick = () => setMenu(menu.hidden);
    document.querySelector("#canvas").addEventListener("contextmenu",e=>{e.preventDefault();setMenu(menu.hidden);});
    document.querySelector("#canvas").addEventListener("dblclick",()=>window.momoDesktop.openDashboard(2));
    menu.querySelectorAll('[data-pet-page]').forEach(b=>b.onclick=()=>{setMenu(false);window.momoDesktop.openDashboard(Number(b.dataset.petPage));});
    document.getElementById("pet-rest").onclick = () => {setMenu(false);document.getElementById("sleep").click();};
    document.addEventListener("keydown",e=>{if(e.key==='Escape')setMenu(false);});
    document.getElementById("native-close").onclick = () => window.momoDesktop.hidePet();

  }
}
