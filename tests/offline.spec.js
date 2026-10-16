import { test, expect } from "@playwright/test";
test.use({ baseURL: "http://127.0.0.1:5181" });
test("production app restores its shell and local memory offline", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.locator('[data-page="4"]').click();
  await expect(page.locator("#offline-status")).toContainText(
    "离线资源已准备好",
  );
  await page.locator("#memory-notes").fill("离线也保留我们的记忆");
  await page.locator("#save-memory").click();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("canvas")).toBeVisible();
  await page.locator('[data-page="4"]').click();
  await expect(page.locator("#memory-notes")).toHaveValue(
    "离线也保留我们的记忆",
  );
  await page.locator('[data-page="3"]').click();
  await page.locator("#todo-title").fill("离线读书");
  await page.locator("#todo-form button").click();
  await expect(page.locator(".todo-item strong")).toHaveText("离线读书");
  await page.reload();
  await page.locator('[data-page="3"]').click();
  await expect(page.locator(".todo-item strong")).toHaveText("离线读书");
});
