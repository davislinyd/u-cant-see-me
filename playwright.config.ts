import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  // Each test starts an unpacked extension and targets its active window.
  // Serial execution avoids Chromium extension-window focus races.
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "python3 -m http.server 4173 --directory tests/fixtures",
    url: "http://127.0.0.1:4173/basic.html",
    reuseExistingServer: true,
  },
});
