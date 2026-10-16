import "./features.css";
import { installApp, enableOffline } from "./install.js";
import {
  readRecord,
  createBackup,
  parseBackup,
  restoreBackup,
  undoRestore,
  remainingFocus,
} from "./companion-data.js";
export function initCompanion({ toast, save, say, isQuiet, interactionTotal }) {
  const $ = (id) => document.getElementById(id);
  const day = () => new Date().toLocaleDateString("sv-SE");
  const care = readRecord("momo-care", {
    snacks: 0,
    pats: 0,
    focusSessions: 0,
    focusMinutes: 0,
    visits: [],
  });
  const planner = readRecord("momo-planner", {
    tasks: [],
    focus: { duration: 1500000, remaining: 1500000, endsAt: null },
  });
  const preferences = readRecord("momo-preferences", {
    fps: 30,
    motion: !matchMedia("(prefers-reduced-motion: reduce)").matches,
    speech: false,
  });
  const home = document.createElement("section");
  home.id = "companion-dashboard";
  home.className = "companion-dashboard";
  home.innerHTML = `<article class="growth-card"><span class="eyebrow">GROW TOGETHER</span><h2>每一次陪伴，都算数。</h2><div class="growth-level"><b id="growth-level"></b><span id="growth-description"></span></div><div class="growth-metrics"><div><strong id="care-snacks"></strong><span>分享点心</span></div><div><strong id="care-focus"></strong><span>完成专注</span></div><div><strong id="care-visits"></strong><span>陪伴签到</span></div></div><button class="primary" id="check-in">今天也来抱抱</button><p class="muted">不在的时候，我也会好好照顾自己。没有掉血或惩罚。</p><div id="badges" class="badges" aria-label="陪伴成就"></div></article><article class="quick-focus"><span class="eyebrow">A MOMENT OF FOCUS</span><h2>一起专注一小会儿。</h2><p>去任务中心开始计时，留一点完整的时间给自己。</p><button class="secondary" id="go-focus">打开专注与待办 ↗</button><div class="tiny-note">你的记忆属于你。到偏好设置可以导出聊天、记事与陪伴进度。</div></article>`;
  $("world-panel").after(home);
  $("tasks").innerHTML =
    `<div class="planner-grid"><article class="focus-card"><span class="eyebrow">STAY WITH YOU</span><h2>陪你专注</h2><div class="timer" id="focus-time" role="timer" aria-label="专注剩余时间">25:00</div><label class="duration-label">专注时长 <select id="focus-duration"><option value="1">1 分钟</option><option value="15">15 分钟</option><option value="25">25 分钟</option><option value="45">45 分钟</option><option value="60">60 分钟</option></select></label><div class="timer-actions"><button class="primary" id="focus-start">开始专注</button><button class="secondary" id="focus-reset">重置计时</button></div><p id="focus-status" class="muted" role="status">准备好了，就一起开始。</p><p class="muted">计时会在刷新后继续；关闭页面不会在后台提醒，重新打开时核对结果。</p></article><article class="todo-card"><span class="eyebrow">ONE THING AT A TIME</span><h2>今天的小事</h2><form id="todo-form"><label for="todo-title" class="sr-only">待办内容</label><input id="todo-title" maxlength="200" required placeholder="想做些什么？"><label for="todo-due">提醒时间（可选）</label><input id="todo-due" type="datetime-local"><button class="primary">添加待办</button></form><div class="todo-heading"><span id="todo-count"></span><button id="clear-done" class="text-button">清理已完成</button></div><ul id="todo-list" class="todo-list"></ul><p id="todo-empty" class="muted">还没有待办，今天也可以慢慢来。</p></article></div><article class="notification-card"><h3>让小伙伴轻轻提醒你</h3><p>页面打开时可提醒待办与专注结束。安静模式会关闭语音和系统通知，页面内仍会记录状态。</p><button class="secondary" id="enable-notifications">开启浏览器通知</button><p id="notification-status" class="muted" role="status"></p><p class="notice">淘宝 / 京东活动自动化尚未接入。这里的待办不会操作其他应用。</p></article>`;
  const settings = document.createElement("article");
  settings.className = "extended-settings";
  settings.innerHTML = `<h2>轻一点，也安心一点。</h2><label class="setting">渲染帧率<select id="render-fps"><option value="15">15 FPS · 节能</option><option value="30">30 FPS · 均衡</option><option value="60">60 FPS · 流畅</option></select></label><label class="setting">角色动态与漂浮特效<input id="motion-enabled" type="checkbox"></label><label class="setting">语音播报（使用设备提供的语音）<input id="speech-enabled" type="checkbox"></label><button class="secondary" id="test-speech">试听一句</button><p id="speech-status" class="muted"></p><h3>把 MOMO 放到桌面</h3><p>支持浏览器安装时，可添加独立应用入口；这是网页应用，不具备系统悬浮窗能力。</p><button class="secondary" id="install-app">安装 / 添加到主屏幕</button><p class="muted" id="offline-status" role="status">正在检查离线能力…</p><p class="muted" id="install-status" role="status"></p><h3>记忆备份与恢复</h3><p>备份包含聊天、记事、昵称、偏好、互动、成长和待办。3D 文件请在伙伴图鉴单独导出；AI 模型权重不包含在内。</p><div class="backup-actions"><button class="primary" id="export-backup">导出记忆备份</button><label class="secondary">选择备份恢复<input hidden id="import-backup" type="file" accept=".json,application/json"></label><button class="secondary" id="undo-restore">撤销上次恢复</button></div><p class="muted">备份含私人聊天，请妥善保管。不会上传到服务器。</p><p id="backup-status" role="status" class="muted"></p>`;
  $("settings").appendChild(settings);
  const dialog = document.createElement("dialog");
  dialog.id = "restore-dialog";
  dialog.innerHTML = `<h2>恢复这份陪伴记忆？</h2><p id="restore-summary"></p><p>恢复将替换备份包含的本机记录，未包含的记录保持原状。外观模型文件不变；可以撤销这次恢复。</p><div class="backup-actions"><button id="confirm-restore" class="primary">确认恢复</button><button id="cancel-restore" class="secondary">取消</button></div>`;
  document.body.appendChild(dialog);
  $("install-app").onclick = async () => {
    $("install-status").textContent = await installApp();
  };
  enableOffline().then((status) => ($("offline-status").textContent = status));
  const persistCare = () => save("momo-care", care),
    persistPlanner = () => save("momo-planner", planner);
  function speak(text) {
    if (!preferences.speech || isQuiet() || !("speechSynthesis" in window))
      return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    const voice = speechSynthesis
      .getVoices()
      .find((v) => v.lang.startsWith("zh") && v.localService);
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  }
  function announce(text) {
    say(text);
    toast(text);
    speak(text);
    if (
      !isQuiet() &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      try {
        new Notification("MOMO 的轻提醒", { body: text, tag: "momo-reminder" });
      } catch {}
    }
  }
  function renderCare() {
    const xp =
      interactionTotal() + care.focusSessions * 5 + care.visits.length * 3;
    $("growth-level").textContent = `Lv.${1 + Math.floor(xp / 20)}`;
    $("growth-description").textContent =
      `陪伴经验 ${xp} · 距下一级 ${20 - (xp % 20)}`;
    $("care-snacks").textContent = care.snacks;
    $("care-focus").textContent = care.focusSessions;
    $("care-visits").textContent = care.visits.length;
    $("check-in").disabled = care.visits.includes(day());
    $("check-in").textContent = care.visits.includes(day())
      ? "今天已经抱抱过啦"
      : "今天也来抱抱";
    $("badges").replaceChildren();
    for (const [name, unlocked] of [
      ["初次相遇", interactionTotal() > 0],
      ["默契十足", interactionTotal() >= 10],
      ["专注伙伴", care.focusSessions > 0],
      ["三日陪伴", care.visits.length >= 3],
    ]) {
      const span = document.createElement("span");
      span.className = unlocked ? "badge earned" : "badge locked";
      span.textContent = (unlocked ? "✦ " : "◇ ") + name;
      span.title = unlocked ? "已达成" : "尚未达成";
      $("badges").appendChild(span);
    }
  }
  $("check-in").onclick = () => {
    if (care.visits.includes(day())) return;
    care.visits.push(day());
    persistCare();
    renderCare();
    announce("今天的抱抱收到了，陪伴又多了一点！");
  };
  for (const [id, field] of [
    ["feed", "snacks"],
    ["wave", "pats"],
  ])
    $(id).addEventListener("click", () => {
      care[field]++;
      persistCare();
      renderCare();
    });
  $("sleep").addEventListener("click", renderCare);
  $("go-focus").onclick = () =>
    document.querySelector('[data-page="3"]').click();
  function renderTasks() {
    $("todo-list").replaceChildren();
    $("todo-count").textContent =
      `${planner.tasks.filter((t) => !t.done).length} 件待完成`;
    $("todo-empty").hidden = planner.tasks.length > 0;
    for (const task of planner.tasks) {
      const li = document.createElement("li");
      li.className = "todo-item" + (task.done ? " completed" : "");
      const label = document.createElement("label"),
        check = document.createElement("input");
      check.type = "checkbox";
      check.checked = task.done;
      check.setAttribute("aria-label", "完成 " + task.title);
      const content = document.createElement("span"),
        title = document.createElement("strong");
      title.textContent = task.title;
      content.appendChild(title);
      if (task.due) {
        const time = document.createElement("small");
        time.textContent =
          new Date(task.due).toLocaleString("zh-CN") +
          (task.due <= Date.now() && !task.done ? " · 已到时间" : "");
        content.appendChild(time);
      }
      label.append(check, content);
      check.onchange = () => {
        task.done = check.checked;
        persistPlanner();
        renderTasks();
      };
      const remove = document.createElement("button");
      remove.className = "text-button";
      remove.textContent = "删除";
      remove.setAttribute("aria-label", "删除 " + task.title);
      remove.onclick = () => {
        planner.tasks = planner.tasks.filter((t) => t.id !== task.id);
        persistPlanner();
        renderTasks();
      };
      li.append(label, remove);
      $("todo-list").appendChild(li);
    }
  }
  $("todo-form").onsubmit = (e) => {
    e.preventDefault();
    const title = $("todo-title").value.trim();
    if (!title) return;
    if (planner.tasks.length >= 1000) {
      toast("待办已达上限，请先清理");
      return;
    }
    const due = $("todo-due").value
      ? new Date($("todo-due").value).getTime()
      : null;
    if (due !== null && !Number.isFinite(due)) {
      toast("请选择有效的提醒时间");
      return;
    }
    planner.tasks.push({
      id: crypto.randomUUID(),
      title,
      done: false,
      due,
      notified: false,
    });
    persistPlanner();
    $("todo-form").reset();
    renderTasks();
  };
  $("clear-done").onclick = () => {
    planner.tasks = planner.tasks.filter((t) => !t.done);
    persistPlanner();
    renderTasks();
  };
  $("focus-duration").value = String(planner.focus.duration / 60000);
  function renderTimer() {
    const ms = remainingFocus(planner.focus),
      seconds = Math.ceil(ms / 1000);
    $("focus-time").textContent =
      `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
    $("focus-start").textContent =
      planner.focus.endsAt === null ? "开始专注" : "暂停专注";
    $("focus-duration").disabled = planner.focus.endsAt !== null;
    $("focus-status").textContent =
      planner.focus.endsAt !== null
        ? "我会安静陪着你。"
        : planner.focus.remaining === 0
          ? "这次专注完成了，休息一下吧。"
          : "准备好了，就一起开始。";
  }
  $("focus-start").onclick = () => {
    const f = planner.focus;
    if (f.endsAt !== null && remainingFocus(f) === 0) {
      tick();
      return;
    }
    if (f.endsAt !== null) {
      f.remaining = remainingFocus(f);
      f.endsAt = null;
    } else {
      if (f.remaining === 0) f.remaining = f.duration;
      f.endsAt = Date.now() + f.remaining;
    }
    persistPlanner();
    renderTimer();
  };
  $("focus-duration").onchange = () => {
    const duration = Number($("focus-duration").value) * 60000;
    planner.focus = { duration, remaining: duration, endsAt: null };
    persistPlanner();
    renderTimer();
  };
  $("focus-reset").onclick = () => {
    planner.focus.remaining = planner.focus.duration;
    planner.focus.endsAt = null;
    persistPlanner();
    renderTimer();
  };
  function tick() {
    const f = planner.focus;
    if (f.endsAt !== null && remainingFocus(f) === 0) {
      f.endsAt = null;
      f.remaining = 0;
      care.focusSessions++;
      care.focusMinutes += f.duration / 60000;
      persistPlanner();
      persistCare();
      renderCare();
      announce("这次专注完成啦，伸个懒腰，喝点水吧。");
    }
    let changed = false;
    for (const task of planner.tasks) {
      if (
        !task.done &&
        !task.notified &&
        task.due !== null &&
        task.due <= Date.now()
      ) {
        task.notified = true;
        changed = true;
        announce(`时间到啦：${task.title}`);
      }
    }
    if (changed) {
      persistPlanner();
      renderTasks();
    }
    renderTimer();
  }
  function notificationStatus() {
    return !("Notification" in window)
      ? "当前浏览器不支持系统通知。"
      : {
          granted: "浏览器通知已开启；系统也可能限制投递。",
          denied: "通知已被阻止，可在浏览器站点设置中修改。",
          default: "尚未开启；页面内提醒仍然可用。",
        }[Notification.permission];
  }
  $("notification-status").textContent = notificationStatus();
  $("enable-notifications").onclick = async () => {
    if ("Notification" in window) {
      try {
        await Notification.requestPermission();
      } catch {}
    }
    $("notification-status").textContent = notificationStatus();
  };
  $("render-fps").value = preferences.fps;
  $("motion-enabled").checked = preferences.motion;
  $("speech-enabled").checked = preferences.speech;
  const savePreferences = () => {
    preferences.fps = Number($("render-fps").value);
    preferences.motion = $("motion-enabled").checked;
    preferences.speech = $("speech-enabled").checked;
    if (!preferences.speech && "speechSynthesis" in window)
      speechSynthesis.cancel();
    save("momo-preferences", preferences);
    window.dispatchEvent(
      new CustomEvent("momo-preferences", { detail: { ...preferences } }),
    );
  };
  for (const id of ["render-fps", "motion-enabled", "speech-enabled"])
    $(id).onchange = savePreferences;
  $("quiet").addEventListener("change", () => {
    if (isQuiet() && "speechSynthesis" in window) speechSynthesis.cancel();
  });
  $("speech-status").textContent =
    "speechSynthesis" in window
      ? "语音由设备提供，部分声音可能需要网络；这不是内置 AI。"
      : "当前浏览器不支持语音播报。";
  $("test-speech").onclick = () => {
    if (!preferences.speech || isQuiet()) {
      toast("请先开启语音并关闭安静模式");
      return;
    }
    speak("你好，我会一直在这里陪着你。");
  };
  $("export-backup").onclick = () => {
    try {
      const backup = createBackup();
      const url = URL.createObjectURL(
          new Blob([JSON.stringify(backup, null, 2)], {
            type: "application/json",
          }),
        ),
        a = document.createElement("a");
      a.href = url;
      a.download = `MOMO-memory-${day()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      $("backup-status").textContent = "记忆备份已导出；模型请单独导出。";
    } catch (error) {
      $("backup-status").textContent = error.message;
    }
  };
  let pendingBackup = null;
  $("import-backup").onchange = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      if (file.size > 20 * 1024 * 1024)
        throw new Error("备份超过 20 MB，请选择较小的文件");
      pendingBackup = parseBackup(await file.text());
      $("restore-summary").textContent =
        `包含 ${Object.keys(pendingBackup.records).length} 类数据，${pendingBackup.records["momo-memory"]?.messages.length || 0} 条聊天记录，${pendingBackup.records["momo-planner"]?.tasks.length || 0} 件待办。`;
      $("restore-dialog").showModal();
    } catch (error) {
      $("backup-status").textContent = "恢复失败：" + error.message;
    }
  };
  $("cancel-restore").onclick = () => {
    pendingBackup = null;
    dialog.close();
  };
  $("confirm-restore").onclick = () => {
    if (!pendingBackup) return;
    try {
      restoreBackup(pendingBackup);
      location.reload();
    } catch {
      $("backup-status").textContent =
        "恢复失败：存储不足或不可用，已尝试还原原记录。";
      dialog.close();
    }
  };
  try {
    $("undo-restore").disabled = !localStorage.getItem("momo-before-restore");
  } catch {
    $("undo-restore").disabled = true;
  }
  $("undo-restore").onclick = () => {
    try {
      undoRestore();
      location.reload();
    } catch (error) {
      $("backup-status").textContent = error.message;
    }
  };
  renderCare();
  renderTasks();
  tick();
  setInterval(tick, 1000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      tick();
      renderCare();
    }
  });
  return preferences;
}
