import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  copyFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
const spec = JSON.parse(readFileSync("ai/runtime-lock.json", "utf8")).model;
const source = path.resolve("ai-assets", spec.file);
if (!existsSync(source)) {
  if (process.argv.includes("--optional")) {
    console.log("UI-only Android build: model weights are not bundled.");
    process.exit(0);
  }
  console.error(
    "Model weights missing. Run npm run ai:model after allowing the official model download domains.",
  );
  process.exit(1);
}
const digest = createHash("sha256");
for await (const chunk of createReadStream(source)) digest.update(chunk);
if (digest.digest("hex") !== spec.sha256)
  throw Error("Model checksum mismatch; refusing to bundle");
if (!existsSync("ai-assets/MODEL-LICENSE"))
  throw Error("Model license file missing");
const target = "android/app/src/main/assets/ai";
mkdirSync(target, { recursive: true });
copyFileSync(source, path.join(target, spec.file));
copyFileSync("ai-assets/MODEL-LICENSE", path.join(target, "MODEL-LICENSE"));
copyFileSync("ai/runtime-lock.json", path.join(target, "runtime-lock.json"));
console.log("Verified model bundled for Android.");
