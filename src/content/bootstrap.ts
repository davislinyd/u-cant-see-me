import { getSiteAdapter } from "../adapters/site-adapter";
import { GmailAdapter } from "../adapters/gmail/gmail-adapter";
import { GmailPrivacyGuard } from "../adapters/gmail/gmail-guard";
import { RuleStore } from "../storage/rule-store";
import { SettingsStore } from "../storage/settings-store";
import { CONTENT_READY_ATTRIBUTE, CURRENT_SCHEMA_VERSION, DEFAULT_SETTINGS, STORAGE_KEYS } from "../shared/constants";
import { isExtensionMessage, type ExtensionMessage, type GmailRuleOptions, type MessageResponse } from "../shared/messages";
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

const adapter = getSiteAdapter(window.location.href, document);
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
const gmailGuard = adapter instanceof GmailAdapter
  ? new GmailPrivacyGuard(
    () => void currentStatus(),
    () => {
      temporaryRevealController.reveal(maskManager.applicableRuleIds(window.location.href), 10_000);
      void currentStatus();
    },
  )
  : null;

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

async function handleMessage(message: ExtensionMessage): Promise<MessageResponse> {
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
    case "CREATE_GMAIL_RULE":
      return saveGmailRule(message.target, message.style);
    default:
      return { ok: true };
  }
}

async function saveGmailRule(options: GmailRuleOptions, style: MaskStyle): Promise<MessageResponse> {
  if (!(adapter instanceof GmailAdapter)) {
    return { ok: false, error: "This action is available only on Gmail." };
  }
  const threadId = adapter.currentThreadId();
  if (!threadId) {
    return { ok: false, error: "Gmail's rendered thread ID is not available yet." };
  }
  const now = Date.now();
  const rule: MaskRule = {
    id: createId("gmail_rule"),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    enabled: true,
    createdAt: now,
    updatedAt: now,
    scope: { kind: "origin", origin: window.location.origin },
    locator: generateLocator(document.body),
    style: { ...style },
    gmailTarget: {
      threadId,
      ...withRouteId(adapter.currentRouteId()),
      ...options,
    },
  };
  const response = await chrome.runtime.sendMessage({ type: "SAVE_RULE", rule } satisfies ExtensionMessage) as MessageResponse;
  if (response.ok) {
    await refreshRules();
  }
  return response;
}

function withRouteId(routeId: string | undefined): Pick<NonNullable<MaskRule["gmailTarget"]>, "routeId"> | Record<never, never> {
  return routeId ? { routeId } : {};
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

    void handleMessage(rawMessage).then(sendResponse).catch((error: unknown) => {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : "Unexpected extension error" });
    });
    return true;
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
    reconcileGmailGuard();
  }
  return status;
}

function reconcileGmailGuard(): void {
  if (!gmailGuard || !(adapter instanceof GmailAdapter)) {
    return;
  }
  const protectedRules = maskManager.applicableRulesForPage(window.location.href)
    .filter((rule) => adapter.isProtectedThreadRoute(window.location.href, rule));
  gmailGuard.reconcile(
    protectedRules.length > 0,
    protectedRules.length > 0 && protectedRules.every((rule) => maskManager.isRuleResolved(rule.id)),
  );
}

function applySettings(settings: ExtensionSettings): void {
  currentSettings = settings;
  defaultMaskStyle = { ...settings.defaultMaskStyle };
  temporaryRevealController.configure(settings);
  strictMaskController.configure(settings.strictMask);
  privacyGate.configure(settings.privacyMode);
}

initialize();
