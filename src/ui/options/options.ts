import "./options.css";
import { RuleStore } from "../../storage/rule-store";
import { SettingsStore } from "../../storage/settings-store";
import type { MaskRule, PrivacyMode } from "../../shared/types";

const ruleStore = new RuleStore();
const settingsStore = new SettingsStore();
const countElement = document.querySelector<HTMLElement>("#rule-count");
const emptyElement = document.querySelector<HTMLElement>("#empty-state");
const listElement = document.querySelector<HTMLUListElement>("#rule-list");
const feedbackElement = document.querySelector<HTMLElement>("#feedback");
const privacyModeElement = document.querySelector<HTMLSelectElement>("#privacy-mode");
const strictMaskElement = document.querySelector<HTMLInputElement>("#strict-mask");

async function loadRules(): Promise<void> {
  try {
    const rules = await ruleStore.list();
    renderRules(rules);
  } catch {
    if (feedbackElement) {
      feedbackElement.textContent = "無法讀取規則儲存區。";
    }
  }
}

function renderRules(rules: MaskRule[]): void {
  if (countElement) {
    countElement.textContent = String(rules.length);
  }
  if (emptyElement) {
    emptyElement.hidden = rules.length > 0;
  }
  if (!listElement) {
    return;
  }

  listElement.replaceChildren();
  for (const rule of rules) {
    const item = document.createElement("li");
    item.className = "rule-item";

    const title = document.createElement("strong");
    title.textContent = `${rule.style.type} mask · ${rule.enabled ? "enabled" : "disabled"}`;

    const metadata = document.createElement("span");
    metadata.textContent = `${rule.scope.kind} · ${rule.id}`;

    item.append(title, metadata);
    listElement.append(item);
  }
}

async function loadSettings(): Promise<void> {
  try {
    const settings = await settingsStore.get();
    if (privacyModeElement) {
      privacyModeElement.value = settings.privacyMode;
    }
    if (strictMaskElement) {
      strictMaskElement.checked = settings.strictMask;
    }
  } catch {
    if (feedbackElement) {
      feedbackElement.textContent = "無法讀取隱私設定。";
    }
  }
}

privacyModeElement?.addEventListener("change", () => {
  const privacyMode = privacyModeElement.value as PrivacyMode;
  void settingsStore.update({ privacyMode })
    .then(() => {
      if (feedbackElement) {
        feedbackElement.textContent = "隱私模式已儲存。";
      }
    })
    .catch(() => {
      if (feedbackElement) {
        feedbackElement.textContent = "無法儲存隱私模式。";
      }
    });
});

strictMaskElement?.addEventListener("change", () => {
  void settingsStore.update({ strictMask: strictMaskElement.checked })
    .then(() => {
      if (feedbackElement) {
        feedbackElement.textContent = "Strict Mask 設定已儲存。";
      }
    })
    .catch(() => {
      if (feedbackElement) {
        feedbackElement.textContent = "無法儲存 Strict Mask 設定。";
      }
    });
});

void loadRules();
void loadSettings();
