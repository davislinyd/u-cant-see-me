import { MESSAGE_TYPES } from "./constants";
import type { GmailMaskTarget, MaskRule, MaskStyle, PageStatus, TemporaryRevealState } from "./types";
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
  | { type: "CREATE_GMAIL_RULE"; target: GmailRuleOptions; style: MaskStyle; tabId?: number };

export type GmailRuleOptions = Omit<GmailMaskTarget, "threadId" | "messageId">;

export type MessageData =
  | undefined
  | boolean
  | MaskRule[]
  | PageStatus
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
