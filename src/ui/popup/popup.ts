import "./popup.css";
import { requestHostPermissionForUrl } from "../../background/permissions";
import type { ExtensionMessage, MessageResponse } from "../../shared/messages";

const stateElement = document.querySelector<HTMLElement>("#protection-state");
const detailElement = document.querySelector<HTMLElement>("#status-detail");
const countElement = document.querySelector<HTMLElement>("#mask-count");
const feedbackElement = document.querySelector<HTMLElement>("#feedback");
const selectButton = document.querySelector<HTMLButtonElement>("#select-elements");
const manageButton = document.querySelector<HTMLButtonElement>("#manage-masks");

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

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: "GET_PAGE_STATUS" } satisfies ExtensionMessage) as MessageResponse;
    if (response.ok && response.data && typeof response.data === "object" && "state" in response.data) {
      updateStatus(response.data.state, `Active masks: ${response.data.activeMasks}`, response.data.activeMasks);
      return;
    }
  } catch {
    // The content script is intentionally optional until host access is granted.
  }

  updateStatus("Ready", "此分頁尚未啟用保護規則。", 0);
}

function updateStatus(state: string, detail: string, count: number): void {
  if (stateElement) {
    stateElement.textContent = state;
  }
  if (detailElement) {
    detailElement.textContent = detail;
  }
  if (countElement) {
    countElement.textContent = String(count);
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

manageButton?.addEventListener("click", () => {
  void chrome.runtime.openOptionsPage();
});

void loadStatus();
