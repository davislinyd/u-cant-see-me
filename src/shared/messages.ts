import { MESSAGE_TYPES } from "./constants";
import type { GmailMaskTarget, MaskRule, MaskStyle, PageRuleAction, PageStatus, RuleTestResult, TemporaryRevealState } from "./types";
import { isRecord } from "./utils";

export type ExtensionMessage =
  | { type: "START_SELECTION"; tabId?: number }
  | { type: "STOP_SELECTION" }
  | { type: "SAVE_RULE"; rule: MaskRule }
  | { type: "SAVE_RULES"; rules: MaskRule[] }
  | { type: "REMOVE_RULE"; ruleId: string }
  | { type: "GET_RULES" }
  | { type: "REVEAL_RULE"; ruleId: string; durationMs: number; tabId?: number }
  | { type: "REVEAL_ALL"; durationMs: number; tabId?: number }
  | { type: "REMASK_RULE"; ruleId: string; tabId?: number }
  | { type: "RELOCK_ALL" }
  | { type: "RULES_CHANGED" }
  | { type: "GET_PAGE_STATUS" }
  | { type: "CREATE_GMAIL_RULE"; target: GmailRuleOptions; style: MaskStyle; tabId?: number }
  | { type: "TEST_RULE"; rule: MaskRule; tabId?: number }
  | { type: "MANAGE_PAGE_RULES"; action: PageRuleAction; tabId?: number }
  | { type: "MASK_CONTEXT_ELEMENT"; tabId?: number }
  | { type: "REVEAL_CONTEXT_ELEMENT"; tabId?: number }
  | { type: "REMOVE_CONTEXT_MASK"; tabId?: number }
  | { type: "PROTECT_GMAIL_CONTEXT_MESSAGE"; tabId?: number }
  | { type: "START_EDIT_MODE"; tabId?: number }
  | { type: "STOP_EDIT_MODE"; tabId?: number }
  | { type: "UPDATE_BADGE"; status: PageStatus };

export type GmailRuleOptions = Omit<GmailMaskTarget, "threadId" | "messageId">;

export type MessageData =
  | undefined
  | boolean
  | MaskRule[]
  | PageStatus
  | RuleTestResult
  | TemporaryRevealState;

export type MessageResponse =
  | { ok: true; data?: MessageData }
  | { ok: false; error: string };

export function isExtensionMessage(value: unknown): value is ExtensionMessage {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false;
  }

  if (!(MESSAGE_TYPES as readonly string[]).includes(value.type)) {
    return false;
  }

  switch (value.type) {
    case "START_SELECTION":
    case "STOP_SELECTION":
    case "GET_RULES":
    case "RULES_CHANGED":
    case "GET_PAGE_STATUS":
    case "RELOCK_ALL":
    case "MASK_CONTEXT_ELEMENT":
    case "REVEAL_CONTEXT_ELEMENT":
    case "REMOVE_CONTEXT_MASK":
    case "PROTECT_GMAIL_CONTEXT_MESSAGE":
    case "START_EDIT_MODE":
    case "STOP_EDIT_MODE":
      return value.type !== "START_SELECTION" || value.tabId === undefined || typeof value.tabId === "number";
    case "REMOVE_RULE":
      return typeof value.ruleId === "string";
    case "REVEAL_RULE":
      return typeof value.ruleId === "string" && typeof value.durationMs === "number" &&
        (value.tabId === undefined || typeof value.tabId === "number");
    case "REVEAL_ALL":
      return typeof value.durationMs === "number" &&
        (value.tabId === undefined || typeof value.tabId === "number");
    case "REMASK_RULE":
      return typeof value.ruleId === "string" &&
        (value.tabId === undefined || typeof value.tabId === "number");
    case "SAVE_RULE":
      return isRecord(value.rule) && typeof value.rule.id === "string";
    case "SAVE_RULES":
      return Array.isArray(value.rules) && value.rules.every((rule) => isRecord(rule) && typeof rule.id === "string");
    case "CREATE_GMAIL_RULE":
      return isGmailRuleOptions(value.target) && isRecord(value.style) &&
        typeof value.style.type === "string" && (value.tabId === undefined || typeof value.tabId === "number");
    case "TEST_RULE":
      return isRecord(value.rule) && typeof value.rule.id === "string" &&
        (value.tabId === undefined || typeof value.tabId === "number");
    case "MANAGE_PAGE_RULES":
      return (value.action === "disable-page" || value.action === "disable-site" || value.action === "remove-page") &&
        (value.tabId === undefined || typeof value.tabId === "number");
    case "UPDATE_BADGE":
      return isRecord(value.status) && typeof value.status.state === "string";
  }

  return false;
}

function isGmailRuleOptions(value: unknown): value is GmailRuleOptions {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value.maskThreadSubject === "boolean" &&
    typeof value.maskMessageBody === "boolean" &&
    typeof value.maskCollapsedPreview === "boolean" &&
    typeof value.maskListSubject === "boolean" &&
    typeof value.maskListSnippet === "boolean";
}
