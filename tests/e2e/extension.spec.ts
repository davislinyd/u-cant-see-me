import { expect, test, chromium } from "@playwright/test";
import { resolve } from "node:path";

test("loads the unpacked MV3 extension and its extension pages", async ({ baseURL }) => {
  const extensionPath = resolve(process.cwd(), "dist");
  const context = await chromium.launchPersistentContext("", {
    headless: false,
    ignoreDefaultArgs: ["--disable-extensions"],
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  try {
    const page = await context.newPage();
    await page.goto(`${baseURL}/basic.html`);
    await expect(page.locator("h1")).toHaveText("U Cant See Me fixture");

    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker", { timeout: 10_000 });
    const extensionId = new URL(worker.url()).host;

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(popup.locator("h1")).toHaveText("Privacy protection");
    await expect(popup.locator("#select-elements")).toBeVisible();

    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/options.html`);
    await expect(options.locator("h1")).toHaveText("Manage masks");
  } finally {
    await context.close();
  }
});
