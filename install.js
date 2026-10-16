let installPrompt = null;
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  window.dispatchEvent(new Event("momo-install-ready"));
});
export async function installApp() {
  if (installPrompt) {
    const prompt = installPrompt;
    installPrompt = null;
    await prompt.prompt();
    return (await prompt.userChoice).outcome === "accepted"
      ? "安装请求已接受。"
      : "已取消安装，可稍后重试。";
  }
  return "请使用浏览器菜单中的“安装应用”或“添加到主屏幕”。浏览器需支持安装，并通过 HTTPS 或本机地址访问。";
}
export async function enableOffline() {
  if (!import.meta.env.PROD) return "开发模式不启用离线缓存，请使用生产构建。";
  if (!("serviceWorker" in navigator))
    return "当前浏览器或访问地址不支持离线缓存。";
  try {
    await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    return "离线资源已准备好。首次在线加载后，可离线使用本地功能；不包含 AI 模型。";
  } catch {
    return "离线缓存未完成，请联网后重新打开。";
  }
}
