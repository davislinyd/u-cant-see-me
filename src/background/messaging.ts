import { RuleStore } from "../storage/rule-store";
import { isExtensionMessage, type ExtensionMessage, type MessageResponse } from "../shared/messages";

const ruleStore = new RuleStore();

export function registerBackgroundMessaging(): void {
  chrome.runtime.onMessage.addListener((rawMessage, sender, sendResponse) => {
    if (!isExtensionMessage(rawMessage)) {
      return false;
    }

    void handleBackgroundMessage(rawMessage, sender)
      .then((response) => sendResponse(response))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Unexpected extension error";
        sendResponse({ ok: false, error: message } satisfies MessageResponse);
      });

    return true;
  });
}

async function handleBackgroundMessage(message: ExtensionMessage, sender: chrome.runtime.MessageSender): Promise<MessageResponse> {
  switch (message.type) {
    case "GET_RULES":
      return { ok: true, data: await ruleStore.list() };
    case "SAVE_RULE":
      await ruleStore.save(message.rule);
      await broadcastRulesChanged(sender.tab?.id);
      return { ok: true };
    case "REMOVE_RULE":
      await ruleStore.remove(message.ruleId);
      await broadcastRulesChanged(sender.tab?.id);
      return { ok: true };
    case "GET_PAGE_STATUS":
      return await getPageStatusFromTab(message, sender);
    case "START_SELECTION":
      return await forwardToTab(message.tabId, { type: "START_SELECTION" });
    case "STOP_SELECTION":
    case "REVEAL_RULE":
    case "REMASK_RULE":
    case "RULES_CHANGED":
      return { ok: true };
  }
}

async function getPageStatusFromTab(message: ExtensionMessage, sender: chrome.runtime.MessageSender): Promise<MessageResponse> {
  const tabId = message.type === "START_SELECTION" ? message.tabId : sender.tab?.id;
  if (tabId === undefined) {
    return { ok: false, error: "No active tab is available." };
  }

  return forwardToTab(tabId, { type: "GET_PAGE_STATUS" });
}

async function forwardToTab(tabId: number | undefined, message: ExtensionMessage): Promise<MessageResponse> {
  if (tabId === undefined) {
    return { ok: false, error: "No tab is available." };
  }

  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch {
    return { ok: true, data: undefined };
  }
}

async function broadcastRulesChanged(excludeTabId: number | undefined): Promise<void> {
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs
    .filter((tab): tab is chrome.tabs.Tab & { id: number } => tab.id !== undefined && tab.id !== excludeTabId)
    .map(async (tab) => {
      try {
        await chrome.tabs.sendMessage(tab.id, { type: "RULES_CHANGED" });
      } catch {
        // Content scripts are optional until a host permission is granted.
      }
    }));
}
