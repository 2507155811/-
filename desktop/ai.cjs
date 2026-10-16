const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const net = require("node:net");
class LocalAI {
  constructor(root, options = {}) {
    this.root = root;
    this.logFile = options.logFile;
    this.ready = false;
    this.lastError = null;
    this.model = path.join(
      root,
      "ai-assets",
      "qwen2.5-0.5b-instruct-q4_k_m.gguf",
    );
    this.child = null;
    this.busy = false;
    this.timer = null;
    this.controller = null;
    this.key = crypto.randomBytes(32).toString("hex");
  }
  runtime() {
    return path.join(
      this.root,
      "ai-runtime",
      process.platform + "-" + process.arch,
      process.platform === "win32" ? "llama-server.exe" : "llama-server",
    );
  }
  status() {
    return {
      runtimeAvailable: fs.existsSync(this.runtime()),
      modelAvailable: fs.existsSync(this.model),
      loaded: !!this.child && this.ready,
      lastError: this.lastError,
      logFile: this.logFile || null,
      busy: this.busy,
      modelName: path.basename(this.model),
      threads: 2,
      context: 2048,
      maxTokens: 128,
    };
  }
  select(file) {
    if (this.busy) throw Error("请先停止当前推理");
    const fd = fs.openSync(file, "r");
    try {
      const magic = Buffer.alloc(4);
      fs.readSync(fd, magic, 0, 4, 0);
      if (magic.toString() !== "GGUF") throw Error("请选择有效的 GGUF 文件");
    } finally {
      fs.closeSync(fd);
    }
    this.stop();
    this.model = file;
  }
  async ensure() {
    if (this.child && this.ready) return;
    this.lastError = null;
    if (!this.status().runtimeAvailable)
      throw Error("本机推理引擎尚未准备，请运行 npm run ai:engine");
    if (!this.status().modelAvailable)
      throw Error("尚未安装模型权重，请准备官方 GGUF 或选择本地模型");
    const modelStat = fs.statSync(this.model);
    const signature = Buffer.alloc(4);
    const fd = fs.openSync(this.model, "r");
    try { fs.readSync(fd, signature, 0, 4, 0); } finally { fs.closeSync(fd); }
    if (modelStat.size < 1024 * 1024 || signature.toString() !== "GGUF")
      throw Error("AI 权重不完整或格式错误，请重新解压完整安装包。");
    const port = await new Promise((resolve, reject) => {
      const server = net.createServer();
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        const port = server.address().port;
        server.close(() => resolve(port));
      });
    });
    this.url = `http://127.0.0.1:${port}`;
    const child = spawn(
      this.runtime(),
      [
        "--model",
        this.model,
        "--host",
        "127.0.0.1",
        "--port",
        String(port),
        "--api-key",
        this.key,
        "--n-gpu-layers",
        "0",
        "--threads",
        "2",
        "--threads-batch",
        "2",
        "--ctx-size",
        "2048",
        "--parallel",
        "1",
        "--n-predict",
        "128",
        "--no-webui",
      ],
      {
        stdio: ["ignore", "ignore", "pipe"],
        windowsHide: true,
        cwd: path.dirname(this.runtime()),
        env: {
          ...process.env,
          OMP_NUM_THREADS: "2",
          OMP_WAIT_POLICY: "PASSIVE",
          KMP_BLOCKTIME: "0",
        },
      },
    );
    this.child = child;
    let lastError = "";
    child.stderr.on(
      "data",
      (d) => (lastError = (lastError + d.toString()).slice(-1500)),
    );
    let exited = false, exitCode = null, spawnError = null;
    child.on("exit", (code) => {
      exited = true;
      exitCode = code;
      if (this.child === child) { this.child = null; this.ready = false; }
    });
    child.on("error", (error) => {
      exited = true;
      spawnError = error;
      if (this.child === child) this.child = null;
      this.ready = false;
    });
    for (let i = 0; i < 180; i++) {
      if (this.cancelled) throw Error("推理已停止");
      if (exited) {
        const reason = startupFailure(exitCode, spawnError, lastError);
        this.recordFailure(reason, lastError);
        throw Error(reason);
      }
      try {
        const response = await fetch(this.url + "/health", {
          headers: { Authorization: "Bearer " + this.key },
          signal: AbortSignal.timeout(1000),
        });
        if (response.ok) { this.ready = true; this.lastError = null; return; }
      } catch {}
      await new Promise((r) => setTimeout(r, 500));
    }
    this.stop();
    const reason = "AI 加载超时，请关闭占用内存的程序后重试。";
    this.recordFailure(reason, lastError);
    throw Error(reason);
  }
  recordFailure(message, detail = "") {
    this.lastError = message;
    if (this.logFile) {
      try {
        fs.mkdirSync(path.dirname(this.logFile), {recursive:true});
        const log = `${new Date().toISOString()}\n${message}\n${detail}`.replaceAll(this.key, "[redacted]");
        fs.writeFileSync(this.logFile, log.slice(-16000), "utf8");
      } catch {}
    }
  }
  scheduleUnload() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.stop(), 30000);
    this.timer.unref();
  }
  async load() {
    if (this.busy) throw Error("AI 正在运行，请稍候");
    this.busy = true;
    this.cancelled = false;
    clearTimeout(this.timer);
    try { await this.ensure(); return this.status(); }
    catch(error) { this.stop(); if (!this.lastError) this.recordFailure(error.message); throw error; }
    finally { this.busy = false; this.scheduleUnload(); }
  }
  async chat(messages) {
    if (this.busy) throw Error("正在回复，请稍候");
    this.busy = true;
    this.cancelled = false;
    clearTimeout(this.timer);
    try {
      await this.ensure();
      this.controller = new AbortController();
      const timeout = setTimeout(() => this.controller?.abort(), 60000);
      let response;
      try {
        response = await fetch(this.url + "/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + this.key,
          },
          body: JSON.stringify({
            messages,
            max_tokens: 128,
            temperature: 0.7,
            stream: false,
          }),
          signal: this.controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
      if (!response.ok) throw Error("推理失败，请缩短消息或重新加载模型");
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;
      if (typeof text !== "string" || !text.trim())
        throw Error("模型未返回有效回复");
      return { text };
    } catch (error) {
      if (this.cancelled) throw Error("推理已停止");
      this.stop();
      if (!this.lastError) this.recordFailure(error.message);
      throw error;
    } finally {
      this.controller = null;
      this.busy = false;
      this.scheduleUnload();
    }
  }
  cancel() {
    this.cancelled = true;
    this.controller?.abort();
    this.stop();
  }
  stop() {
    clearTimeout(this.timer);
    const child = this.child;
    this.child = null;
    this.ready = false;
    if (child) {
      child.kill();
      const timer = setTimeout(() => {
        if (child.exitCode === null) child.kill("SIGKILL");
      }, 3000);
      timer.unref();
    }
  }
}
function startupFailure(code, error, detail = "") {
  const status = code == null ? null : code >>> 0;
  if (status === 0xc0000135)
    return "AI 引擎缺少 Windows 运行库（0xC0000135）。请使用新版完整安装包，或安装微软 Visual C++ x64 运行库。";
  if (status === 0xc000001d)
    return "AI 引擎使用了电脑不支持的 CPU 指令（0xC000001D）。请使用新版兼容 CPU 引擎。";
  if (status === 0xc000007b)
    return "AI 引擎与 DLL 架构不匹配（0xC000007B），请重新完整解压 Windows x64 安装包。";
  if (error?.code === "ENOENT")
    return "找不到 AI 引擎或依赖文件，请完整解压安装包，并检查安全软件的隔离记录。";
  if (error?.code === "EACCES" || error?.code === "EPERM")
    return "AI 引擎没有运行权限，请检查安装目录权限和安全软件的拦截提示。";
  const concise = detail.trim().split(/\r?\n/).filter(Boolean).slice(-3).join(" · ").slice(-700);
  return `AI 模型加载失败（退出码 ${code ?? error?.code ?? "未知"}）${concise ? "："+concise : "。请检查完整安装包；偏好设置可查看诊断信息。"}`;
}
module.exports = { LocalAI, startupFailure };
