import { Capacitor, registerPlugin } from "@capacitor/core";
export const Native = registerPlugin("MomoNative");
export const isAndroid = () => Capacitor.getPlatform() === "android";
export async function aiStatus() {
  if (window.momoDesktop) return window.momoDesktop.aiStatus();
  if (isAndroid()) return Native.status();
  return {
    runtimeAvailable: false,
    modelAvailable: false,
    loaded: false,
    busy: false,
  };
}
export function prepareMessages(memory, name) {
  const clean = (text) =>
    String(text).replaceAll("<|im_start|>", "").replaceAll("<|im_end|>", "");
  const system = `你是桌面宠物${clean(name || "MOMO")}，用简短自然的中文陪伴用户。不要声称能执行尚未执行的应用操作。用户希望记住：${clean(memory.notes || "").slice(0, 500)}`;
  const recent = memory.messages
    .filter((m) => ["user", "assistant"].includes(m.role))
    .slice(-4)
    .map((m) => ({ role: m.role, content: clean(m.text).slice(-350) }));
  return [{ role: "system", content: system }, ...recent];
}
export async function askAI(messages) {
  if (window.momoDesktop) return window.momoDesktop.aiChat(messages);
  if (isAndroid()) {
    const prompt =
      messages
        .map((m) => `<|im_start|>${m.role}\n${m.content}<|im_end|>\n`)
        .join("") + "<|im_start|>assistant\n";
    return Native.chat({ prompt });
  }
  throw Error("本地推理需要电脑原生版或安卓安装包；网页版尚无推理引擎。");
}
export async function cancelAI() {
  if (window.momoDesktop) return window.momoDesktop.aiCancel();
  if (isAndroid()) return Native.cancel();
}
export async function unloadAI() {
  if (window.momoDesktop) return window.momoDesktop.aiUnload();
  if (isAndroid()) return Native.unload();
}
export function initAIPanel() {
  const panel = document.createElement("article");
  panel.className = "extended-settings";
  panel.innerHTML = `<h2>本地 AI · Qwen 0.5B</h2><p>电脑和安卓使用同一份 Q4_K_M GGUF 权重。按需推理，2 个 CPU 线程、2048 上下文、最多 128 个输出 token；空闲 30 秒卸载。</p><div class="backup-actions"><button class="primary" id="ai-prepare">准备 / 选择模型</button><button class="secondary" id="ai-unload">卸载运行中的模型</button><button class="secondary" id="ai-refresh">刷新状态</button></div><p id="ai-status" role="status" class="muted"></p><p class="muted">模型权重需要随安装资源准备；没有模型时不会生成预设的 AI 回复。长聊天只取近期片段和记事进入上下文，完整记录仍独立保留。</p>`;
  document.getElementById("settings").appendChild(panel);
  async function refresh() {
    try {
      const status = await aiStatus();
      document.getElementById("ai-status").textContent =
        `推理引擎：${status.runtimeAvailable ? "已集成" : "不可用"} · 权重：${status.modelAvailable ? "已准备" : "尚未安装"} · 状态：${status.loaded ? "已加载" : "未加载"}`;
    } catch {
      document.getElementById("ai-status").textContent =
        "无法读取原生推理状态。";
    }
  }
  document.getElementById("ai-prepare").onclick = async () => {
    try {
      if (window.momoDesktop) await window.momoDesktop.aiSelect();
      else if (isAndroid()) await Native.loadBundledModel();
      else throw Error("请使用电脑原生版或安卓安装包。");
      await refresh();
    } catch (error) {
      document.getElementById("ai-status").textContent = error.message;
    }
  };
  document.getElementById("ai-unload").onclick = async () => {
    await unloadAI();
    await refresh();
  };
  document.getElementById("ai-refresh").onclick = refresh;
  refresh();
}
