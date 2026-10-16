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
  panel.innerHTML = `<h2>电脑桌面陪伴</h2><label class="setting">启动时直接显示桌面宠物<input id="native-startup" type="checkbox" checked></label><p>透明窗口、置顶、托盘入口。鼠标穿透开启后，可从控制面板或托盘恢复交互。</p><div class="backup-actions"><button class="primary" id="native-show">显示桌面宠物</button><button class="secondary" id="native-hide">收起宠物</button></div><label class="setting">桌面宠物保持置顶<input id="native-top" type="checkbox" checked></label><label class="setting">鼠标穿透<input id="native-pass" type="checkbox"></label>`;
  document.getElementById("settings").appendChild(panel);
  window.momoDesktop.status().then(status => { document.getElementById("native-startup").checked = status.startupPet; });
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
