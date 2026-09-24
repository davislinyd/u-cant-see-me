import "./popup.css";
import { requestHostPermissionForUrl } from "../../background/permissions";
import { resolveLanguage, translate, type Language, type MessageKey } from "../../shared/i18n";
import type { ExtensionMessage, MessageResponse } from "../../shared/messages";
import type { MaskType } from "../../shared/types";
import { SettingsStore } from "../../storage/settings-store";

const settingsStore = new SettingsStore();
let currentLanguage: Language = "en";

function t(key: MessageKey, vars?: Record<string, string | number>): string {
  return translate(key, currentLanguage, vars);
}

function applyStaticTranslations(): void {
  document.documentElement.lang = currentLanguage === "zh-Hant" ? "zh-Hant" : "en";
  document.title = t("doc.title.popup");
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n as MessageKey;
    element.textContent = t(key);
  });
  document.querySelectorAll<HTMLElement>("[data-i18n-aria-label]").forEach((element) => {
    const key = element.dataset.i18nAriaLabel as MessageKey;
    element.setAttribute("aria-label", t(key));
  });
  document.querySelectorAll<HTMLButtonElement>("#language-switch [data-language]").forEach((button) => {
    const active = button.dataset.language === currentLanguage;
    button.setAttribute("aria-pressed", String(active));
    button.classList.toggle("is-active", active);
  });
}

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
    updateStatus("no-active-page", t("popup.detail.noActivePage"), 0);
    return;
  }
  if (gmailProtection) {
    gmailProtection.hidden = !isGmailUrl(tab.url);
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: "GET_PAGE_STATUS" } satisfies ExtensionMessage) as MessageResponse;
    if (response.ok && response.data && typeof response.data === "object" && "state" in response.data) {
      const data = response.data;
      const activeMasks = typeof data.activeMasks === "number" ? data.activeMasks : 0;
      const unresolvedRules = typeof data.unresolvedRules === "number" ? data.unresolvedRules : 0;
      updateStatus(
        String(data.state),
        t("popup.detail.status", { active: activeMasks, unresolved: unresolvedRules }),
        activeMasks,
      );
      return;
    }
  } catch {
    // The content script is intentionally optional until host access is granted.
  }

  updateStatus("ready", t("popup.detail.noProtection"), 0);
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

async function setLanguage(language: Language): Promise<void> {
  if (language === currentLanguage) return;
  currentLanguage = language;
  applyStaticTranslations();
  try {
    await settingsStore.update({ language });
  } catch {
    showFeedback(t("options.feedback.languageFailed"));
  }
  await loadStatus();
}

document.querySelectorAll<HTMLButtonElement>("#language-switch [data-language]").forEach((button) => {
  button.addEventListener("click", () => {
    const language = button.dataset.language;
    if (language === "en" || language === "zh-Hant") {
      void setLanguage(language);
    }
  });
});

selectButton?.addEventListener("click", async () => {
  const tab = await getActiveTab();
  if (tab?.id === undefined) {
    showFeedback(t("popup.feedback.noTab"));
    return;
  }

  const automaticRestore = tab.url ? await requestHostPermissionForUrl(tab.url) : false;
  const response = await sendRuntimeMessage({ type: "START_SELECTION", tabId: tab.id });
  if (!response.ok) {
    showFeedback(response.error);
    return;
  }

  showFeedback(automaticRestore
    ? t("popup.feedback.selectionStarted")
    : t("popup.feedback.selectionNeedsAccess"));
});

editButton?.addEventListener("click", async () => {
  const tab = await getActiveTab();
  if (tab?.id === undefined) return showFeedback(t("popup.feedback.noTab"));
  const response = await sendRuntimeMessage({ type: "START_EDIT_MODE", tabId: tab.id });
  showFeedback(response.ok ? t("popup.feedback.editStarted") : response.error);
});

for (const [selector, action] of [["#disable-page", "disable-page"], ["#disable-site", "disable-site"], ["#remove-page", "remove-page"]] as const) {
  document.querySelector<HTMLButtonElement>(selector)?.addEventListener("click", async () => {
    const tab = await getActiveTab();
    if (tab?.id === undefined) return showFeedback(t("popup.feedback.noTab"));
    const response = await sendRuntimeMessage({ type: "MANAGE_PAGE_RULES", tabId: tab.id, action });
    showFeedback(response.ok ? t("popup.feedback.pageRulesUpdated") : response.error);
    if (response.ok) await loadStatus();
  });
}

protectGmailButton?.addEventListener("click", async () => {
  const tab = await getActiveTab();
  if (tab?.id === undefined || !tab.url) {
    showFeedback(t("popup.feedback.noGmailTab"));
    return;
  }
  if (!await requestHostPermissionForUrl(tab.url)) {
    showFeedback(t("popup.feedback.gmailNeedsAccess"));
    return;
  }
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
  showFeedback(response.ok ? t("popup.feedback.gmailSaved") : response.error);
  if (response.ok) {
    await loadStatus();
  }
});

revealButton?.addEventListener("click", async () => {
  const tab = await getActiveTab();
  if (tab?.id === undefined) {
    showFeedback(t("popup.feedback.noTab"));
    return;
  }

  const response = await sendRuntimeMessage({ type: "REVEAL_ALL", tabId: tab.id, durationMs: 10_000 });
  if (!response.ok) {
    showFeedback(response.error);
    return;
  }

  showFeedback(t("popup.feedback.revealed"));
  updateStatus("temporarily-revealed", t("popup.feedback.relockAuto"), 0);
});

manageButton?.addEventListener("click", () => {
  void chrome.runtime.openOptionsPage();
});

void (async () => {
  try {
    const settings = await settingsStore.get();
    currentLanguage = resolveLanguage(settings);
  } catch {
    currentLanguage = "en";
  }
  applyStaticTranslations();
  await loadStatus();
})();

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
  const knownStates = ["protected", "partially-protected", "unresolved", "protection-failure", "no-masks"] as const;
  if (state === "no-active-page") return t("popup.state.noActivePage");
  if (state === "ready") return t("popup.state.ready");
  if ((knownStates as readonly string[]).includes(state)) {
    return t(`popup.state.${state}` as MessageKey);
  }
  return state;
}
