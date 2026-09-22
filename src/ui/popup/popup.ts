import "./popup.css";
import { requestHostPermissionForUrl } from "../../background/permissions";
import type { ExtensionMessage, MessageResponse } from "../../shared/messages";
import type { MaskType } from "../../shared/types";

const stateElement = document.querySelector<HTMLElement>("#protection-state");
const detailElement = document.querySelector<HTMLElement>("#status-detail");
const countElement = document.querySelector<HTMLElement>("#mask-count");
const feedbackElement = document.querySelector<HTMLElement>("#feedback");
const selectButton = document.querySelector<HTMLButtonElement>("#select-elements");
const revealButton = document.querySelector<HTMLButtonElement>("#reveal-all");
const manageButton = document.querySelector<HTMLButtonElement>("#manage-masks");
const gmailProtection = document.querySelector<HTMLElement>("#gmail-protection");
const protectGmailButton = document.querySelector<HTMLButtonElement>("#protect-gmail");
const editButton = document.querySelector<HTMLButtonElement>("#edit-masks");
const settingsButton = document.querySelector<HTMLButtonElement>("#open-settings");

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendRuntimeMessage(message: ExtensionMessage): Promise<MessageResponse> {
  return chrome.runtime.sendMessage(message) as Promise<MessageResponse>;
}

async function loadStatus(): Promise<void> {
  const tab = await getActiveTab();
  if (tab?.id === undefined) {
    updateStatus("No active page", "目前沒有可讀取的分頁。", 0);
    return;
  }
  if (gmailProtection) {
    gmailProtection.hidden = !isGmailUrl(tab.url);
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: "GET_PAGE_STATUS" } satisfies ExtensionMessage) as MessageResponse;
    if (response.ok && response.data && typeof response.data === "object" && "state" in response.data) {
      updateStatus(response.data.state, `Active masks: ${response.data.activeMasks} · Unresolved: ${response.data.unresolvedRules}`, response.data.activeMasks);
      return;
    }
  } catch {
    // The content script is intentionally optional until host access is granted.
  }

  updateStatus("Ready", "此分頁尚未啟用保護規則。", 0);
}

function updateStatus(state: string, detail: string, count: number): void {
  if (stateElement) {
    stateElement.textContent = humanizeState(state);
  }
  if (detailElement) {
    detailElement.textContent = detail;
  }
  if (countElement) {
    countElement.textContent = String(count);
  }
  if (revealButton) {
    revealButton.disabled = count === 0;
  }
}

function showFeedback(message: string): void {
  if (feedbackElement) {
    feedbackElement.textContent = message;
  }
}

selectButton?.addEventListener("click", async () => {
  const tab = await getActiveTab();
  if (tab?.id === undefined) {
    showFeedback("找不到可操作的分頁。");
    return;
  }

  const automaticRestore = tab.url ? await requestHostPermissionForUrl(tab.url) : false;
  const response = await sendRuntimeMessage({ type: "START_SELECTION", tabId: tab.id });
  if (!response.ok) {
    showFeedback(response.error);
    return;
  }

  showFeedback(automaticRestore
    ? "Selection mode started."
    : "Selection mode started; automatic restore needs site access.");
});

editButton?.addEventListener("click", async () => {
  const tab = await getActiveTab();
  if (tab?.id === undefined) return showFeedback("找不到可操作的分頁。");
  const response = await sendRuntimeMessage({ type: "START_EDIT_MODE", tabId: tab.id });
  showFeedback(response.ok ? "Edit mode started." : response.error);
});

for (const [selector, action] of [["#disable-page", "disable-page"], ["#disable-site", "disable-site"], ["#remove-page", "remove-page"]] as const) {
  document.querySelector<HTMLButtonElement>(selector)?.addEventListener("click", async () => {
    const tab = await getActiveTab();
    if (tab?.id === undefined) return showFeedback("找不到可操作的分頁。");
    const response = await sendRuntimeMessage({ type: "MANAGE_PAGE_RULES", tabId: tab.id, action });
    showFeedback(response.ok ? "Page rules updated." : response.error);
    if (response.ok) await loadStatus();
  });
}

protectGmailButton?.addEventListener("click", async () => {
  const tab = await getActiveTab();
  if (tab?.id === undefined || !tab.url) {
    showFeedback("找不到可操作的 Gmail 分頁。");
    return;
  }
  await requestHostPermissionForUrl(tab.url);
  const style = document.querySelector<HTMLSelectElement>("#gmail-mask-style")?.value as MaskType | undefined;
  const response = await sendRuntimeMessage({
    type: "CREATE_GMAIL_RULE",
    tabId: tab.id,
    style: { type: style ?? "black" },
    target: {
      maskThreadSubject: isChecked("#gmail-thread-subject"),
      maskMessageBody: isChecked("#gmail-message-body"),
      maskCollapsedPreview: isChecked("#gmail-collapsed-preview"),
      maskListSubject: isChecked("#gmail-list-subject"),
      maskListSnippet: isChecked("#gmail-list-snippet"),
    },
  });
  showFeedback(response.ok ? "Gmail protection saved." : response.error);
  if (response.ok) {
    await loadStatus();
  }
});

revealButton?.addEventListener("click", async () => {
  const tab = await getActiveTab();
  if (tab?.id === undefined) {
    showFeedback("找不到可操作的分頁。");
    return;
  }

  const response = await sendRuntimeMessage({ type: "REVEAL_ALL", tabId: tab.id, durationMs: 10_000 });
  if (!response.ok) {
    showFeedback(response.error);
    return;
  }

  showFeedback("All masks are revealed for 10 seconds.");
  updateStatus("temporarily-revealed", "Masks will relock automatically.", 0);
});

manageButton?.addEventListener("click", () => {
  void chrome.runtime.openOptionsPage();
});

settingsButton?.addEventListener("click", () => {
  void chrome.runtime.openOptionsPage();
});

void loadStatus();

function isGmailUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const hostname = new URL(value).hostname;
    return hostname === "mail.google.com" || hostname.endsWith(".mail.google.com");
  } catch {
    return false;
  }
}

function isChecked(selector: string): boolean {
  return document.querySelector<HTMLInputElement>(selector)?.checked === true;
}

function humanizeState(state: string): string {
  return ({
    protected: "Protected",
    "partially-protected": "Partially protected",
    unresolved: "Unresolved",
    "protection-failure": "Protection failure",
    "no-masks": "No masks",
  } as Record<string, string>)[state] ?? state;
}
