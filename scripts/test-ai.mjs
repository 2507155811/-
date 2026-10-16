import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  { LocalAI } = require("../desktop/ai.cjs");
const ai = new LocalAI(process.cwd());
const start = Date.now();
try {
  assert.equal(
    ai.status().modelAvailable,
    true,
    "Verified model must be prepared first",
  );
  const greeting = await ai.chat([
    { role: "system", content: "你是桌面宠物MOMO，用简短自然的中文回答。" },
    { role: "user", content: "请用一句话跟我打个招呼。" },
  ]);
  assert.match(greeting.text, /[\u4e00-\u9fff]/);
  console.log("Chinese greeting:", greeting.text);
  const memory = await ai.chat([
    {
      role: "system",
      content: "你是MOMO。你记得用户叫小林，喜欢喝红茶。请根据记忆简短回答。",
    },
    { role: "user", content: "我喜欢喝什么？只回答饮品名称。" },
  ]);
  assert.match(memory.text, /红茶/);
  console.log("Memory recall:", memory.text);
  const request = ai.chat([
    { role: "user", content: "请写一篇很长的关于星星的故事，尽可能详细。" },
  ]);
  await assert.rejects(
    ai.chat([{ role: "user", content: "第二个请求" }]),
    /正在回复/,
  );
  while (!ai.controller && ai.busy)
    await new Promise((resolve) => setTimeout(resolve, 10));
  ai.cancel();
  await assert.rejects(request, /已停止/);
  assert.equal(ai.status().loaded, false);
  console.log("Concurrent request guard and cancellation: passed");
  const after = await ai.chat([
    { role: "system", content: "用中文简短回答。" },
    { role: "user", content: "一加一等于几？" },
  ]);
  assert.match(after.text, /2|二|两/);
  console.log("Restart after cancellation:", after.text);
  const processRef = ai.child;
  console.log("Waiting for the real 30-second idle unload…");
  await new Promise((resolve) => setTimeout(resolve, 31000));
  assert.equal(ai.status().loaded, false);
  assert.equal(ai.status().busy, false);
  assert.ok(
    processRef.exitCode !== null || processRef.signalCode !== null,
    "The native process must actually exit",
  );
  console.log(
    "PASS: real GGUF inference, memory prompt, cancellation, restart, idle unload. Elapsed seconds:",
    Math.round((Date.now() - start) / 1000),
  );
} finally {
  ai.cancel();
}
