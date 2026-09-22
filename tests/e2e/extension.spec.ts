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

test("keeps icon-button selections exact across all mask styles", async ({ baseURL }) => {
  const extensionPath = await createE2eExtension();
  const context = await chromium.launchPersistentContext("", {
    headless: false,
    ignoreDefaultArgs: ["--disable-extensions"],
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });

  try {
    const page = await context.newPage();
    await page.goto(`${baseURL}/it-center-controls.html`);
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker", { timeout: 10_000 });
    const tabId = await worker.evaluate(async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id);
    expect(tabId).toBeDefined();
    const buttons = "#ticket-actions button";
    await selectAndSave(page, worker, tabId as number, [`${buttons}:nth-of-type(1) svg`, `${buttons}:nth-of-type(2) svg`], "black", false, 2);
    await selectAndSave(page, worker, tabId as number, [`${buttons}:nth-of-type(3) svg`, `${buttons}:nth-of-type(4) svg`], "white", false, 4);
    await selectAndSave(page, worker, tabId as number, [`${buttons}:nth-of-type(5) svg`, `${buttons}:nth-of-type(6) svg`], "blur", false, 4);
    await selectAndSave(page, worker, tabId as number, [`${buttons}:nth-of-type(7) svg`, `${buttons}:nth-of-type(8) svg`], "mosaic", false, 6);
    await expect(page.locator('.u-cant-see-me-mask-overlay[data-mask-type="black"]')).toHaveCount(2);
    await expect(page.locator('.u-cant-see-me-mask-overlay[data-mask-type="white"]')).toHaveCount(2);
    await expect(page.locator('.u-cant-see-me-mask-overlay[data-mask-type="mosaic"]')).toHaveCount(2);
    await expect.poll(async () => page.locator(`${buttons}:nth-of-type(5)`).evaluate((element) => (element as HTMLElement).style.filter)).toBe("blur(14px)");
    await expect.poll(async () => page.locator(`${buttons}:nth-of-type(6)`).evaluate((element) => (element as HTMLElement).style.filter)).toBe("blur(14px)");

    await page.reload();
    await expect(page.locator('.u-cant-see-me-mask-overlay[data-mask-type="black"]')).toHaveCount(2);
    await expect(page.locator('.u-cant-see-me-mask-overlay[data-mask-type="white"]')).toHaveCount(2);
    await expect(page.locator('.u-cant-see-me-mask-overlay[data-mask-type="mosaic"]')).toHaveCount(2);
    await expect.poll(async () => page.locator(`${buttons}:nth-of-type(5)`).evaluate((element) => (element as HTMLElement).style.filter)).toBe("blur(14px)");
    await expect.poll(async () => page.locator(`${buttons}:nth-of-type(6)`).evaluate((element) => (element as HTMLElement).style.filter)).toBe("blur(14px)");

    const extensionId = new URL(worker.url()).host;
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    const disabled = await popup.evaluate(async (currentTabId) => {
      return chrome.runtime.sendMessage({ type: "MANAGE_PAGE_RULES", action: "disable-page", tabId: currentTabId });
    }, tabId as number);
    expect(disabled).toMatchObject({ ok: true });
    await expect(page.locator(".u-cant-see-me-mask-overlay")).toHaveCount(0);
    await expect.poll(async () => page.locator(`${buttons}:nth-of-type(5)`).evaluate((element) => (element as HTMLElement).style.filter)).toBe("");
    await expect.poll(async () => page.locator(`${buttons}:nth-of-type(6)`).evaluate((element) => (element as HTMLElement).style.filter)).toBe("");
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

test("guards document start, then supports temporary reveal, relock, and print protection", async ({ baseURL }) => {
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
    await page.goto(`${baseURL}/gate.html`);
    await expect(page.locator("h1")).toHaveText("U Cant See Me Privacy Gate fixture");
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker", { timeout: 10_000 });
    const tabId = await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return tab?.id;
    });
    expect(tabId).toBeDefined();

    await selectAndSave(page, worker, tabId as number, ["#gate-target"], "black", false, 1);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("html[data-u-cant-see-me-privacy-gate]")).toBeAttached();
    await expect(page.locator("#gate-target")).toBeVisible();
    await expect(page.locator(".u-cant-see-me-mask-overlay")).toHaveCount(1);
    await expect(page.locator("html[data-u-cant-see-me-privacy-gate]")).toHaveCount(0);

    const activeWorker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker", { timeout: 10_000 });
    const revealResponse = await activeWorker.evaluate(async (currentTabId) => {
      return chrome.tabs.sendMessage(currentTabId, { type: "REVEAL_ALL", durationMs: 10_000 });
    }, tabId);
    expect(revealResponse).toMatchObject({ ok: true });
    await expect(page.locator(".u-cant-see-me-mask-overlay")).toHaveCount(0);
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await expect(page.locator(".u-cant-see-me-mask-overlay")).toHaveCount(1);

    const timerResponse = await activeWorker.evaluate(async (currentTabId) => {
      return chrome.tabs.sendMessage(currentTabId, { type: "REVEAL_ALL", durationMs: 5_000 });
    }, tabId);
    expect(timerResponse).toMatchObject({ ok: true });
    await expect(page.locator(".u-cant-see-me-mask-overlay")).toHaveCount(0);
    await expect(page.locator(".u-cant-see-me-mask-overlay")).toHaveCount(1, { timeout: 6_500 });

    await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
    await expect.poll(async () => page.locator("#gate-target").evaluate((target) => (target as HTMLElement).style.opacity)).toBe("0");
    await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
    await expect.poll(async () => page.locator("#gate-target").evaluate((target) => (target as HTMLElement).style.opacity)).toBe("");
  } finally {
    await context.close();
    await rm(extensionPath, { recursive: true, force: true });
  }
});

test("protects synthetic Gmail surfaces through reload, route changes, replacement, and unresolved guard", async ({ baseURL }) => {
  const extensionPath = await createE2eExtension();
  const context = await chromium.launchPersistentContext("", {
    headless: false,
    ignoreDefaultArgs: ["--disable-extensions"],
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });

  try {
    const page = await context.newPage();
    await page.goto(`${baseURL}/gmail-multi-message-thread.html#inbox/thread_alpha1`);
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker", { timeout: 10_000 });
    const tabId = await worker.evaluate(async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id);
    expect(tabId).toBeDefined();
    await worker.evaluate(async (currentTabId) => {
      await chrome.scripting.executeScript({ target: { tabId: currentTabId }, files: ["content.js"] });
      return chrome.tabs.sendMessage(currentTabId, {
        type: "CREATE_GMAIL_RULE",
        style: { type: "black" },
        target: { maskThreadSubject: true, maskMessageBody: true, maskCollapsedPreview: true, maskListSubject: true, maskListSnippet: true },
      });
    }, tabId as number);
    await expect(page.locator(".u-cant-see-me-mask-overlay")).toHaveCount(7);

    await page.reload();
    await expect(page.locator(".u-cant-see-me-mask-overlay")).toHaveCount(7);

    await page.evaluate(() => {
      history.pushState({}, "", "#inbox");
      document.body.innerHTML = `<main role="main"><table><tr><td class="yX"><span class="yP">fixture list sender</span></td><td><div class="y6"><span class="bog">fixture list subject</span><span data-thread-id="thread_alpha1"></span></div><span class="y2">fixture list snippet</span></td></tr></table><h2 class="hP" data-legacy-thread-id="thread_other2">other conversation subject</h2><article data-message-id="message_other2"><span class="gD">other sender</span><div class="a3s aiL" style="position: relative">other body</div></article></main>`;
    });
    await expect(page.locator(".u-cant-see-me-mask-overlay")).toHaveCount(3);
    await expect(page.locator(".a3s.aiL")).not.toHaveAttribute("data-u-cant-see-me-renderer", "pseudo-layer");

    await page.evaluate(() => {
      history.pushState({}, "", "#inbox/thread_alpha1");
      document.body.innerHTML = `<main data-thread-id="thread_alpha1"><h2 data-gmail-thread-subject>fixture subject replacement</h2><article data-message-id="message_one01"><div data-gmail-message-body>one replacement</div></article><article data-message-id="message_two02"><div data-gmail-message-body>two replacement</div></article><article data-message-id="message_three3"><div data-gmail-message-body>three replacement</div></article></main>`;
    });
    await expect(page.locator(".u-cant-see-me-mask-overlay")).toHaveCount(4);

    await page.evaluate(() => {
      document.body.innerHTML = `<main data-thread-id="thread_alpha1"><h2 data-gmail-thread-subject>fixture unresolved subject</h2></main>`;
    });
    await expect(page.locator("[data-u-cant-see-me-owned]").locator(".u-cant-see-me-gmail-guard")).toBeVisible();
  } finally {
    await context.close();
    await rm(extensionPath, { recursive: true, force: true });
  }
});

test("creates Gmail protection on an already-open page", async ({ baseURL }) => {
  const extensionPath = await createE2eExtension();
  const context = await chromium.launchPersistentContext("", {
    headless: false,
    ignoreDefaultArgs: ["--disable-extensions"],
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });

  try {
    const page = await context.newPage();
    await page.goto(`${baseURL}/gmail-multi-message-thread.html#inbox/thread_alpha1`);
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker", { timeout: 10_000 });
    const tabId = await worker.evaluate(async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id);
    expect(tabId).toBeDefined();
    await page.locator("[data-gmail-message-body]").first().evaluate((element) => {
      (element as HTMLElement).style.position = "relative";
    });

    const extensionId = new URL(worker.url()).host;
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    const response = await popup.evaluate(async (currentTabId) => chrome.runtime.sendMessage({
      type: "CREATE_GMAIL_RULE",
      tabId: currentTabId,
      style: { type: "black" },
      target: { maskThreadSubject: true, maskMessageBody: true, maskCollapsedPreview: true, maskListSubject: true, maskListSnippet: true },
    }), tabId as number);

    expect(response).toMatchObject({ ok: true });
    await expect(page.locator("[data-gmail-message-body]").first()).toHaveAttribute("data-u-cant-see-me-renderer", "pseudo-layer");
    await expect.poll(() => page.locator("[data-gmail-message-body]").first().evaluate(
      (element) => getComputedStyle(element, "::after").backgroundColor,
    )).toBe("rgb(0, 0, 0)");
  } finally {
    await context.close();
    await rm(extensionPath, { recursive: true, force: true });
  }
});

test("manages rules and persistent page protection from the options UI", async ({ baseURL }) => {
  const extensionPath = await createE2eExtension();
  const context = await chromium.launchPersistentContext("", {
    headless: false,
    ignoreDefaultArgs: ["--disable-extensions"],
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  try {
    const page = await context.newPage();
    await page.goto(`${baseURL}/basic.html`);
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker", { timeout: 10_000 });
    const tabId = await worker.evaluate(async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id);
    expect(tabId).toBeDefined();
    await selectAndSave(page, worker, tabId as number, ["#private-card"], "black", false, 1);

    const extensionId = new URL(worker.url()).host;
    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/options.html`);
    await expect(options.locator("#rule-count")).toHaveText("1");
    await options.getByRole("checkbox", { name: "Enabled" }).uncheck();
    await expect(page.locator(".u-cant-see-me-mask-overlay")).toHaveCount(0);

    await options.getByRole("button", { name: "Duplicate" }).click();
    await expect(options.locator("#rule-count")).toHaveText("2");
    await options.getByRole("button", { name: "Delete" }).first().click();
    await expect(options.locator("#rule-count")).toHaveText("1");
  } finally {
    await context.close();
    await rm(extensionPath, { recursive: true, force: true });
  }
});

test("self-heals hostile style/root removal and survives mutation storms", async ({ baseURL }) => {
  const extensionPath = await createE2eExtension();
  const context = await chromium.launchPersistentContext("", { headless: false, ignoreDefaultArgs: ["--disable-extensions"], args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`] });
  try {
    const page = await context.newPage();
    await page.goto(`${baseURL}/hostile.html`);
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker", { timeout: 10_000 });
    const tabId = await worker.evaluate(async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id);
    await selectAndSave(page, worker, tabId as number, ["#pseudo-target", "#portal-target"], "black", false, 1);
    await expect(page.locator("#u-cant-see-me-pseudo-renderer")).toBeAttached();
    await expect(page.locator(".u-cant-see-me-mask-overlay")).toHaveCount(1);
    await page.locator("#remove-pseudo-style").click();
    await expect(page.locator("#u-cant-see-me-pseudo-renderer")).toBeAttached();
    await page.locator("#remove-extension-root").click();
    await expect(page.locator("[data-u-cant-see-me-owned]")).toBeAttached();
    await expect(page.locator(".u-cant-see-me-mask-overlay")).toHaveCount(1);
    await page.locator("#mutation-storm").click();
    await expect(page.locator("#u-cant-see-me-pseudo-renderer")).toBeAttached();
  } finally {
    await context.close();
    await rm(extensionPath, { recursive: true, force: true });
  }
});

test("handles one hundred stored masks and a synthetic mutation storm", async ({ baseURL }) => {
  const extensionPath = await createE2eExtension();
  const context = await chromium.launchPersistentContext("", { headless: false, ignoreDefaultArgs: ["--disable-extensions"], args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`] });
  try {
    const page = await context.newPage();
    await page.goto(`${baseURL}/stress.html`);
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker", { timeout: 10_000 });
    const tabId = await worker.evaluate(async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id);
    await worker.evaluate(async ({ currentTabId, origin }) => {
      await chrome.scripting.executeScript({ target: { tabId: currentTabId }, files: ["content.js"] });
      const fingerprint = { tagName: "div", stableAttributes: {}, classTokens: [], parentTags: [], childCountRange: { min: 0, max: 0 } };
      const rules = Array.from({ length: 100 }, (_, index) => ({ id: `stress-rule-${index}`, schemaVersion: 1, enabled: true, createdAt: index, updatedAt: index, scope: { kind: "origin", origin }, locator: { primary: { kind: "id", value: `stress-${index}` }, fallbacks: [], fingerprint, confidenceThreshold: 0 }, style: { type: "black" } }));
      await chrome.storage.local.set({ "u-cant-see-me.rules": { schemaVersion: 1, rules } });
      return chrome.tabs.sendMessage(currentTabId, { type: "RULES_CHANGED" });
    }, { currentTabId: tabId as number, origin: new URL(baseURL).origin });
    await expect(page.locator(".u-cant-see-me-mask-overlay")).toHaveCount(100);
    await page.evaluate(() => (window as Window & { runStressMutations: () => void }).runStressMutations());
    await expect(page.locator(".u-cant-see-me-mask-overlay")).toHaveCount(100);
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
