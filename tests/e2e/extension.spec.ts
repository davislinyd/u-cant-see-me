import { expect, test, chromium } from "@playwright/test";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

test("loads the unpacked MV3 extension and its extension pages", async ({ baseURL }) => {
  const extensionPath = await createE2eExtension();
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
    await rm(extensionPath, { recursive: true, force: true });
  }
});

test("selects multiple elements, applies each mask style, and restores masks after reload", async ({ baseURL }) => {
  const extensionPath = await createE2eExtension();
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
    const tabId = await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return tab?.id;
    });
    expect(tabId).toBeDefined();

    const extensionId = new URL(worker.url()).host;
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.bringToFront();
    const activeTabIdFromPopup = await popup.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return tab?.id;
    });
    expect(activeTabIdFromPopup).toBe(tabId);
    await popup.evaluate(() => document.querySelector<HTMLButtonElement>("#select-elements")?.click());
    await expect(page.locator("[data-u-cant-see-me-ui]")).toBeAttached();

    await selectAndSave(page, worker, tabId as number, ["#private-card", "#fixture-button"], "black", true, 2);
    await expect(page.locator("#private-card")).toContainText("Sensitive-looking synthetic content.");

    await selectAndSave(page, worker, tabId as number, ["#fixture-input"], "white", false, 3);
    await selectAndSave(page, worker, tabId as number, ["#flex-item-one"], "blur", false, 3);
    await selectAndSave(page, worker, tabId as number, ["#grid-item-one"], "mosaic", false, 4);
    await expect(page.locator(".u-cant-see-me-mask-overlay")).toHaveCount(4);

    await page.reload();
    await expect(page.locator("[data-u-cant-see-me-ready]")).toBeAttached({ timeout: 10_000 });
    await expect(page.locator(".u-cant-see-me-mask-overlay")).toHaveCount(4, { timeout: 10_000 });
    await expect(page.locator("#private-card")).toContainText("Sensitive-looking synthetic content.");
  } finally {
    await context.close();
    await rm(extensionPath, { recursive: true, force: true });
  }
});

test("self-heals a saved mask through dynamic SPA rendering and route changes", async ({ baseURL }) => {
  const extensionPath = await createE2eExtension();
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
    await page.goto(`${baseURL}/spa.html`);
    await expect(page.locator("h1")).toHaveText("U Cant See Me SPA fixture");
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker", { timeout: 10_000 });
    const tabId = await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return tab?.id;
    });
    expect(tabId).toBeDefined();

    await selectAndSave(page, worker, tabId as number, ["#resilient-target"], "black", false, 1);

    await page.locator("#replace-target").click();
    await expect(page.locator("#resilient-target-v2")).toBeVisible();
    await expect(page.locator(".u-cant-see-me-mask-overlay")).toHaveCount(1);

    await page.locator("#replace-parent").click();
    await expect(page.locator("#resilient-target-v3")).toBeVisible();
    await expect(page.locator(".u-cant-see-me-mask-overlay")).toHaveCount(1);

    await page.locator("#delay-target").click();
    await expect(page.locator(".u-cant-see-me-mask-overlay")).toHaveCount(0);
    await expect(page.locator("#resilient-target-delayed")).toBeVisible();
    await expect(page.locator(".u-cant-see-me-mask-overlay")).toHaveCount(1);

    await page.locator("#reorder-list").click();
    await expect(page.locator(".virtual-list")).toContainText("Row three");
    await expect(page.locator(".u-cant-see-me-mask-overlay")).toHaveCount(1);

    await page.locator("#resize-target").click();
    await expect.poll(async () => page.locator("[data-resilient-target]").evaluate((target) => (target as HTMLElement).style.width)).toBe("360px");
    const targetWidth = await page.locator("[data-resilient-target]").evaluate((target) => Math.round(target.getBoundingClientRect().width));
    await expect.poll(async () => page.locator(".u-cant-see-me-mask-overlay").evaluate((overlay) => Math.round(overlay.getBoundingClientRect().width))).toBe(targetWidth);

    await page.locator("#go-away").click();
    await expect(page).toHaveURL(`${baseURL}/spa-other`);
    await expect(page.locator(".u-cant-see-me-mask-overlay")).toHaveCount(0);

    await page.locator("#go-back").click();
    await expect(page).toHaveURL(`${baseURL}/spa.html`);
    await expect(page.locator("#resilient-target-route")).toBeVisible();
    await expect(page.locator(".u-cant-see-me-mask-overlay")).toHaveCount(1);
  } finally {
    await context.close();
    await rm(extensionPath, { recursive: true, force: true });
  }
});

async function createE2eExtension(): Promise<string> {
  const sourcePath = resolve(process.cwd(), "dist");
  const extensionPath = await mkdtemp(resolve(tmpdir(), "u-cant-see-me-e2e-"));
  await cp(sourcePath, extensionPath, { recursive: true });
  const manifestPath = resolve(extensionPath, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
  manifest.host_permissions = ["http://127.0.0.1:4173/*"];
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return extensionPath;
}

async function selectAndSave(
  page: import("@playwright/test").Page,
  worker: import("@playwright/test").Worker,
  tabId: number,
  selectors: string[],
  style: "black" | "white" | "blur" | "mosaic",
  alreadyStarted = false,
  expectedMaskCount = selectors.length,
): Promise<void> {
  if (!alreadyStarted) {
    const response = await worker.evaluate(async (currentTabId) => {
      await chrome.scripting.executeScript({ target: { tabId: currentTabId }, files: ["content.js"] });
      return chrome.tabs.sendMessage(currentTabId, { type: "START_SELECTION" });
    }, tabId);
    expect(response).toMatchObject({ ok: true, data: true });
  }
  await expect(page.locator("[data-u-cant-see-me-ui]")).toBeAttached();

  for (const [index, selector] of selectors.entries()) {
    await page.locator(selector).click({ modifiers: index === 0 ? [] : ["Shift"] });
  }

  await page.locator('select[aria-label="Mask style"]').selectOption(style);
  await expect(page.locator(".u-cant-see-me-selection-count")).toHaveText(`${selectors.length} selected`);
  await page.getByRole("button", { name: "Save masks" }).click();
  await expect(page.locator(".u-cant-see-me-selection-toolbar")).toHaveCount(0);
  await expect(page.locator(".u-cant-see-me-mask-overlay")).toHaveCount(expectedMaskCount);
}
