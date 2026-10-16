import { spawnSync } from "node:child_process";
import { readFileSync, mkdirSync, existsSync, cpSync } from "node:fs";
import path from "node:path";
const spec = JSON.parse(readFileSync("ai/runtime-lock.json", "utf8")),
  source = path.resolve("vendor/llama.cpp"),
  output = path.resolve("ai-runtime", process.platform + "-" + process.arch);
function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { stdio: "inherit", ...options });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
mkdirSync("vendor", { recursive: true });
if (!existsSync(source))
  run("git", [
    "clone",
    "--filter=blob:none",
    "--no-checkout",
    spec.repository,
    source,
  ]);
const head = spawnSync("git", ["rev-parse", "HEAD"], {
  cwd: source,
  encoding: "utf8",
}).stdout?.trim();
if (head !== spec.commit) {
  run("git", ["fetch", "--depth", "1", "origin", spec.commit], { cwd: source });
  run("git", ["checkout", "--detach", spec.commit], { cwd: source });
}
if (!process.argv.includes("--source-only")) {
  const build = path.resolve("vendor/llama-build");
  run(process.env.CMAKE || "cmake", [
    "-S",
    source,
    "-B",
    build,
    "-DCMAKE_BUILD_TYPE=Release",
    "-DBUILD_SHARED_LIBS=OFF",
    "-DGGML_NATIVE=OFF",
    "-DGGML_OPENMP=OFF",
    "-DGGML_BACKEND_DL=OFF",
    ...(process.platform === "win32" ? [
      "-DCMAKE_MSVC_RUNTIME_LIBRARY=MultiThreaded",
      "-DGGML_AVX=OFF", "-DGGML_AVX2=OFF", "-DGGML_FMA=OFF", "-DGGML_F16C=OFF", "-DGGML_SSE42=OFF", "-DGGML_BMI2=OFF",
    ] : []),
    "-DLLAMA_BUILD_TESTS=OFF",
    "-DLLAMA_BUILD_EXAMPLES=OFF",
    "-DLLAMA_OPENSSL=OFF",
  ]);
  run(process.env.CMAKE || "cmake", [
    "--build",
    build,
    "--config",
    "Release",
    "--target",
    "llama-server",
    "-j",
    "2",
  ]);
  mkdirSync(output, { recursive: true });
  const bin =
    process.platform === "win32" ? "llama-server.exe" : "llama-server";
  const sourceBin = existsSync(path.join(build, "bin/Release", bin))
    ? path.join(build, "bin/Release", bin)
    : path.join(build, "bin", bin);
  cpSync(sourceBin, path.join(output, bin));
  cpSync(path.join(source, "LICENSE"), path.join(output, "LLAMA-LICENSE"));
}
