import { packager } from "@electron/packager";
import { mkdir, cp, readFile, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
const uiOnly = process.argv.includes("--ui-only"),
  platform =
    process.argv.find((arg) => arg.startsWith("--platform="))?.split("=")[1] ||
    process.platform,
  arch =
    process.argv.find((arg) => arg.startsWith("--arch="))?.split("=")[1] ||
    process.arch,
  stage = path.resolve("artifacts/package-input");
if (
  !["linux", "win32", "darwin"].includes(platform) ||
  !["x64", "arm64"].includes(arch)
)
  throw Error("Unsupported target platform/architecture");
if (!uiOnly) {
  const check = spawnSync(process.execPath, ["scripts/package-model.mjs"], {
    stdio: "inherit",
  });
  if (check.status !== 0) process.exit(check.status ?? 1);
}
if (!existsSync(`ai-runtime/${platform}-${arch}`))
  throw Error(
    "Build the native engine with npm run ai:engine before packaging.",
  );
await rm(stage, { recursive: true, force: true });
await mkdir(stage, { recursive: true });
for (const name of ["desktop", "dist"])
  await cp(name, path.join(stage, name), { recursive: true });
await cp(
  `ai-runtime/${platform}-${arch}`,
  path.join(stage, "ai-runtime", `${platform}-${arch}`),
  { recursive: true },
);
if (existsSync("ai-assets")) {
  const spec = JSON.parse(await readFile("ai/runtime-lock.json", "utf8")).model;
  await mkdir(path.join(stage, "ai-assets"), { recursive: true });
  for (const name of [spec.file, "MODEL-LICENSE", "manifest.json"])
    if (existsSync(path.join("ai-assets", name)))
      await cp(
        path.join("ai-assets", name),
        path.join(stage, "ai-assets", name),
      );
}
const pkg = JSON.parse(await readFile("package.json", "utf8"));
await writeFile(
  path.join(stage, "package.json"),
  JSON.stringify({
    name: "momo-companion",
    productName: "MOMO",
    version: pkg.version,
    main: "desktop/main.cjs",
    description: "A local 3D companion",
    license: "UNLICENSED",
  }),
);
const out = await packager({
  dir: stage,
  name: "MOMO",
  platform,
  arch,
  out: path.resolve("artifacts/desktop"),
  overwrite: true,
  asar: false,
  prune: false,
  download: { cacheRoot: path.resolve(".cache/electron") },
});
if (platform === "win32")
  for (const folder of out)
    await writeFile(
      path.join(folder, "首次使用说明.txt"),
      "\ufeffMOMO Windows 64 位便携版（内置 Qwen AI）\r\n\r\n1. 将整个文件夹解压到固定位置。不要只复制 MOMO.exe。\r\n2. 双击 MOMO.exe，进入偏好设置可显示桌面宠物。\r\n3. AI 权重已内置，可离线对话。首次加载需要一点时间。\r\n4. 如果 AI 启动提示缺少 VCRUNTIME140 / MSVCP140，请安装微软官方 Visual C++ x64 运行库后重试：\r\nhttps://aka.ms/vs/17/release/vc_redist.x64.exe\r\n\r\n该包已完成文件、模型校验，尚未在 Windows 实机验证。\r\n",
    );
await rm(stage, { recursive: true, force: true });
console.log("Desktop package:", out.join(", "));
if (uiOnly)
  console.log(
    "UI-only package: AI engine included; model weights are not bundled.",
  );
