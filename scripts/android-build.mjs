import { spawnSync } from "node:child_process";
import path from "node:path";
const env = { ...process.env };
if (!env.ANDROID_HOME && !env.ANDROID_SDK_ROOT) {
  console.error("Set ANDROID_HOME to the installed Android SDK directory.");
  process.exit(1);
}
if (env.HTTPS_PROXY) {
  const proxy = new URL(env.HTTPS_PROXY);
  env.GRADLE_OPTS =
    (env.GRADLE_OPTS || "") +
    ` -Dhttps.proxyHost=${proxy.hostname} -Dhttps.proxyPort=${proxy.port || 80} -Dhttp.proxyHost=${proxy.hostname} -Dhttp.proxyPort=${proxy.port || 80}`;
}
const command = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
const result = spawnSync(
  command,
  ["assembleDebug", "--no-daemon", "--max-workers=2"],
  {
    cwd: path.resolve("android"),
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  },
);
process.exit(result.status ?? 1);
