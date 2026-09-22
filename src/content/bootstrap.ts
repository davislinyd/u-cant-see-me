import { getSiteAdapter } from "../adapters/site-adapter";
import { RuleStore } from "../storage/rule-store";
import { SettingsStore } from "../storage/settings-store";
import { CONTENT_READY_ATTRIBUTE, CURRENT_SCHEMA_VERSION, DEFAULT_SETTINGS, STORAGE_KEYS } from "../shared/constants";
import { isExtensionMessage, type ExtensionMessage, type MessageResponse } from "../shared/messages";
import type { ExtensionSettings, MaskRule, MaskStyle, PageStatus } from "../shared/types";
import { createId } from "../shared/utils";
import { generateLocator } from "./locator/selector-generator";
import { MaskManager } from "./mask-manager";
import { MutationEngine } from "./mutation-engine";
import { PrivacyGate } from "./privacy-gate";
import { PrintProtectionController } from "./print-protection-controller";
import { RouteObserver } from "./route-observer";
import { SelectionController } from "./selection-controller";
import { StrictMaskController } from "./strict-mask-controller";
import { TemporaryRevealController } from "./temporary-reveal-controller";

const adapter = getSiteAdapter(window.location.href);
const maskManager = new MaskManager(adapter);
const ruleStore = new RuleStore();
const settingsStore = new SettingsStore();
const routeObserver = new RouteObserver();
const mutationEngine = new MutationEngine((records) => {
  finalizeStatus(maskManager.reconcileMutations(window.location.href, records));
});
const privacyGate = new PrivacyGate();
const temporaryRevealController = new TemporaryRevealController(
  () => maskManager.applicableRuleIds(window.location.href),
  () => void currentStatus(),
);
const printProtectionController = new PrintProtectionController(() => maskManager.getActiveMasks());
const strictMaskController = new StrictMaskController(() => maskManager.getActiveMasks());
const selectionController = new SelectionController(
  async (elements, style) => saveSelectedElements(elements, style),
  () => undefined,
);
let defaultMaskStyle: MaskStyle = { ...DEFAULT_SETTINGS.defaultMaskStyle };
let currentSettings = { ...DEFAULT_SETTINGS, defaultMaskStyle: { ...DEFAULT_SETTINGS.defaultMaskStyle } };
let rulesReady = false;

export function currentStatus(): PageStatus {
  maskManager.setTemporarilyRevealed(temporaryRevealController.revealedRuleIds());
  return finalizeStatus(maskManager.resolveAndApply(window.location.href));
}

async function refreshRules(): Promise<void> {
  try {
    const rules = await ruleStore.list();
    maskManager.setRules(rules);
    rulesReady = true;
    currentStatus();
  } catch {
    // A storage read failure leaves the page unmasked and is surfaced by the popup status.
    rulesReady = true;
    finalizeStatus(maskManager.resolveAndApply(window.location.href));
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
    case "REVEAL_ALL":
      temporaryRevealController.revealAll(message.durationMs);
      return { ok: true, data: true };
    case "REVEAL_RULE": {
      const [state] = temporaryRevealController.reveal([message.ruleId], message.durationMs);
      return state ? { ok: true, data: state } : { ok: true };
    }
    case "REMASK_RULE":
      temporaryRevealController.remask([message.ruleId]);
      return { ok: true, data: true };
    case "RELOCK_ALL":
      temporaryRevealController.handleTabDeactivated();
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

  if (document.readyState === "loading") {
    privacyGate.install();
  }
  document.documentElement.setAttribute(CONTENT_READY_ATTRIBUTE, "true");
  temporaryRevealController.start();
  printProtectionController.start();
  strictMaskController.start();
  routeObserver.start();
  routeObserver.subscribe(() => {
    temporaryRevealController.handleNavigation();
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
    .then(applySettings)
    .catch(() => undefined)
    .finally(() => refreshRules());

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "sync" && STORAGE_KEYS.settings in changes) {
      void settingsStore.get().then(applySettings).then(() => currentStatus());
    }
  });
}

function finalizeStatus(status: PageStatus): PageStatus {
  strictMaskController.configure(currentSettings.strictMask);
  if (rulesReady) {
    privacyGate.reconcile(status);
  }
  return status;
}

function applySettings(settings: ExtensionSettings): void {
  currentSettings = settings;
  defaultMaskStyle = { ...settings.defaultMaskStyle };
  temporaryRevealController.configure(settings);
  strictMaskController.configure(settings.strictMask);
  privacyGate.configure(settings.privacyMode);
}

initialize();
