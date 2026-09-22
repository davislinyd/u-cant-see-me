import "./options.css";
import { RuleStore } from "../../storage/rule-store";
import type { MaskRule } from "../../shared/types";

const ruleStore = new RuleStore();
const countElement = document.querySelector<HTMLElement>("#rule-count");
const emptyElement = document.querySelector<HTMLElement>("#empty-state");
const listElement = document.querySelector<HTMLUListElement>("#rule-list");
const feedbackElement = document.querySelector<HTMLElement>("#feedback");

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

void loadRules();
