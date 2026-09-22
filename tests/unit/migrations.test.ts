import { describe, expect, it } from "vitest";
import { CURRENT_SCHEMA_VERSION, DEFAULT_SETTINGS } from "../../src/shared/constants";
import { migrateStoredSchema } from "../../src/storage/migrations";

describe("storage migrations", () => {
  it("normalizes an empty or old root into the current schema", () => {
    const result = migrateStoredSchema({ schemaVersion: 0, rules: "invalid" });

    expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.rules).toEqual([]);
    expect(result.settings).toEqual(DEFAULT_SETTINGS);
  });

  it("rejects malformed rules without discarding valid rules", () => {
    const validRule = {
      id: "rule_1",
      schemaVersion: 1,
      enabled: true,
      createdAt: 1,
      updatedAt: 1,
      scope: { kind: "origin", origin: "https://example.com" },
      locator: { primary: { kind: "tag", value: "button" }, fallbacks: [], fingerprint: {}, confidenceThreshold: 80 },
      style: { type: "black" },
    };

    const result = migrateStoredSchema({ rules: [validRule, null, { id: "broken" }] });
    expect(result.rules).toHaveLength(1);
    expect(result.rules[0]?.id).toBe("rule_1");
  });
});
