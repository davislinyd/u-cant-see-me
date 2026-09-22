import { MESSAGE_TYPES } from "./constants";
import type { MaskRule, PageStatus, TemporaryRevealState } from "./types";
import { isRecord } from "./utils";

export type ExtensionMessage =
  | { type: "START_SELECTION"; tabId?: number }
  | { type: "STOP_SELECTION" }
  | { type: "SAVE_RULE"; rule: MaskRule }
  | { type: "REMOVE_RULE"; ruleId: string }
  | { type: "GET_RULES" }
  | { type: "REVEAL_RULE"; ruleId: string; durationMs: number }
  | { type: "REMASK_RULE"; ruleId: string }
  | { type: "RULES_CHANGED" }
  | { type: "GET_PAGE_STATUS" };

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
      return value.type !== "START_SELECTION" || value.tabId === undefined || typeof value.tabId === "number";
    case "REMOVE_RULE":
    case "REVEAL_RULE":
    case "REMASK_RULE":
      return typeof value.ruleId === "string" &&
        (value.type !== "REVEAL_RULE" || typeof value.durationMs === "number");
    case "SAVE_RULE":
      return isRecord(value.rule) && typeof value.rule.id === "string";
  }

  return false;
}
