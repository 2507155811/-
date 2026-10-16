const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const net = require("node:net");
class LocalAI {
  constructor(root) {
    this.root = root;
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
      loaded: !!this.child,
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
    if (this.child) return;
    if (!this.status().runtimeAvailable)
      throw Error("本机推理引擎尚未准备，请运行 npm run ai:engine");
    if (!this.status().modelAvailable)
      throw Error("尚未安装模型权重，请准备官方 GGUF 或选择本地模型");
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
      { stdio: ["ignore", "ignore", "pipe"], windowsHide: true },
    );
    this.child = child;
    let lastError = "";
    child.stderr.on(
      "data",
      (d) => (lastError = (lastError + d.toString()).slice(-1500)),
    );
    let exited = false;
    child.on("exit", () => {
      exited = true;
      if (this.child === child) this.child = null;
    });
    child.on("error", () => {
      exited = true;
    });
    for (let i = 0; i < 180; i++) {
      if (this.cancelled) throw Error("推理已停止");
      if (exited) throw Error("模型加载失败：" + lastError.slice(-300));
      try {
        const response = await fetch(this.url + "/health", {
          headers: { Authorization: "Bearer " + this.key },
          signal: AbortSignal.timeout(1000),
        });
        if (response.ok) return;
      } catch {}
      await new Promise((r) => setTimeout(r, 500));
    }
    this.stop();
    throw Error("模型加载超时");
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
      throw error;
    } finally {
      this.controller = null;
      this.busy = false;
      this.timer = setTimeout(() => this.stop(), 30000);
      this.timer.unref();
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
    if (child) {
      child.kill();
      const timer = setTimeout(() => {
        if (child.exitCode === null) child.kill("SIGKILL");
      }, 3000);
      timer.unref();
    }
  }
}
module.exports = { LocalAI };
