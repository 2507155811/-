import { packager } from "@electron/packager";
import { mkdir, cp, readFile, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
const uiOnly = process.argv.includes("--ui-only"),
  platform = process.platform,
  arch = process.arch,
  stage = path.resolve("artifacts/package-input");
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
if(existsSync('ai-assets')){const spec=JSON.parse(await readFile('ai/runtime-lock.json','utf8')).model;await mkdir(path.join(stage,'ai-assets'),{recursive:true});for(const name of [spec.file,'MODEL-LICENSE','manifest.json'])if(existsSync(path.join('ai-assets',name)))await cp(path.join('ai-assets',name),path.join(stage,'ai-assets',name));}
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
await rm(stage, { recursive: true, force: true });
console.log("Desktop package:", out.join(", "));
if (uiOnly)
  console.log(
    "UI-only package: AI engine included; model weights are not bundled.",
  );
