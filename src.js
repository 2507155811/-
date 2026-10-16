import "./style.css";
import { askAI, cancelAI, prepareMessages, initAIPanel } from "./local-ai.js";
import { downloadFile } from "./downloads.js";
import { initNativeUI } from "./native-ui.js";
import { initCompanion } from "./companion-features.js";
import { readRecord } from "./companion-data.js";
import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { readModel, storeModel, removeModel } from "./model-store.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
function readStore(key, fallback) {
  return readRecord(key, fallback);
}
function writeStore(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    toast("本地存储不可用，本次设置未保存");
    return false;
  }
}
let activeAsset = "builtin";
const saved = readStore("momo-settings", {});
const appearance = readStore("momo-appearance", {
  model: Number.isInteger(saved.model) ? saved.model : 0,
  activeAsset: saved.activeAsset || "builtin",
  world: saved.world || "cloud",
  accessory: !!saved.accessory,
});
activeAsset = appearance.activeAsset;
let renderPreferences = readRecord("momo-preferences", {
  fps: 15,
  motion: !matchMedia("(prefers-reduced-motion: reduce)").matches,
  speech: false,
});
window.addEventListener("momo-preferences", (e) => {
  renderPreferences = e.detail;
  refreshRendering();
});
const memory = readStore("momo-memory", { messages: [], notes: "" });
if (!Array.isArray(memory.messages)) memory.messages = [];
let today = new Date().toLocaleDateString("sv-SE");
const journal = readStore("momo-journal", {
  first: today,
  day: today,
  touches: 0,
  total: 0,
});
if (journal.day !== today) {
  journal.day = today;
  journal.touches = 0;
}
let selectedModel = Number.isInteger(appearance.model)
  ? Math.max(0, Math.min(2, appearance.model))
  : 0;

document.querySelector("#app").innerHTML = `
<aside><a class="brand">✳ <b>MOMO<span>桌面上的小小陪伴</span></b></a><nav>${["我的宠物", "伙伴图鉴", "AI 聊天", "任务中心", "偏好设置"].map((x, i) => `<button data-page="${i}" class="${i === 0 ? "active" : ""}"><i>${["⌂", "◈", "✧", "☷", "⚙"][i]}</i>${x}</button>`).join("")}</nav><div class="side-note"><span class="dot"></span> 你的陪伴，正在发生<p>一点好奇，一点温柔。<br>让每一天都多一点期待。</p></div><small> M O M O / PREVIEW 0.5</small></aside>
<main><header><div><span class="eyebrow">YOUR LITTLE COMPANION</span><h1 id="heading">今天，也一起好好生活。</h1><p id="subtitle">和 MOMO 打个招呼，开启属于你们的一天。</p></div><div class="avatar">M</div></header>
<section id="home" class="page"><div class="stage"><div class="stage-top"><span class="pill"><span class="dot"></span> MOMO 的小世界</span><span class="tag">实时 3D · 拖动旋转</span></div><div id="canvas"></div><div class="bubble" id="bubble">嘿，你来啦！今天想一起做些什么？</div><div class="pet-label"><h2>MOMO <span>云朵精灵</span></h2><p>好奇心满满的，专属于你的小伙伴</p></div><div class="stage-tools"><button id="snapshot" aria-label="保存宠物照片">▣ 留个纪念</button><button id="focus-mode" aria-pressed="false">⛶ 陪伴模式</button></div><div class="stage-actions"><button id="wave">♡ 摸摸头</button><button id="feed">♧ 喂点心</button><button id="sleep">☾ 休息一下</button></div></div><div class="right-col"><article class="hello"><span class="eyebrow">A LITTLE ABOUT ME</span><h2>小小的我，<br>大大的陪伴。</h2><p>不赶时间，也不催促你。<br>我会在这里，陪你慢慢来。</p><div class="mood">✦ 心情 <b id="mood">开心冒泡</b></div></article><article><div class="card-title"><h3>我们的默契</h3><span>初次相遇</span></div><div class="progress"><i></i></div><p class="muted">从一句你好，开始熟悉彼此。</p><div class="stats"><div><b id="touches">0</b><span>今日互动</span></div><div><b id="days">01</b><span>陪伴天数</span></div></div></article><button class="model-link" data-open="1">◈ 换一个小伙伴 <span>↗</span></button></div></section><section class="world-panel" id="world-panel"><div><span class="eyebrow">MAKE YOURSELF AT HOME</span><h3>给陪伴换一种氛围</h3></div><div class="world-options"><button data-world="cloud" aria-pressed="true">☁ 云端小窝</button><button data-world="garden" aria-pressed="false">♧ 薄荷花园</button><button data-world="night" aria-pressed="false">☾ 星光晚安</button></div><label class="accessory-toggle"><input id="accessory" type="checkbox"> 戴上星星项链</label></section>
<section id="models" class="page hidden"><div class="section-title"><h2>每一种模样，都值得被喜欢。</h2><p>更换外观，还是同一个伙伴。昵称、聊天与互动记忆始终保留。</p></div><div class="model-grid">${[
  ["MOMO", "云朵精灵", "#e6e7ff"],
  ["桃桃", "蜜桃精灵", "#ffe2d7"],
  ["薄荷", "森林精灵", "#d9eee1"],
]
  .map(
    ([n, d, c], i) =>
      `<button class="model-card" data-model="${i}"><div class="mini-pet" style="--pet:${c}">●<span>• ᴗ •</span></div><h3>${n}</h3><p>${d}</p><span class="badge">${i === 0 ? "默认伙伴" : "点击换装"}</span></button>`,
  )
  .join(
    "",
  )}</div><div class="import-grid"><article><h3>↥ 导入 3D 模型</h3><p>支持自包含 GLB / GLTF。节能预算：最多 10 万顶点、贴图约 96 MiB。模型保存在本机，刷新后可恢复。清除站点数据会删除模型。</p><label class="primary">选择模型文件<input id="model-file" type="file" accept=".glb,.gltf" hidden></label><div class="asset-actions"><button class="secondary" id="restore-model" disabled>恢复已保存模型</button><button class="secondary" id="export-model">导出当前模型</button><button class="secondary" id="delete-model" disabled>删除已保存模型</button></div><label class="setting">自带动画<select id="model-animation" disabled><option value="-1">无自带动画</option></select></label><p class="muted" id="import-status" role="status" aria-live="polite">自带动画会自动播放；未绑定骨骼的模型不支持通用宠物动作。</p></article><article><h3>✧ 本地参考照片</h3><p>选择照片作为灵感参考。照片生成已暂缓，不加载额外的生成模型。</p><label class="secondary">选择参考照片<input id="photo-file" type="file" accept="image/*" hidden></label><img id="photo" hidden alt="本地参考照片"><p class="muted">当前只提供本地照片预览，不会生成模型或上传照片。</p></article></div></section>
<section id="chat" class="page hidden"><article class="chat-card"><h2>和 MOMO 说说话</h2><p class="notice">本地推理 · 请先在偏好设置准备模型。仅原生版支持，聊天记录独立于外观保存。</p><div id="messages"><p class="message">今天有什么想分享给我的？我在听。</p></div><form id="chat-form"><input id="chat-input" maxlength="1000" required placeholder="把今天的小事告诉我…"><button class="primary" id="chat-send">发送 ↗</button><button class="secondary" type="button" id="chat-cancel" disabled>停止</button></form><p id="chat-status" class="muted" role="status"></p></article></section>
<section id="tasks" class="page hidden"><article class="empty"><span>☷</span><h2>把琐事交给未来的我。</h2><p>任务功能稍后添加，先好好认识彼此。</p><p class="notice">淘宝 / 京东双 11 自动化尚未实现，当前不会读取或操控其他应用。</p></article></section>
<section id="settings" class="page hidden"><article><h2>按你的节奏陪伴</h2><label class="setting">伙伴昵称<input id="pet-name" maxlength="20" value=""></label><label class="setting">安静模式<input type="checkbox" id="quiet"></label><label class="setting">角色显示大小<input id="size" type="range" min="70" max="130" value="100"></label><h3>属于我们的记忆</h3><p>记忆独立于角色外观保存。更换、导入或删除模型不会清除聊天记录、互动和偏好。</p><label for="memory-notes">希望伙伴记住的事情</label><textarea id="memory-notes" maxlength="10000" rows="4" placeholder="例如：我喜欢安静的陪伴，习惯晚上阅读。"></textarea><button class="secondary" id="save-memory">保存记忆</button><p class="muted">当前为本机记事；AI 尚未接入，暂不会自动理解这些内容。清除浏览器数据仍会删除本地记忆。</p><h3>本地 AI · 集成规划</h3><p>目标：将已校验的 GGUF 权重随安装资源打包，原生版使用本地推理引擎。模型未安装时会明确提示，不会生成预设回复。</p><p class="notice">照片转 3D 需要独立生成模型或服务，不由聊天模型完成。安卓悬浮窗与电脑桌面窗口也需分别接入原生能力。</p><button class="secondary" id="reset">恢复默认设置</button></article></section>
<footer><span>✧ 留一点空间，给可爱的事物。</span><span>本地交互原型 · Android / Desktop 设计</span></footer></main><div id="toast" role="status"></div>`;
const pages = ["home", "models", "chat", "tasks", "settings"];
function openPage(i) {
  pages.forEach((p, j) =>
    document.getElementById(p).classList.toggle("hidden", i !== j),
  );
  document
    .querySelectorAll("nav button")
    .forEach((b, j) => b.classList.toggle("active", i === j));
  document.getElementById("heading").textContent = [
    "今天，也一起好好生活。",
    "遇见你的下一位伙伴。",
    "每一句话，都有人听。",
    "慢慢来，一件一件完成。",
    "舒服的陪伴，由你定义。",
  ][i];
  document.getElementById("world-panel").classList.toggle("hidden", i !== 0);
  document
    .getElementById("companion-dashboard")
    ?.classList.toggle("hidden", i !== 0);
  resize();
  refreshRendering();
  window.dispatchEvent(new CustomEvent("momo-page", { detail: i }));
}
document
  .querySelectorAll("[data-page]")
  .forEach((b) => (b.onclick = () => openPage(+b.dataset.page)));
document.querySelector("[data-open]").onclick = () => openPage(1);
let toastTimer;
function toast(s) {
  const e = document.getElementById("toast");
  e.textContent = s;
  e.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => e.classList.remove("show"), 3500);
}
const host = document.getElementById("canvas"),
  scene = new T.Scene(),
  camera = new T.PerspectiveCamera(35, 1, 0.1, 100);
camera.position.set(0, 2.6, 7.5);
const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.setClearColor(0, 0);
host.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.2, 0);
controls.enablePan = false;
controls.minDistance = 4;
controls.maxDistance = 11;
controls.maxPolarAngle = Math.PI / 2;
controls.enableDamping = true;
scene.add(new T.HemisphereLight(0xffffff, 0xb5a7ce, 3));
const light = new T.DirectionalLight(0xfff6ee, 4);
light.position.set(3, 6, 4);
light.castShadow = true;
scene.add(light);
const floor = new T.Mesh(
  new T.CircleGeometry(2.15, 64),
  new T.MeshStandardMaterial({ color: 0xe2dbef, roughness: 1 }),
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
if (new URLSearchParams(location.search).get("pet") === "1")
  floor.visible = false;
scene.add(floor);
const pet = new T.Group();
scene.add(pet);
let current = pet,
  mixer,
  asleep = false,
  touch = journal.touches,
  jump = 0;
const bodyMat = new T.MeshStandardMaterial({
  color: 0xdad7f7,
  roughness: 0.58,
});
const white = new T.MeshStandardMaterial({ color: 0xfffbf9, roughness: 0.7 });
const dark = new T.MeshStandardMaterial({ color: 0x373249, roughness: 0.4 });
function ball(parent, mat, x, y, z, sx, sy, sz) {
  const m = new T.Mesh(new T.SphereGeometry(1, 40, 28), mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  parent.add(m);
  return m;
}
ball(pet, bodyMat, 0, 1.12, 0, 0.91, 1, 0.72);
ball(pet, white, 0, 0.96, 0.54, 0.68, 0.68, 0.25);
const eyes = [],
  highlights = [],
  arms = [];
[-1, 1].forEach((s) => {
  const ear = ball(pet, bodyMat, s * 0.58, 2.02, -0.02, 0.25, 0.59, 0.24);
  ear.rotation.z = -s * 0.27;
  ball(pet, white, s * 0.59, 2.05, 0.17, 0.12, 0.35, 0.07);
  ball(pet, bodyMat, s * 0.55, 0.2, 0.24, 0.33, 0.23, 0.39);
  arms.push(ball(pet, bodyMat, s * 0.87, 0.94, 0.05, 0.23, 0.36, 0.25));
  eyes.push(ball(pet, dark, s * 0.29, 1.36, 0.69, 0.075, 0.105, 0.045));
  highlights.push(ball(pet, white, s * 0.27, 1.39, 0.73, 0.022, 0.029, 0.015));
  ball(
    pet,
    new T.MeshStandardMaterial({ color: 0xf0b7c9 }),
    s * 0.47,
    1.14,
    0.69,
    0.13,
    0.065,
    0.025,
  );
});
ball(pet, dark, 0, 1.15, 0.79, 0.045, 0.03, 0.02);
const smile = new T.Mesh(
  new T.TorusGeometry(0.11, 0.015, 8, 24, Math.PI),
  dark,
);
smile.rotation.z = Math.PI;
smile.position.set(0, 1.1, 0.79);
pet.add(smile);
ball(pet, white, 0.74, 0.63, -0.47, 0.32, 0.32, 0.32);
const necklace = new T.Group();
pet.add(necklace);
const cord = new T.Mesh(
  new T.TorusGeometry(0.58, 0.018, 8, 64),
  new T.MeshStandardMaterial({ color: 0xd6b97d }),
);
cord.rotation.x = Math.PI / 2;
cord.position.set(0, 0.92, 0);
necklace.add(cord);
const starShape = new T.Shape();
for (let i = 0; i < 10; i++) {
  const a = (i * Math.PI) / 5 + Math.PI / 2,
    r = i % 2 ? 0.07 : 0.15;
  const x = Math.cos(a) * r,
    y = Math.sin(a) * r;
  i ? starShape.lineTo(x, y) : starShape.moveTo(x, y);
}
starShape.closePath();
const star = new T.Mesh(
  new T.ExtrudeGeometry(starShape, {
    depth: 0.045,
    bevelEnabled: true,
    bevelSize: 0.012,
    bevelThickness: 0.01,
    bevelSegments: 2,
    steps: 1,
  }),
  new T.MeshStandardMaterial({
    color: 0xf4d48e,
    metalness: 0.35,
    roughness: 0.35,
  }),
);
star.position.set(0, 0.83, 0.82);
necklace.add(star);
necklace.visible = !!appearance.accessory;
const sparkles = new T.Group();
scene.add(sparkles);
const sparkleMaterial = new T.MeshStandardMaterial({
  color: 0xffe8af,
  emissive: 0xc39c5c,
  emissiveIntensity: 0.3,
});
for (let i = 0; i < 12; i++) {
  const m = new T.Mesh(new T.OctahedronGeometry(0.035), sparkleMaterial);
  const a = (i / 12) * Math.PI * 2;
  m.position.set(
    Math.cos(a) * 1.8,
    0.7 + (i % 4) * 0.5,
    Math.sin(a) * 1.25 - 0.5,
  );
  sparkles.add(m);
}
let world = appearance.world || "cloud";
const worldThemes = {
  cloud: { floor: 0xe2dbef, light: 0xfff6ee },
  garden: { floor: 0xd0e4d5, light: 0xf3ffe6 },
  night: { floor: 0x68658c, light: 0xcbd3ff },
};
function setWorld(value) {
  world = worldThemes[value] ? value : "cloud";
  const theme = worldThemes[world];
  document.querySelector(".stage").dataset.world = world;
  floor.material.color.set(theme.floor);
  light.color.set(theme.light);
  document
    .querySelectorAll("[data-world]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.world === world)),
    );
}
setWorld(world);
function resize() {
  if (!host.clientWidth) return;
  renderer.setSize(host.clientWidth, host.clientHeight);
  camera.aspect = host.clientWidth / host.clientHeight;
  camera.updateProjectionMatrix();
  refreshRendering();
}
new ResizeObserver(resize).observe(host);
const clock = new T.Clock();
let renderElapsed = 0,
  renderTimer = null,
  renderRequest = null,
  nativePaused = false,
  aiBusy = false;
function renderFrame() {
  renderElapsed += clock.getDelta();
  if (
    document.hidden ||
    document.getElementById("home").classList.contains("hidden")
  ) {
    renderElapsed = 0;
    return;
  }
  if (renderElapsed < 1 / renderPreferences.fps) return;
  const dt = Math.min(renderElapsed, 0.1);
  renderElapsed = 0;
  const t = renderPreferences.motion ? clock.elapsedTime : 0;
  current.position.y = asleep
    ? -0.04
    : renderPreferences.motion
      ? Math.sin(t * 2) * 0.035 + Math.max(0, Math.sin(jump)) * 0.3
      : 0;
  if (jump > 0) jump = Math.max(0, jump - dt * 5);
  current.rotation.z = asleep ? 0.16 : Math.sin(t) * 0.018;
  const blink = asleep ? 0.08 : Math.sin(t * 1.3) > 0.995 ? 0.09 : 1;
  eyes.forEach((e) => (e.scale.y = 0.105 * blink));
  highlights.forEach((e) => (e.visible = blink > 0.5));
  arms.forEach(
    (a, i) =>
      (a.rotation.z = (i ? 1 : -1) * (jump > 0 ? Math.sin(jump) * 0.9 : 0.08)),
  );
  sparkles.rotation.y = t * 0.07;
  sparkles.children.forEach((m, i) => {
    m.position.y = 0.7 + (i % 4) * 0.5 + Math.sin(t + i) * 0.08;
  });
  sparkles.visible = renderPreferences.motion;
  controls.update();
  if (renderPreferences.motion) mixer?.update(dt);
  renderer.render(scene, camera);
}
function canRender() {
  return (
    !document.hidden &&
    !nativePaused &&
    !aiBusy &&
    !document.getElementById("home").classList.contains("hidden")
  );
}
function scheduleFrame() {
  if (!canRender() || !renderPreferences.motion) return;
  renderTimer = setTimeout(() => {
    renderRequest = requestAnimationFrame(() => {
      if (canRender()) renderFrame();
      scheduleFrame();
    });
  }, 1000 / renderPreferences.fps);
}
function refreshRendering() {
  clearTimeout(renderTimer);
  if (renderRequest !== null) cancelAnimationFrame(renderRequest);
  controls.enableDamping = renderPreferences.motion;
  if (!canRender()) return;
  renderElapsed = 1 / renderPreferences.fps;
  renderFrame();
  scheduleFrame();
}
controls.addEventListener("change", () => {
  if (!renderPreferences.motion && canRender()) {
    renderRequest = requestAnimationFrame(() => {
      renderElapsed = 1 / renderPreferences.fps;
      renderFrame();
    });
  }
});
document.addEventListener("visibilitychange", refreshRendering);
window.addEventListener("momo-power", (e) => {
  nativePaused = !!e.detail.paused;
  refreshRendering();
});
window.addEventListener("momo-ai-busy", (e) => {
  aiBusy = !!e.detail;
  refreshRendering();
});
document.addEventListener("click", () => {
  if (!renderPreferences.motion) refreshRendering();
});
document.addEventListener("input", () => {
  if (!renderPreferences.motion) refreshRendering();
});
refreshRendering();
function syncJournalDay() {
  today = new Date().toLocaleDateString("sv-SE");
  if (journal.day !== today) {
    journal.day = today;
    journal.touches = 0;
    touch = 0;
  }
}
function interact(text, mood) {
  syncJournalDay();
  document.getElementById("bubble").textContent = text;
  document.getElementById("mood").textContent = mood;
  ++touch;
  journal.touches = touch;
  journal.total++;
  writeStore("momo-journal", journal);
  refreshStats();
}
function refreshStats() {
  syncJournalDay();
  document.getElementById("touches").textContent = touch;
  document.getElementById("days").textContent = String(
    Math.max(
      1,
      Math.round((Date.parse(today) - Date.parse(journal.first)) / 86400000) +
        1,
    ),
  ).padStart(2, "0");
  document.querySelector(".progress i").style.width =
    Math.min(100, 12 + journal.total * 2) + "%";
  document.querySelector(".card-title span").textContent =
    journal.total >= 30
      ? "默契伙伴"
      : journal.total >= 10
        ? "逐渐熟悉"
        : "初次相遇";
}
refreshStats();
writeStore("momo-journal", journal);
let pointerStart;
renderer.domElement.addEventListener(
  "pointerdown",
  (e) => (pointerStart = { x: e.clientX, y: e.clientY }),
);
renderer.domElement.addEventListener("pointerup", (e) => {
  if (
    !pointerStart ||
    Math.hypot(e.clientX - pointerStart.x, e.clientY - pointerStart.y) > 7
  )
    return;
  const rect = renderer.domElement.getBoundingClientRect(),
    ray = new T.Raycaster();
  ray.setFromCamera(
    new T.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      (-(e.clientY - rect.top) / rect.height) * 2 + 1,
    ),
    camera,
  );
  if (ray.intersectObject(current, true).length)
    document.getElementById("wave").click();
});
document.getElementById("focus-mode").onclick = () => {
  const active = document.body.classList.toggle("companion-mode");
  document
    .getElementById("focus-mode")
    .setAttribute("aria-pressed", String(active));
  document.getElementById("focus-mode").textContent = active
    ? "↙ 返回工作台"
    : "⛶ 陪伴模式";
  resize();
};
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && document.body.classList.contains("companion-mode"))
    document.getElementById("focus-mode").click();
});
document.getElementById("snapshot").onclick = async () => {
  try {
    renderer.render(scene, camera);
    const blob = await new Promise((resolve) =>
      renderer.domElement.toBlob(resolve, "image/png"),
    );
    if (!blob) throw Error();
    await downloadFile(blob, "MOMO-" + today + ".png");
    toast("宠物照片已导出");
  } catch {
    toast("照片导出失败");
  }
};
document.getElementById("wave").onclick = () => {
  asleep = false;
  jump = Math.PI;
  interact("嘿嘿，最喜欢你摸摸头啦！", "超级开心");
};
document.getElementById("feed").onclick = () => {
  asleep = false;
  jump = Math.PI;
  interact("是小点心！谢谢你，分你一半 ♡", "幸福满满");
};
document.getElementById("sleep").onclick = () => {
  asleep = !asleep;
  interact(
    asleep ? "呼……我先眯一小会儿。" : "睡醒啦！我们继续玩吧。",
    asleep ? "安静休息" : "精神满满",
  );
};
let modelRevision = 0,
  cachedModel = null,
  activeAnimations = [];
document
  .getElementById("model-animation")
  .replaceChildren(new Option("无自带动画", "-1"));
document.getElementById("model-animation").disabled = true;
function useBuiltin(index = selectedModel) {
  modelRevision++;
  document
    .getElementById("model-animation")
    .replaceChildren(new Option("无自带动画", "-1"));
  document.getElementById("model-animation").disabled = true;
  activeAsset = "builtin";
  activeAnimations = [];
  if (current !== pet) {
    scene.remove(current);
    dispose(current);
    current = pet;
    pet.visible = true;
    mixer = null;
  }
  selectedModel = index;
  current.position.set(0, 0, 0);
  current.rotation.set(0, 0, 0);
  applyModel();
  save();
}
document.querySelectorAll("[data-model]").forEach(
  (b) =>
    (b.onclick = () => {
      useBuiltin(+b.dataset.model);
      toast("已更换伙伴配色");
      openPage(0);
    }),
);
function dispose(root) {
  const geometries = new Set(),
    materials = new Set(),
    textures = new Set();
  root.traverse((o) => {
    if (o.geometry) geometries.add(o.geometry);
    for (const m of o.material
      ? Array.isArray(o.material)
        ? o.material
        : [o.material]
      : []) {
      materials.add(m);
      for (const v of Object.values(m)) if (v?.isTexture) textures.add(v);
    }
  });
  textures.forEach((t) => t.dispose());
  materials.forEach((m) => m.dispose());
  geometries.forEach((g) => g.dispose());
}
const modelStatus = document.getElementById("import-status");
function updateAssetButtons() {
  document.getElementById("restore-model").disabled = !cachedModel;
  document.getElementById("delete-model").disabled = !cachedModel;
}
async function loadAsset(asset, { persist = false } = {}) {
  const revision = ++modelRevision;
  modelStatus.textContent = "正在解析模型…";
  let root;
  try {
    const manager = new T.LoadingManager();
    manager.setURLModifier((url) => {
      if (!url.startsWith("data:") && !url.startsWith("blob:"))
        throw Error("只允许自包含模型");
      return url;
    });
    const gltf = await new GLTFLoader(manager).parseAsync(asset.data, "");
    root = gltf.scene;
    let vertices = 0,
      textureBytes = 0;
    const seenTextures = new Set();
    root.traverse((object) => {
      vertices += object.geometry?.attributes.position?.count || 0;
      for (const material of object.material
        ? Array.isArray(object.material)
          ? object.material
          : [object.material]
        : [])
        for (const value of Object.values(material))
          if (value?.isTexture && !seenTextures.has(value)) {
            seenTextures.add(value);
            textureBytes +=
              ((value.image?.width || 0) * (value.image?.height || 0) * 4 * 4) /
              3;
          }
    });
    if (vertices > 100000 || textureBytes > 96 * 1024 * 1024) {
      const error = Error(
        "模型超出节能预算：请将顶点降到 10 万以内、贴图内存降到约 96 MiB。",
      );
      error.budget = true;
      throw error;
    }
    root.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(root),
      size = box.getSize(new T.Vector3()),
      max = Math.max(size.x, size.y, size.z);
    if (!Number.isFinite(max) || max <= 0) throw Error("空模型");
    root.scale.multiplyScalar(2.5 / max);
    root.updateMatrixWorld(true);
    const normalized = new T.Box3().setFromObject(root),
      center = normalized.getCenter(new T.Vector3());
    root.position.sub(new T.Vector3(center.x, normalized.min.y, center.z));
    if (revision !== modelRevision) {
      dispose(root);
      return;
    }
    const wrapper = new T.Group();
    wrapper.add(root);
    if (current !== pet) {
      scene.remove(current);
      dispose(current);
    }
    pet.visible = false;
    current = wrapper;
    scene.add(wrapper);
    activeAnimations = gltf.animations;
    mixer = activeAnimations.length ? new T.AnimationMixer(root) : null;
    if (activeAnimations.length) mixer.clipAction(activeAnimations[0]).play();
    const animationMenu = document.getElementById("model-animation");
    animationMenu.replaceChildren(
      new Option("停止自带动画", "-1"),
      ...activeAnimations.map(
        (a, i) => new Option(a.name || `动画 ${i + 1}`, String(i)),
      ),
    );
    animationMenu.disabled = !activeAnimations.length;
    animationMenu.value = activeAnimations.length ? "0" : "-1";
    activeAsset = "custom";
    save();
    document.querySelector(".pet-label h2 span").textContent = "自定义模型";
    document.querySelector(".pet-label p").textContent = asset.name;
    modelStatus.textContent = `已加载 ${asset.name} · ${activeAnimations.length} 组动画`;
    openPage(0);
    if (persist) {
      try {
        await storeModel(asset);
        cachedModel = asset;
        writeStore("momo-assets-updated", Date.now());
        updateAssetButtons();
        if (revision === modelRevision)
          modelStatus.textContent += " · 已保存到本机";
      } catch {
        toast("模型已加载，但本地保存失败；刷新后需重新导入");
      }
    }
  } catch (error) {
    if (root && current.children[0] !== root) dispose(root);
    if (revision === modelRevision)
      modelStatus.textContent = error.budget
        ? error.message
        : "加载失败。请使用有效且包含所有资源的 GLB / GLTF；当前伙伴已保留。";
  }
}
document.getElementById("model-file").onchange = async (e) => {
  const f = e.target.files[0];
  e.target.value = "";
  if (!f) return;
  if (f.size > 100 * 1024 * 1024) {
    modelStatus.textContent = "文件超过 100 MB，请先优化模型。";
    return;
  }
  await loadAsset(
    { name: f.name, data: await f.arrayBuffer() },
    { persist: true },
  );
};
document.getElementById("restore-model").onclick = () => {
  if (cachedModel) loadAsset(cachedModel);
};
document.getElementById("delete-model").onclick = async () => {
  try {
    await removeModel();
    cachedModel = null;
    updateAssetButtons();
    if (activeAsset === "custom") useBuiltin();
    modelStatus.textContent = "已删除本机保存的自定义模型。";
  } catch {
    toast("删除失败，请检查浏览器存储权限");
  }
};
document.getElementById("export-model").onclick = async (e) => {
  const button = e.currentTarget;
  button.disabled = true;
  try {
    const { GLTFExporter } =
      await import("three/addons/exporters/GLTFExporter.js");
    const pose = {
      position: current.position.clone(),
      rotation: current.rotation.clone(),
    };
    let data;
    try {
      current.position.set(0, 0, 0);
      current.rotation.set(0, 0, 0);
      current.updateMatrixWorld(true);
      data = await new GLTFExporter().parseAsync(current, {
        binary: true,
        animations: activeAnimations,
        onlyVisible: true,
      });
    } finally {
      current.position.copy(pose.position);
      current.rotation.copy(pose.rotation);
    }
    await downloadFile(
      new Blob([data], { type: "model/gltf-binary" }),
      "MOMO-companion.glb",
    );
    toast("已导出 GLB 模型");
  } catch {
    toast("模型导出失败，请尝试重新导入");
  } finally {
    button.disabled = false;
  }
};
let photoURL;
document.getElementById("photo-file").onchange = (e) => {
  const f = e.target.files[0];
  if (!f) return;
  if (photoURL) URL.revokeObjectURL(photoURL);
  photoURL = URL.createObjectURL(f);
  const img = document.getElementById("photo");
  img.src = photoURL;
  img.hidden = false;
};
function renderMessage(message) {
  const p = document.createElement("p");
  p.className = message.role === "user" ? "message user" : "message";
  p.textContent = message.text;
  document.getElementById("messages").appendChild(p);
}
memory.messages
  .filter((m) => m && typeof m.text === "string")
  .forEach(renderMessage);
let chatting = false;
document.getElementById("chat-cancel").onclick = () => cancelAI();
document.getElementById("chat-form").onsubmit = async (e) => {
  e.preventDefault();
  if (chatting) return;
  const input = document.getElementById("chat-input");
  if (!input.value.trim()) return;
  if (memory.messages.length + 2 > 20000) {
    toast("聊天容量已满，请先导出备份，已有记录不会删除。");
    return;
  }
  const user = { role: "user", text: input.value };
  memory.messages.push(user);
  if (!writeStore("momo-memory", memory)) {
    memory.messages.pop();
    return;
  }
  renderMessage(user);
  input.value = "";
  chatting = true;
  document.getElementById("chat-send").disabled = true;
  document.getElementById("chat-cancel").disabled = false;
  document.getElementById("chat-status").textContent =
    "正在本机准备模型或推理，宠物动画暂时休息…";
  window.dispatchEvent(new CustomEvent("momo-ai-busy", { detail: true }));
  try {
    const result = await askAI(prepareMessages(memory, nameInput.value));
    const assistant = { role: "assistant", text: result.text };
    memory.messages.push(assistant);
    if (!writeStore("momo-memory", memory)) memory.messages.pop();
    renderMessage(assistant);
    document.getElementById("chat-status").textContent =
      "本地回复完成，空闲后自动卸载模型。";
  } catch (error) {
    document.getElementById("chat-status").textContent =
      error.message || "推理失败，请检查模型。";
  } finally {
    chatting = false;
    document.getElementById("chat-send").disabled = false;
    document.getElementById("chat-cancel").disabled = true;
    window.dispatchEvent(new CustomEvent("momo-ai-busy", { detail: false }));
    document.getElementById("messages").scrollTop =
      document.getElementById("messages").scrollHeight;
  }
};
document.getElementById("memory-notes").value =
  typeof memory.notes === "string" ? memory.notes : "";
document.getElementById("save-memory").onclick = () => {
  memory.notes = document.getElementById("memory-notes").value;
  if (writeStore("momo-memory", memory)) toast("记忆已保存，更换外观也会保留");
};
function applyModel() {
  document.querySelector(".pet-label p").textContent =
    "好奇心满满的，专属于你的小伙伴";
  bodyMat.color.set([0xdad7f7, 0xf3c8b7, 0xb8d9c5][selectedModel]);
  document.querySelector(".pet-label h2 span").textContent = [
    "云朵精灵",
    "蜜桃精灵",
    "森林精灵",
  ][selectedModel];
  document.querySelectorAll("[data-model]").forEach((b) => {
    const selected = +b.dataset.model === selectedModel;
    b.setAttribute("aria-pressed", String(selected));
    b.querySelector(".badge").textContent = selected ? "当前伙伴" : "选择配色";
  });
}
applyModel();
const nameInput = document.getElementById("pet-name"),
  quiet = document.getElementById("quiet"),
  scale = document.getElementById("size");
nameInput.value = saved.name || "MOMO";
quiet.checked = !!saved.quiet;
scale.value = saved.size || 100;
function save() {
  writeStore("momo-settings", {
    name: nameInput.value,
    quiet: quiet.checked,
    size: scale.value,
  });
  writeStore("momo-appearance", {
    model: selectedModel,
    activeAsset,
    world,
    accessory: necklace.visible,
  });
  document.querySelector(".pet-label h2").firstChild.textContent =
    (nameInput.value || "MOMO") + " ";
  current.scale.setScalar(+scale.value / 100);
  document.getElementById("bubble").style.visibility = quiet.checked
    ? "hidden"
    : "visible";
}
[nameInput, quiet, scale].forEach((e) => (e.oninput = save));
save();
document.getElementById("reset").onclick = () => {
  nameInput.value = "MOMO";
  quiet.checked = false;
  scale.value = 100;
  save();
  useBuiltin(0);
  setWorld("cloud");
  necklace.visible = false;
  document.getElementById("accessory").checked = false;
  save();
  toast("已恢复默认设置");
};
document.querySelectorAll("[data-world]").forEach(
  (b) =>
    (b.onclick = () => {
      setWorld(b.dataset.world);
      save();
    }),
);
document.getElementById("accessory").checked = necklace.visible;
document.getElementById("accessory").onchange = (e) => {
  necklace.visible = e.target.checked;
  if (current !== pet) toast("星星项链仅适用于内置伙伴");
  save();
};

// Restore only if the user has not selected a different companion in the meantime.
const initialRevision = modelRevision;
readModel()
  .then((asset) => {
    cachedModel = asset || null;
    updateAssetButtons();
    if (asset) {
      modelStatus.textContent = `本机已保存：${asset.name}`;
      if (
        appearance.activeAsset === "custom" &&
        modelRevision === initialRevision
      )
        loadAsset(asset);
    }
  })
  .catch(() => {
    modelStatus.textContent = "浏览器模型存储不可用，仍可临时导入。";
  });

if (new URLSearchParams(location.search).get("pet") !== "1") {
  initAIPanel();
  initCompanion({
    toast,
    save: writeStore,
    isQuiet: () => quiet.checked,
    interactionTotal: () => journal.total,
    say: (text) => {
      document.getElementById("bubble").textContent = text;
    },
  });
}
initNativeUI();

window.addEventListener("storage", async (event) => {
  if (event.key === "momo-memory") {
    Object.assign(memory, readRecord("momo-memory", memory));
    const list = document.getElementById("messages");
    list.replaceChildren();
    memory.messages.forEach(renderMessage);
    if (document.activeElement !== document.getElementById("memory-notes"))
      document.getElementById("memory-notes").value = memory.notes;
  }
  if (event.key === "momo-journal") {
    Object.assign(journal, readRecord("momo-journal", journal));
    touch = journal.touches;
    refreshStats();
  }
  if (event.key === "momo-settings") {
    const settings = readRecord("momo-settings", saved);
    nameInput.value = settings.name;
    quiet.checked = settings.quiet;
    scale.value = settings.size;
    document.querySelector(".pet-label h2").firstChild.textContent =
      settings.name + " ";
    current.scale.setScalar(Number(settings.size) / 100);
    document.getElementById("bubble").style.visibility = settings.quiet
      ? "hidden"
      : "visible";
  }
  if (event.key === "momo-preferences") {
    renderPreferences = readRecord("momo-preferences", renderPreferences);
    refreshRendering();
  }
  if (event.key === "momo-appearance") {
    const next = readRecord("momo-appearance", appearance);
    selectedModel = next.model;
    setWorld(next.world);
    necklace.visible = next.accessory;
    if (next.activeAsset === "builtin") {
      useBuiltin(next.model);
    } else {
      const asset = await readModel();
      if (asset) await loadAsset(asset);
    }
  }
  if (event.key === "momo-assets-updated" && activeAsset === "custom") {
    const asset = await readModel();
    if (asset) await loadAsset(asset);
  }
  refreshRendering();
});
if (new URLSearchParams(location.search).get("pet") === "1")
  for (const [id, key] of [
    ["feed", "snacks"],
    ["wave", "pats"],
  ])
    document.getElementById(id).addEventListener("click", () => {
      const care = readRecord("momo-care", {
        snacks: 0,
        pats: 0,
        focusSessions: 0,
        focusMinutes: 0,
        visits: [],
      });
      care[key]++;
      writeStore("momo-care", care);
    });

document.getElementById("model-animation").onchange = (e) => {
  if (!mixer) return;
  mixer.stopAllAction();
  const index = Number(e.target.value);
  if (index >= 0 && activeAnimations[index])
    mixer.clipAction(activeAnimations[index]).play();
  refreshRendering();
};
