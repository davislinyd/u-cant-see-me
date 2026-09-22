import { registerBackgroundMessaging, startSelection } from "./messaging";

const ROOT_MENU_ID = "u-cant-see-me-root";
const activeTabsByWindow = new Map<number, number>();

function initializeContextMenus(): void {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: ROOT_MENU_ID,
      title: "U Cant See Me",
      contexts: ["all"],
    });
    chrome.contextMenus.create({
      id: "u-cant-see-me-mask-element",
      parentId: ROOT_MENU_ID,
      title: "Mask this element",
      contexts: ["all"],
      enabled: true,
    });
    chrome.contextMenus.create({
      id: "u-cant-see-me-reveal-element",
      parentId: ROOT_MENU_ID,
      title: "Reveal this element",
      contexts: ["all"],
      enabled: true,
    });
    chrome.contextMenus.create({
      id: "u-cant-see-me-remove-mask",
      parentId: ROOT_MENU_ID,
      title: "Remove this mask",
      contexts: ["all"],
      enabled: true,
    });
    chrome.contextMenus.create({
      id: "u-cant-see-me-protect-gmail-message",
      parentId: ROOT_MENU_ID,
      title: "Protect this Gmail message",
      contexts: ["all"],
      enabled: false,
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  initializeContextMenus();
});

chrome.runtime.onStartup.addListener(() => {
  initializeContextMenus();
});

chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
  const previousTabId = activeTabsByWindow.get(windowId);
  activeTabsByWindow.set(windowId, tabId);
  if (previousTabId === undefined || previousTabId === tabId) {
    void updateGmailMenu(tabId);
    return;
  }
  void updateGmailMenu(tabId);
  void chrome.tabs.sendMessage(previousTabId, { type: "RELOCK_ALL" }).catch(() => undefined);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  for (const [windowId, activeTabId] of activeTabsByWindow) {
    if (activeTabId === tabId) {
      activeTabsByWindow.delete(windowId);
    }
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url && tab.active) {
    void updateGmailMenu(tabId);
  }
});

chrome.contextMenus.onClicked.addListener((_info, tab) => {
  if (tab?.id === undefined) {
    return;
  }
  const messageByMenuId: Record<string, string> = {
    "u-cant-see-me-mask-element": "MASK_CONTEXT_ELEMENT",
    "u-cant-see-me-reveal-element": "REVEAL_CONTEXT_ELEMENT",
    "u-cant-see-me-remove-mask": "REMOVE_CONTEXT_MASK",
    "u-cant-see-me-protect-gmail-message": "PROTECT_GMAIL_CONTEXT_MESSAGE",
  };
  const type = messageByMenuId[_info.menuItemId] as "MASK_CONTEXT_ELEMENT" | "REVEAL_CONTEXT_ELEMENT" | "REMOVE_CONTEXT_MASK" | "PROTECT_GMAIL_CONTEXT_MESSAGE" | undefined;
  if (!type) {
    return;
  }
  void chrome.tabs.sendMessage(tab.id, { type, tabId: tab.id }).catch(async () => {
    if (type === "MASK_CONTEXT_ELEMENT") {
      await startSelection(tab.id);
    }
  });
});

chrome.commands.onCommand.addListener((command) => {
  void withActiveTab(async (tabId) => {
    switch (command) {
      case "start-selection":
        await startSelection(tabId);
        break;
      case "temporary-reveal":
        await chrome.tabs.sendMessage(tabId, { type: "REVEAL_ALL", durationMs: 10_000, tabId });
        break;
      case "remask-all":
        await chrome.tabs.sendMessage(tabId, { type: "RELOCK_ALL" });
        break;
    }
  });
});

registerBackgroundMessaging();

function isGmailUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const hostname = new URL(value).hostname;
    return hostname === "mail.google.com" || hostname.endsWith(".mail.google.com");
  } catch {
    return false;
  }
}

async function withActiveTab(action: (tabId: number) => Promise<void>): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab?.id !== undefined) {
    await action(tab.id);
  }
}

async function updateGmailMenu(tabId: number): Promise<void> {
  const tab = await chrome.tabs.get(tabId);
  chrome.contextMenus.update("u-cant-see-me-protect-gmail-message", { enabled: isGmailUrl(tab.url) });
}
