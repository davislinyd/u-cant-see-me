import { getSiteAdapter } from "../adapters/site-adapter";
import { RuleStore } from "../storage/rule-store";
import { SettingsStore } from "../storage/settings-store";
import { CONTENT_READY_ATTRIBUTE, CURRENT_SCHEMA_VERSION, DEFAULT_SETTINGS } from "../shared/constants";
import { isExtensionMessage, type ExtensionMessage, type MessageResponse } from "../shared/messages";
import type { MaskRule, MaskStyle, PageStatus } from "../shared/types";
import { createId } from "../shared/utils";
import { generateLocator } from "./locator/selector-generator";
import { MaskManager } from "./mask-manager";
import { MutationEngine } from "./mutation-engine";
import { RouteObserver } from "./route-observer";
import { SelectionController } from "./selection-controller";

const adapter = getSiteAdapter(window.location.href);
const maskManager = new MaskManager(adapter);
const ruleStore = new RuleStore();
const settingsStore = new SettingsStore();
const routeObserver = new RouteObserver();
const mutationEngine = new MutationEngine(() => {
  maskManager.resolveAndApply(window.location.href);
});
const selectionController = new SelectionController(
  async (elements, style) => saveSelectedElements(elements, style),
  () => undefined,
);
let defaultMaskStyle: MaskStyle = { ...DEFAULT_SETTINGS.defaultMaskStyle };

export function currentStatus(): PageStatus {
  return maskManager.resolveAndApply(window.location.href);
}

async function refreshRules(): Promise<void> {
  try {
    const rules = await ruleStore.list();
    maskManager.setRules(rules);
    currentStatus();
  } catch {
    // A storage read failure leaves the page unmasked and is surfaced by the popup status.
  }
}

async function saveSelectedElements(elements: Element[], style: MaskStyle): Promise<void> {
  const pageUrl = window.location.href;
  const now = Date.now();
  const rules: MaskRule[] = elements.map((element, index) => ({
    id: createId(`rule_${index + 1}`),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    enabled: true,
    createdAt: now,
    updatedAt: now,
    scope: {
      kind: "exact-url",
      value: pageUrl,
    },
    locator: generateLocator(element),
    style: {
      ...style,
    },
  }));

  const response = await chrome.runtime.sendMessage({ type: "SAVE_RULES", rules } satisfies ExtensionMessage) as MessageResponse;
  if (!response.ok) {
    throw new Error(response.error);
  }
  await refreshRules();
}

function handleMessage(message: ExtensionMessage): MessageResponse {
  switch (message.type) {
    case "GET_PAGE_STATUS":
      return { ok: true, data: currentStatus() };
    case "START_SELECTION":
      selectionController.start(defaultMaskStyle);
      return { ok: true, data: true };
    case "STOP_SELECTION":
      selectionController.stop();
      return { ok: true, data: true };
    case "RULES_CHANGED":
      void refreshRules();
      return { ok: true };
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
    void refreshRules();
  });
  mutationEngine.start();

  chrome.runtime.onMessage.addListener((rawMessage, _sender, sendResponse) => {
    if (!isExtensionMessage(rawMessage)) {
      return false;
    }

    sendResponse(handleMessage(rawMessage));
    return false;
  });

  void settingsStore.get()
    .then((settings) => {
      defaultMaskStyle = { ...settings.defaultMaskStyle };
    })
    .catch(() => undefined)
    .finally(() => refreshRules());
}

initialize();
