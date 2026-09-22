import { RuleStore } from "../storage/rule-store";
import { isExtensionMessage, type ExtensionMessage, type MessageResponse } from "../shared/messages";
import type { MaskRule } from "../shared/types";
import { originForSiteScope, originPatternForUrl } from "../shared/utils";
import { matchesSiteScope } from "../shared/utils";
import { hasHostPermissionForUrl } from "./permissions";
import { registerProtectionScript, unregisterProtectionScript } from "./script-registration";

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
      await registerProtectionForSenderTab(sender);
      await broadcastRulesChanged(sender.tab?.id);
      return { ok: true };
    case "SAVE_RULES":
      await ruleStore.saveMany(message.rules);
      await registerProtectionForSenderTab(sender);
      await broadcastRulesChanged(sender.tab?.id);
      return { ok: true };
    case "REMOVE_RULE":
      await unregisterProtectionForRemovedRule(message.ruleId);
      await ruleStore.remove(message.ruleId);
      await broadcastRulesChanged(sender.tab?.id);
      return { ok: true };
    case "GET_PAGE_STATUS":
      return await getPageStatusFromTab(message, sender);
    case "START_SELECTION":
      return await startSelection(message.tabId);
    case "STOP_SELECTION":
      return await forwardToTab(sender.tab?.id, message);
    case "REVEAL_ALL":
      return forwardToTab(message.tabId, message);
    case "REVEAL_RULE":
    case "REMASK_RULE":
      return forwardToTab(message.tabId ?? sender.tab?.id, message);
    case "CREATE_GMAIL_RULE":
    case "MASK_CONTEXT_ELEMENT":
    case "REVEAL_CONTEXT_ELEMENT":
    case "REMOVE_CONTEXT_MASK":
    case "PROTECT_GMAIL_CONTEXT_MESSAGE":
    case "START_EDIT_MODE":
    case "STOP_EDIT_MODE":
      return forwardToTab(message.tabId ?? sender.tab?.id, message);
    case "TEST_RULE":
      return forwardToTab(message.tabId ?? await mostRecentWebTabId(), message);
    case "MANAGE_PAGE_RULES":
      return managePageRules(message);
    case "UPDATE_BADGE":
      if (sender.tab?.id !== undefined) await updateBadge(sender.tab.id, message.status.state);
      return { ok: true };
    case "RELOCK_ALL":
      return { ok: true };
    case "RULES_CHANGED":
      await registerProtectionForStoredRules();
      await broadcastRulesChanged(sender.tab?.id);
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
    return { ok: false, error: "The current page is not available to the extension." };
  }
}

async function mostRecentWebTabId(): Promise<number | undefined> {
  const tabs = await chrome.tabs.query({});
  return tabs
    .filter((tab): tab is chrome.tabs.Tab & { id: number; url: string } => tab.id !== undefined && Boolean(tab.url?.match(/^https?:\/\//)))
    .sort((left, right) => (right.lastAccessed ?? 0) - (left.lastAccessed ?? 0))[0]?.id;
}

export async function startSelection(tabId: number | undefined): Promise<MessageResponse> {
  if (tabId === undefined) {
    return { ok: false, error: "No active tab is available." };
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"],
    });
  } catch {
    return { ok: false, error: "This page cannot be selected. Try a normal http(s) webpage." };
  }

  const response = await forwardToTab(tabId, { type: "START_SELECTION" });
  if (response.ok) {
    return response;
  }

  await new Promise((resolve) => setTimeout(resolve, 50));
  return forwardToTab(tabId, { type: "START_SELECTION" });
}

async function managePageRules(message: Extract<ExtensionMessage, { type: "MANAGE_PAGE_RULES" }>): Promise<MessageResponse> {
  if (message.tabId === undefined) {
    return { ok: false, error: "No active tab is available." };
  }
  const tab = await chrome.tabs.get(message.tabId);
  if (!tab.url) {
    return { ok: false, error: "The current page has no manageable URL." };
  }
  const allRules = await ruleStore.list();
  const matches = allRules.filter((rule) => matchesSiteScope(rule.scope, tab.url as string));
  const selected = message.action === "disable-site"
    ? allRules.filter((rule) => originForSiteScope(rule.scope) === new URL(tab.url as string).origin)
    : matches;
  if (selected.length === 0) {
    return { ok: true, data: true };
  }
  const selectedIds = new Set(selected.map((rule) => rule.id));
  const nextRules = message.action === "remove-page"
    ? allRules.filter((rule) => !selectedIds.has(rule.id))
    : allRules.map((rule) => selectedIds.has(rule.id) ? { ...rule, enabled: false, updatedAt: Date.now() } : rule);
  await ruleStore.replace(nextRules);
  if (message.action === "remove-page") {
    await unregisterOrphanedOrigins(selected, nextRules);
  }
  await broadcastRulesChanged(undefined);
  return { ok: true, data: true };
}

async function registerProtectionForSenderTab(sender: chrome.runtime.MessageSender): Promise<void> {
  const url = sender.tab?.url;
  if (!url || !(await hasHostPermissionForUrl(url))) {
    return;
  }

  const origin = originPatternForUrl(url);
  if (origin) {
    try {
      await registerProtectionScript(origin);
    } catch {
      // ActiveTab access can be temporary; the rule remains safely stored.
    }
  }
}

async function registerProtectionForStoredRules(): Promise<void> {
  const rules = await ruleStore.list();
  const origins = new Set(rules.map((rule) => originForSiteScope(rule.scope)).filter((origin): origin is string => origin !== null));
  await Promise.all([...origins].map(async (origin) => {
    if (await hasHostPermissionForUrl(`${origin}/`)) {
      try {
        await registerProtectionScript(`${origin}/*`);
      } catch {
        // Imports remain local when a browser declines dynamic registration.
      }
    }
  }));
}

async function unregisterProtectionForRemovedRule(ruleId: string): Promise<void> {
  const removedRule = (await ruleStore.list()).find((rule) => rule.id === ruleId);
  const origin = removedRule ? originForSiteScope(removedRule.scope) : null;
  if (!origin) {
    return;
  }

  const remainingRules = (await ruleStore.list()).filter((rule) => rule.id !== ruleId);
  if (!remainingRules.some((rule) => originForSiteScope(rule.scope) === origin)) {
    try {
      await unregisterProtectionScript(`${origin}/*`);
    } catch {
      // Removing a local rule must not fail because an old dynamic script is already absent.
    }
  }
}

async function unregisterOrphanedOrigins(removedRules: MaskRule[], remainingRules: MaskRule[]): Promise<void> {
  const origins = new Set(removedRules.map((rule) => originForSiteScope(rule.scope)).filter((origin): origin is string => origin !== null));
  await Promise.all([...origins].map(async (origin) => {
    if (remainingRules.some((rule) => originForSiteScope(rule.scope) === origin)) {
      return;
    }
    try {
      await unregisterProtectionScript(`${origin}/*`);
    } catch {
      // A missing dynamic script must not prevent local rule cleanup.
    }
  }));
}

async function updateBadge(tabId: number, state: string): Promise<void> {
  const badge = state === "protected" ? { text: "OK", color: "#2d9f65" } :
    state === "no-masks" ? { text: "—", color: "#73798a" } :
      state === "protection-failure" ? { text: "ERR", color: "#bf2b2b" } : { text: "!", color: "#b87900" };
  await chrome.action.setBadgeText({ tabId, text: badge.text });
  await chrome.action.setBadgeBackgroundColor({ tabId, color: badge.color });
  await chrome.action.setTitle({ tabId, title: `U Cant See Me: ${state.replaceAll("-", " ")}` });
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
