import { getSiteAdapter } from "../adapters/site-adapter";
import { CONTENT_READY_ATTRIBUTE } from "../shared/constants";
import { isExtensionMessage, type ExtensionMessage } from "../shared/messages";
import type { MessageResponse } from "../shared/messages";
import type { PageStatus } from "../shared/types";
import { MaskManager } from "./mask-manager";
import { MutationEngine } from "./mutation-engine";
import { RouteObserver } from "./route-observer";

const adapter = getSiteAdapter(window.location.href);
const maskManager = new MaskManager(adapter);
const routeObserver = new RouteObserver();
const mutationEngine = new MutationEngine(() => {
  maskManager.resolveAndApply(window.location.href);
});

function currentStatus(): PageStatus {
  return maskManager.resolveAndApply(window.location.href);
}

function handleMessage(message: ExtensionMessage): MessageResponse {
  switch (message.type) {
    case "GET_PAGE_STATUS":
      return { ok: true, data: currentStatus() };
    case "START_SELECTION":
      return { ok: true, data: false };
    case "STOP_SELECTION":
      return { ok: true, data: false };
    default:
      return { ok: true };
  }
}

function initialize(): void {
  if (document.documentElement.hasAttribute(CONTENT_READY_ATTRIBUTE)) {
    return;
  }

  document.documentElement.setAttribute(CONTENT_READY_ATTRIBUTE, "true");
  routeObserver.start();
  routeObserver.subscribe(() => {
    maskManager.clear();
    currentStatus();
  });
  mutationEngine.start();
  currentStatus();

  chrome.runtime.onMessage.addListener((rawMessage, _sender, sendResponse) => {
    if (!isExtensionMessage(rawMessage)) {
      return false;
    }

    sendResponse(handleMessage(rawMessage));
    return false;
  });
}

initialize();

export { currentStatus };
