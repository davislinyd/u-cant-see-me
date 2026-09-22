import "./options.css";
import { RuleStore } from "../../storage/rule-store";
import { SettingsStore } from "../../storage/settings-store";
import { validateImportedConfiguration } from "../../storage/migrations";
import type { MaskRule, MaskType, PageDiagnostics, PrivacyMode, RuleTestResult, SiteScope } from "../../shared/types";
import type { ExtensionMessage, MessageResponse } from "../../shared/messages";
import { createId } from "../../shared/utils";

const ruleStore = new RuleStore();
const settingsStore = new SettingsStore();
const countElement = document.querySelector<HTMLElement>("#rule-count");
const emptyElement = document.querySelector<HTMLElement>("#empty-state");
const listElement = document.querySelector<HTMLUListElement>("#rule-list");
const feedbackElement = document.querySelector<HTMLElement>("#feedback");
const privacyModeElement = document.querySelector<HTMLSelectElement>("#privacy-mode");
const strictMaskElement = document.querySelector<HTMLInputElement>("#strict-mask");
const filterForm = document.querySelector<HTMLFormElement>("#rule-filters");
const refreshStatusButton = document.querySelector<HTMLButtonElement>("#refresh-status");
const exportButton = document.querySelector<HTMLButtonElement>("#export-config");
const importInput = document.querySelector<HTMLInputElement>("#import-config");
const diagnosticsButton = document.querySelector<HTMLButtonElement>("#load-diagnostics");
const diagnosticsOutput = document.querySelector<HTMLElement>("#diagnostics-output");
let rules: MaskRule[] = [];
const healthByRuleId = new Map<string, RuleTestResult>();

async function loadRules(): Promise<void> {
  try {
    rules = await ruleStore.list();
    renderRules();
  } catch {
    showFeedback("無法讀取規則儲存區。");
  }
}

function renderRules(): void {
  const filtered = rules.filter(matchesFilters);
  if (countElement) countElement.textContent = String(rules.length);
  if (emptyElement) emptyElement.hidden = rules.length > 0;
  if (!listElement) return;
  listElement.replaceChildren();
  for (const rule of filtered) listElement.append(createRuleItem(rule));
}

function createRuleItem(rule: MaskRule): HTMLLIElement {
  const item = document.createElement("li");
  item.className = "rule-item";
  item.dataset.ruleId = rule.id;
  const title = document.createElement("strong");
  title.textContent = `${adapterLabel(rule)} · ${rule.style.type} · ${rule.enabled ? "enabled" : "disabled"}`;
  const metadata = document.createElement("span");
  metadata.textContent = `${healthLabel(rule)} · ${rule.id}`;
  const controls = document.createElement("div");
  controls.className = "rule-controls";

  const enabled = checkbox("Enabled", rule.enabled, async (checked) => saveRule({ ...rule, enabled: checked, updatedAt: Date.now() }));
  const style = select(["black", "white", "blur", "mosaic"], rule.style.type, async (value) => {
    await saveRule({ ...rule, style: { ...rule.style, type: value as MaskType }, updatedAt: Date.now() });
  });
  style.setAttribute("aria-label", `Mask style for ${rule.id}`);
  const blurRadius = numberInput("Blur radius", rule.style.blurRadius ?? 14, async (value) => {
    await saveRule({ ...rule, style: { ...rule.style, blurRadius: value }, updatedAt: Date.now() });
  });
  const mosaicSize = numberInput("Mosaic size", rule.style.mosaicSize ?? 12, async (value) => {
    await saveRule({ ...rule, style: { ...rule.style, mosaicSize: value }, updatedAt: Date.now() });
  });
  const scopeKind = select(["exact-url", "origin", "path-pattern"], rule.scope.kind, async () => undefined);
  scopeKind.setAttribute("aria-label", `Scope kind for ${rule.id}`);
  const scopeValue = document.createElement("input");
  scopeValue.value = scopeToValue(rule.scope);
  scopeValue.setAttribute("aria-label", `Scope value for ${rule.id}`);
  scopeValue.addEventListener("change", () => {
    const scope = parseScope(scopeKind.value, scopeValue.value);
    if (!scope) {
      showFeedback("範圍格式無效；未儲存變更。");
      scopeValue.value = scopeToValue(rule.scope);
      return;
    }
    void saveRule({ ...rule, scope, updatedAt: Date.now() });
  });
  scopeKind.addEventListener("change", () => {
    const scope = parseScope(scopeKind.value, scopeValue.value);
    if (!scope) {
      showFeedback("請先輸入可用的 URL 或 origin/path pattern。");
      scopeKind.value = rule.scope.kind;
      return;
    }
    void saveRule({ ...rule, scope, updatedAt: Date.now() });
  });

  const testButton = button("Test locator", () => void testRule(rule));
  const duplicateButton = button("Duplicate", () => void duplicateRule(rule));
  const deleteButton = button("Delete", () => void deleteRule(rule));
  deleteButton.classList.add("danger-button");
  controls.append(enabled, style, blurRadius, mosaicSize, scopeKind, scopeValue, testButton, duplicateButton, deleteButton);
  item.append(title, metadata, controls);
  return item;
}

async function saveRule(rule: MaskRule): Promise<void> {
  const response = await chrome.runtime.sendMessage({ type: "SAVE_RULE", rule } satisfies ExtensionMessage) as MessageResponse;
  if (!response.ok) return showFeedback(response.error);
  showFeedback("規則已儲存。");
  await loadRules();
}

async function duplicateRule(rule: MaskRule): Promise<void> {
  const now = Date.now();
  await saveRule({ ...rule, id: createId("rule_copy"), createdAt: now, updatedAt: now });
}

async function deleteRule(rule: MaskRule): Promise<void> {
  const response = await chrome.runtime.sendMessage({ type: "REMOVE_RULE", ruleId: rule.id } satisfies ExtensionMessage) as MessageResponse;
  if (!response.ok) return showFeedback(response.error);
  healthByRuleId.delete(rule.id);
  showFeedback("規則已刪除。");
  await loadRules();
}

async function testRule(rule: MaskRule): Promise<void> {
  const response = await chrome.runtime.sendMessage({ type: "TEST_RULE", rule } satisfies ExtensionMessage) as MessageResponse;
  if (!response.ok || !isRuleTestResult(response.data)) return showFeedback(response.ok ? "目前分頁無法測試此規則。" : response.error);
  healthByRuleId.set(rule.id, response.data);
  showFeedback(response.data.resolved ? `定位成功：${response.data.targetCount} 個目標。` : "定位尚未解析；規則未變更。");
  renderRules();
}

async function refreshRuleHealth(): Promise<void> {
  for (const rule of rules) await testRule(rule);
  renderRules();
}

async function loadSettings(): Promise<void> {
  try {
    const settings = await settingsStore.get();
    if (privacyModeElement) privacyModeElement.value = settings.privacyMode;
    if (strictMaskElement) strictMaskElement.checked = settings.strictMask;
  } catch {
    showFeedback("無法讀取隱私設定。");
  }
}

privacyModeElement?.addEventListener("change", () => void settingsStore.update({ privacyMode: privacyModeElement.value as PrivacyMode }).then(() => showFeedback("隱私模式已儲存。")).catch(() => showFeedback("無法儲存隱私模式。")));
strictMaskElement?.addEventListener("change", () => void settingsStore.update({ strictMask: strictMaskElement.checked }).then(() => showFeedback("Strict Mask 設定已儲存。")).catch(() => showFeedback("無法儲存 Strict Mask 設定。")));
filterForm?.addEventListener("input", renderRules);
filterForm?.addEventListener("change", renderRules);
refreshStatusButton?.addEventListener("click", () => void refreshRuleHealth());
exportButton?.addEventListener("click", () => void exportConfiguration());
importInput?.addEventListener("change", () => void importConfiguration());
diagnosticsButton?.addEventListener("click", () => void loadDiagnostics());

async function loadDiagnostics(): Promise<void> {
  const response = await chrome.runtime.sendMessage({ type: "GET_PAGE_DIAGNOSTICS" } satisfies ExtensionMessage) as MessageResponse;
  if (!response.ok || !isPageDiagnostics(response.data)) return showFeedback(response.ok ? "目前分頁沒有可用的診斷資料。" : response.error);
  if (diagnosticsOutput) {
    diagnosticsOutput.hidden = false;
    diagnosticsOutput.textContent = JSON.stringify(response.data, null, 2);
  }
}

async function exportConfiguration(): Promise<void> {
  const [storedRules, settings] = await Promise.all([ruleStore.list(), settingsStore.get()]);
  const blob = new Blob([JSON.stringify({ schemaVersion: 1, rules: storedRules, settings }, null, 2)], { type: "application/json" });
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  anchor.download = "u-cant-see-me-config.json";
  anchor.click();
  URL.revokeObjectURL(anchor.href);
  showFeedback("設定已匯出。檔案可能包含 URL、結構屬性與 Gmail ID。");
}

async function importConfiguration(): Promise<void> {
  const file = importInput?.files?.[0];
  if (!file) return;
  try {
    const configuration = validateImportedConfiguration(JSON.parse(await file.text()));
    if (!configuration) throw new Error("invalid");
    await Promise.all([ruleStore.replace(configuration.rules), settingsStore.update(configuration.settings)]);
    const response = await chrome.runtime.sendMessage({ type: "RULES_CHANGED" } satisfies ExtensionMessage) as MessageResponse;
    if (!response.ok) throw new Error(response.error);
    healthByRuleId.clear();
    showFeedback("設定已匯入；temporary reveal 狀態不會匯入。");
    await Promise.all([loadRules(), loadSettings()]);
  } catch {
    showFeedback("匯入失敗：請選擇完整且有效的 U Cant See Me JSON 設定檔。 ");
  } finally {
    if (importInput) importInput.value = "";
  }
}

function matchesFilters(rule: MaskRule): boolean {
  const form = filterForm;
  if (!form) return true;
  const value = (name: string) => new FormData(form).get(name)?.toString().trim().toLowerCase() ?? "";
  const domain = value("domain");
  const url = value("url");
  const adapter = value("adapter");
  const style = value("style");
  const enabled = value("enabled");
  const health = value("health");
  const scope = scopeToValue(rule.scope).toLowerCase();
  return (!domain || scope.includes(domain)) && (!url || scope.includes(url)) &&
    (adapter === "all" || adapter === (rule.gmailTarget ? "gmail" : "generic")) &&
    (style === "all" || style === rule.style.type) &&
    (enabled === "all" || (enabled === "enabled") === rule.enabled) &&
    (health === "all" || health === (healthByRuleId.get(rule.id)?.resolved ? "resolved" : "unresolved"));
}

function parseScope(kind: string, value: string): SiteScope | null {
  try {
    const url = new URL(value);
    if (kind === "exact-url") return { kind, value: url.href };
    if (kind === "origin") return { kind, origin: url.origin };
    if (kind === "path-pattern") return { kind, origin: url.origin, pathPattern: `${url.pathname || "/"}${url.search || ""}` };
  } catch {
    return null;
  }
  return null;
}

function scopeToValue(scope: SiteScope): string {
  return scope.kind === "exact-url" ? scope.value : scope.kind === "origin" ? scope.origin : `${scope.origin}${scope.pathPattern}`;
}

function adapterLabel(rule: MaskRule): string { return rule.gmailTarget ? "Gmail" : "Generic"; }
function healthLabel(rule: MaskRule): string { const health = healthByRuleId.get(rule.id); return health ? (health.resolved ? "resolved" : "unresolved") : "not tested"; }
function showFeedback(message: string): void { if (feedbackElement) feedbackElement.textContent = message; }
function isRuleTestResult(value: unknown): value is RuleTestResult { return typeof value === "object" && value !== null && "resolved" in value && "targetCount" in value; }
function isPageDiagnostics(value: unknown): value is PageDiagnostics { return typeof value === "object" && value !== null && "adapterId" in value; }
function button(label: string, onClick: () => void): HTMLButtonElement { const element = document.createElement("button"); element.type = "button"; element.textContent = label; element.addEventListener("click", onClick); return element; }
function checkbox(label: string, checked: boolean, onChange: (checked: boolean) => Promise<void>): HTMLLabelElement { const element = document.createElement("label"); const input = document.createElement("input"); input.type = "checkbox"; input.checked = checked; input.addEventListener("change", () => void onChange(input.checked)); element.append(input, ` ${label}`); return element; }
function select(values: string[], current: string, onChange: (value: string) => Promise<void>): HTMLSelectElement { const element = document.createElement("select"); for (const value of values) { const option = new Option(value, value, false, value === current); element.append(option); } element.addEventListener("change", () => void onChange(element.value)); return element; }
function numberInput(label: string, current: number, onChange: (value: number) => Promise<void>): HTMLLabelElement { const element = document.createElement("label"); element.textContent = label; const input = document.createElement("input"); input.type = "number"; input.min = "1"; input.max = "100"; input.value = String(current); input.addEventListener("change", () => { const value = Number(input.value); if (Number.isFinite(value) && value >= 1 && value <= 100) void onChange(value); }); element.append(input); return element; }

void Promise.all([loadRules(), loadSettings()]);
