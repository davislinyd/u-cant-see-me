import { registerBackgroundMessaging } from "./messaging";

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
      enabled: false,
    });
    chrome.contextMenus.create({
      id: "u-cant-see-me-reveal-element",
      parentId: ROOT_MENU_ID,
      title: "Reveal this element",
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
    return;
  }
  void chrome.tabs.sendMessage(previousTabId, { type: "RELOCK_ALL" }).catch(() => undefined);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  for (const [windowId, activeTabId] of activeTabsByWindow) {
    if (activeTabId === tabId) {
      activeTabsByWindow.delete(windowId);
    }
  }
});

registerBackgroundMessaging();
