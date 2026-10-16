import { test, expect } from "@playwright/test";
test("rendering stops on screen-off, during inference, and when motion is off", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.momoFrameRequests = 0;
    const original = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => {
      window.momoFrameRequests++;
      return original(callback);
    };
  });
  await page.goto("/");
  await page.waitForSelector("canvas");
  await page.waitForTimeout(250);
  const before = await page.evaluate(() => window.momoFrameRequests);
  await page.waitForTimeout(350);
  expect(await page.evaluate(() => window.momoFrameRequests)).toBeGreaterThan(
    before,
  );
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("momo-power", { detail: { paused: true } }),
    ),
  );
  await page.waitForTimeout(100);
  const stopped = await page.evaluate(() => window.momoFrameRequests);
  await page.waitForTimeout(350);
  expect(await page.evaluate(() => window.momoFrameRequests)).toBe(stopped);
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("momo-power", { detail: { paused: false } }),
    ),
  );
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.momoFrameRequests)).toBeGreaterThan(
    stopped,
  );
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent("momo-ai-busy", { detail: true })),
  );
  await page.waitForTimeout(100);
  const busy = await page.evaluate(() => window.momoFrameRequests);
  await page.waitForTimeout(350);
  expect(await page.evaluate(() => window.momoFrameRequests)).toBe(busy);
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent("momo-ai-busy", { detail: false })),
  );
  await page.locator('[data-page="4"]').click();
  await page.locator("#motion-enabled").uncheck();
  await page.locator('[data-page="0"]').click();
  await page.waitForTimeout(200);
  const still = await page.evaluate(() => window.momoFrameRequests);
  await page.waitForTimeout(350);
  expect(await page.evaluate(() => window.momoFrameRequests)).toBe(still);
});
test("web chat preserves the message and reports missing native AI honestly", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('[data-page="2"]').click();
  await page.locator("#chat-input").fill("你好，MOMO");
  await page.locator("#chat-send").click();
  await expect(page.locator("#chat-status")).toContainText("原生版");
  await expect(page.locator(".message.user")).toHaveText("你好，MOMO");
  await expect(page.locator("#messages .message:not(.user)")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".message.user")).toHaveText("你好，MOMO");
});
test('oversized custom mesh is rejected without replacing the companion',async({page})=>{
 await page.goto('/');await page.locator('[data-page="1"]').click();const data=Buffer.alloc(100002*3*4);const model={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0}}]}],buffers:[{uri:'data:application/octet-stream;base64,'+data.toString('base64'),byteLength:data.length}],bufferViews:[{buffer:0,byteLength:data.length}],accessors:[{bufferView:0,componentType:5126,count:100002,type:'VEC3',min:[0,0,0],max:[1,1,1]}]};
 await page.locator('#model-file').setInputFiles({name:'large.gltf',mimeType:'model/gltf+json',buffer:Buffer.from(JSON.stringify(model))});await expect(page.locator('#import-status')).toContainText('节能预算');await expect(page.locator('.pet-label h2 span')).toHaveText('绒角幼兽');
});
