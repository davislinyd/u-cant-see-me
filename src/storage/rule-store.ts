import { CURRENT_SCHEMA_VERSION, STORAGE_KEYS } from "../shared/constants";
import type { MaskRule } from "../shared/types";
import { migrateRulesEnvelope } from "./migrations";

export class RuleStore {
  async list(): Promise<MaskRule[]> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.rules);
    const envelope = migrateRulesEnvelope(result[STORAGE_KEYS.rules]);
    return envelope.rules;
  }

  async save(rule: MaskRule): Promise<void> {
    await this.saveMany([rule]);
  }

  async saveMany(incomingRules: MaskRule[]): Promise<void> {
    const rules = await this.list();
    const incomingIds = new Set(incomingRules.map((rule) => rule.id));
    const nextRules = [
      ...rules.filter((candidate) => !incomingIds.has(candidate.id)),
      ...incomingRules,
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
    await chrome.storage.local.set({
      [STORAGE_KEYS.rules]: {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        rules,
      },
    });
  }
}
