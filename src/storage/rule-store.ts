import { CURRENT_SCHEMA_VERSION, STORAGE_KEYS } from "../shared/constants";
import type { MaskRule } from "../shared/types";
import { isRecord } from "../shared/utils";
import { migrateRulesEnvelope } from "./migrations";

export class RuleStore {
  async list(): Promise<MaskRule[]> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.rules);
    const stored = result[STORAGE_KEYS.rules];
    const envelope = migrateRulesEnvelope(stored);
    if (needsUpgrade(stored, envelope.rules)) {
      try {
        await chrome.storage.local.set({ [STORAGE_KEYS.rules]: envelope });
      } catch {
        // The normalized rules remain usable for this read; retry migration later.
      }
    }
    return envelope.rules;
  }

  async save(rule: MaskRule): Promise<void> {
    await this.saveMany([rule]);
  }

  async saveMany(incomingRules: MaskRule[]): Promise<void> {
    const rules = await this.list();
    const normalizedIncoming = migrateRulesEnvelope({ schemaVersion: CURRENT_SCHEMA_VERSION, rules: incomingRules }).rules;
    const incomingIds = new Set(normalizedIncoming.map((rule) => rule.id));
    const nextRules = [
      ...rules.filter((candidate) => !incomingIds.has(candidate.id)),
      ...normalizedIncoming,
    ];
    await chrome.storage.local.set({
      [STORAGE_KEYS.rules]: {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        rules: nextRules,
      },
    });
  }

  async remove(ruleId: string): Promise<void> {
    const rules = await this.list();
    await chrome.storage.local.set({
      [STORAGE_KEYS.rules]: {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        rules: rules.filter((rule) => rule.id !== ruleId),
      },
    });
  }

  async replace(rules: MaskRule[]): Promise<void> {
    const normalizedRules = migrateRulesEnvelope({ schemaVersion: CURRENT_SCHEMA_VERSION, rules }).rules;
    await chrome.storage.local.set({
      [STORAGE_KEYS.rules]: {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        rules: normalizedRules,
      },
    });
  }
}

function needsUpgrade(stored: unknown, migratedRules: MaskRule[]): boolean {
  if (!isRecord(stored) || !Array.isArray(stored.rules) || migratedRules.length !== stored.rules.length) {
    return false;
  }
  if (typeof stored.schemaVersion === "number" && stored.schemaVersion < CURRENT_SCHEMA_VERSION) {
    return true;
  }
  return stored.rules.some((rule) => isRecord(rule) && (
    (typeof rule.schemaVersion === "number" && rule.schemaVersion < CURRENT_SCHEMA_VERSION) ||
    (isRecord(rule.style) && (rule.style.type === "mosaic" || "mosaicSize" in rule.style))
  ));
}
