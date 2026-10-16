import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5180",
    launchOptions: {
      ...(process.env.CHROMIUM_PATH
        ? { executablePath: process.env.CHROMIUM_PATH }
        : {}),
      args: ["--enable-unsafe-swiftshader"],
    },
  },
  webServer: [
    {
      command: "npm run dev -- --port 5180 --strictPort",
      url: "http://127.0.0.1:5180",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "npm run build && npm run preview -- --port 5181 --strictPort",
      url: "http://127.0.0.1:5181",
      reuseExistingServer: !process.env.CI,
    },
  ],
});
