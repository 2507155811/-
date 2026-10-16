import { spawnSync } from "node:child_process";
import path from "node:path";
const env = {
  ...process.env,
  electron_config_cache: path.resolve(".cache/electron"),
};
if (env.HTTPS_PROXY) {
  env.NODE_USE_ENV_PROXY = "1";
  env.ELECTRON_GET_USE_PROXY = "1";
}
const result = spawnSync(
  process.execPath,
  ["node_modules/electron/install.js"],
  { env, stdio: "inherit" },
);
process.exit(result.status ?? 1);
