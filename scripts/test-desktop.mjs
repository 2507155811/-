import { _electron, expect } from "@playwright/test";
import { createRequire } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
const require = createRequire(import.meta.url),
  profile = await mkdtemp(path.join(os.tmpdir(), "momo-desktop-"));
let app;
try {
  app = await _electron.launch({
    executablePath: require("electron"),
    args: [
      ...(process.platform === "linux"
        ? [
            "--no-sandbox",
            "--ozone-platform=headless",
            "--enable-unsafe-swiftshader",
          ]
        : []),
      process.cwd(),
      "--momo-smoke",
    ],
    env: { ...process.env, MOMO_PROFILE_DIR: profile },
  });
  const page = await app.firstWindow();
  await page.setViewportSize({ width: 1180, height: 850 });
  await page.waitForSelector("canvas");
  await page.locator('[data-page="4"]').click();
  await page.locator("#native-show").click();
  await expect.poll(() => app.windows().length).toBe(2);
  const pet = app.windows().find((w) => w !== page);
  await pet.setViewportSize({ width: 360, height: 450 });
  await pet.waitForSelector(".native-pet");
  await page.locator("#memory-notes").fill("换模型和窗口不改变记忆");
  await page.locator("#save-memory").click();
  await pet.locator("#wave").click();
  await expect(page.locator("#touches")).toHaveText("1");
  await expect(page.locator("#memory-notes")).toHaveValue(
    "换模型和窗口不改变记忆",
  );
  await page.locator("#native-pass").check();
  expect(
    (await page.evaluate(() => window.momoDesktop.status())).clickThrough,
  ).toBe(true);
  await page.locator("#native-pass").uncheck();
  await page.locator("#native-hide").click();
  expect(
    (await page.evaluate(() => window.momoDesktop.status())).petVisible,
  ).toBe(false);
  const ai = await page.evaluate(() => window.momoDesktop.aiStatus());
  console.log(
    "Desktop smoke passed: shared memory, IPC, pet view, click-through control; AI engine available:",
    ai.runtimeAvailable,
  );
  console.log(
    "Headless Linux does not validate Windows/macOS compositor behavior.",
  );
} finally {
  await app?.close();
  await rm(profile, { recursive: true, force: true });
}
