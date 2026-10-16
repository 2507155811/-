import { _electron, expect } from "@playwright/test";
import { createRequire } from "node:module";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
const require = createRequire(import.meta.url),
  profile = await mkdtemp(path.join(os.tmpdir(), "momo-real-ai-"));
let app;
try {
  await mkdir(path.join(profile, "cache"));
  app = await _electron.launch({
    executablePath: process.env.MOMO_DESKTOP_EXECUTABLE||require("electron"),
    args: [
      ...(process.platform === "linux"
        ? [
            "--no-sandbox",
            "--ozone-platform=headless",
            "--enable-unsafe-swiftshader",
          ]
        : []),
      ...(!process.env.MOMO_DESKTOP_EXECUTABLE?[process.cwd()]:[]),
      "--momo-smoke",
    ],
    env: {
      ...process.env,
      MOMO_PROFILE_DIR: profile,
      XDG_CACHE_HOME: path.join(profile, "cache"),
    },
  });
  const page = await app.firstWindow();
  await page.setViewportSize({ width: 1180, height: 850 });
  await page.waitForSelector("canvas");
  await page.locator('[data-page="4"]').click();
  await page.locator("#memory-notes").fill("用户喜欢喝红茶。");
  await page.locator("#save-memory").click();
  await page.locator('[data-page="2"]').click();
  await page.locator("#chat-input").fill("我喜欢喝什么？请只回答饮品名。");
  await page.locator("#chat-send").click();
  await expect(page.locator("#chat-status")).toContainText("本地回复完成", {
    timeout: 90000,
  });
  await expect(
    page.locator("#messages .message:not(.user)").last(),
  ).toContainText("红茶");
  const before = await page.evaluate(() => localStorage.getItem("momo-memory"));
  await page.locator('[data-page="1"]').click();
  await page.locator('[data-model="2"]').click();
  await page.reload();
  expect(await page.evaluate(() => localStorage.getItem("momo-memory"))).toBe(
    before,
  );
  await page.locator('[data-page="4"]').click();
  await page.locator("#ai-unload").click();
  await expect(page.locator("#ai-status")).toContainText("待命");
  console.log(
    "PASS: real Electron IPC conversation, persistent memory, appearance switching, unload control.",
  );
} finally {
  await app?.close();
  await rm(profile, { recursive: true, force: true });
}
