import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("care grows once per daily check-in and survives appearance changes", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#check-in").click();
  await expect(page.locator("#check-in")).toBeDisabled();
  await page.locator("#feed").click();
  await expect(page.locator("#care-snacks")).toHaveText("1");
  await page.locator('[data-page="1"]').click();
  await page.locator('[data-model="1"]').click();
  await page.reload();
  await expect(page.locator("#care-visits")).toHaveText("1");
  await expect(page.locator("#care-snacks")).toHaveText("1");
  await expect(page.locator("#check-in")).toBeDisabled();
  await expect(page.locator("#badges .earned")).toHaveCount(1);
});
test("focus supports pause, reload and exactly-once completion", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-16T08:00:00Z") });
  await page.goto("/");
  await page.locator('[data-page="3"]').click();
  await page.locator("#focus-duration").selectOption("1");
  await page.locator("#focus-start").click();
  await page.clock.runFor(20000);
  await expect(page.locator("#focus-time")).toHaveText("00:40");
  await page.locator("#focus-start").click();
  await page.clock.runFor(10000);
  await expect(page.locator("#focus-time")).toHaveText("00:40");
  await page.locator("#focus-start").click();
  await page.reload();
  await page.locator('[data-page="3"]').click();
  await page.clock.runFor(41000);
  await expect(page.locator("#focus-status")).toContainText("完成了");
  await expect(page.locator("#care-focus")).toHaveText("1");
  await page.reload();
  await expect(page.locator("#care-focus")).toHaveText("1");
});
test("todo reminders fire once and completion persists", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-16T08:00:00Z") });
  await page.goto("/");
  await page.locator('[data-page="3"]').click();
  await page.locator("#todo-title").fill("<img src=x onerror=alert(1)>");
  await page.locator("#todo-due").fill(
    await page.evaluate(() => {
      const d = new Date(Date.now() + 60000);
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
    }),
  );
  await page.locator("#todo-form button").click();
  await page.clock.runFor(61000);
  await expect(page.locator("#toast")).toContainText("时间到啦");
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("momo-planner")).tasks[0].notified,
    ),
  ).toBe(true);
  await page.locator(".todo-item input").check();
  await page.reload();
  await page.locator('[data-page="3"]').click();
  await expect(page.locator(".todo-item input")).toBeChecked();
  await page.locator("#clear-done").click();
  await expect(page.locator("#todo-empty")).toBeVisible();
});
test("backup round trip, undo and invalid backup rejection", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#wave").click();
  await page.locator('[data-page="4"]').click();
  await page.locator("#memory-notes").fill("原来的记忆");
  await page.locator("#save-memory").click();
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#export-backup").click();
  const download = await downloadPromise;
  const backup = await readFile(await download.path());
  expect(JSON.parse(backup).app).toBe("MOMO");
  await page.locator("#memory-notes").fill("恢复前的新记忆");
  await page.locator("#save-memory").click();
  await page.locator("#import-backup").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: backup,
  });
  await expect(page.locator("#restore-dialog")).toBeVisible();
  await page.locator("#confirm-restore").click();
  await page.waitForLoadState("domcontentloaded");
  await expect(page.locator("#memory-notes")).toHaveValue("原来的记忆");
  await page.locator('[data-page="4"]').click();
  await page.locator("#undo-restore").click();
  await page.waitForLoadState("domcontentloaded");
  await expect(page.locator("#memory-notes")).toHaveValue("恢复前的新记忆");
  await page.locator('[data-page="4"]').click();
  const invalid = {
    app: "MOMO",
    version: 1,
    records: { "momo-memory": { notes: 42, messages: [] } },
  };
  await page.locator("#import-backup").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(invalid)),
  });
  await expect(page.locator("#backup-status")).toContainText("恢复失败");
  await expect(page.locator("#restore-dialog")).not.toBeVisible();
  await expect(page.locator("#memory-notes")).toHaveValue("恢复前的新记忆");
});
test("performance preferences and pages fit mobile", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await page.locator('[data-page="4"]').click();
  await page.locator("#render-fps").selectOption("15");
  await page.locator("#motion-enabled").uncheck();
  await page.reload();
  await expect(page.locator("#render-fps")).toHaveValue("15");
  await expect(page.locator("#motion-enabled")).not.toBeChecked();
  for (const id of [0, 1, 2, 3, 4]) {
    await page.locator(`[data-page="${id}"]`).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});
test("failed backup restore rolls back earlier writes", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { restoreBackup } = await import("/companion-data.js");
    const before = localStorage.getItem("momo-settings");
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "momo-memory" && value.includes("模拟存储失败"))
        throw new DOMException("Full", "QuotaExceededError");
      return original.call(this, key, value);
    };
    let rejected = false;
    try {
      restoreBackup({
        app: "MOMO",
        version: 1,
        records: {
          "momo-settings": { name: "临时昵称", quiet: false, size: 100 },
          "momo-memory": { notes: "模拟存储失败", messages: [] },
        },
      });
    } catch {
      rejected = true;
    } finally {
      Storage.prototype.setItem = original;
    }
    return {
      rejected,
      unchanged: before === localStorage.getItem("momo-settings"),
      memoryUnchanged: localStorage.getItem("momo-memory") === null,
    };
  });
  expect(result).toEqual({
    rejected: true,
    unchanged: true,
    memoryUnchanged: true,
  });
});
