import { describe, expect, it } from "vitest";
import { CURRENT_SCHEMA_VERSION, DEFAULT_SETTINGS } from "../../src/shared/constants";
import { migrateStoredSchema, validateImportedConfiguration } from "../../src/storage/migrations";

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

  it("accepts Gmail rules containing IDs and options, but rejects malformed Gmail targets", () => {
    const baseRule = {
      id: "gmail_rule",
      schemaVersion: 1,
      enabled: true,
      createdAt: 1,
      updatedAt: 1,
      scope: { kind: "origin", origin: "https://mail.google.com" },
      locator: { primary: { kind: "tag", value: "main" }, fallbacks: [], fingerprint: {}, confidenceThreshold: 80 },
      style: { type: "black" },
    };
    const valid = {
      ...baseRule,
      gmailTarget: { threadId: "thread_alpha1", maskThreadSubject: true, maskMessageBody: true, maskCollapsedPreview: true, maskListSubject: true, maskListSnippet: true },
    };
    const invalid = { ...baseRule, id: "broken_gmail", gmailTarget: { threadId: "thread_alpha1" } };

    expect(migrateStoredSchema({ rules: [valid, invalid] }).rules).toEqual([valid]);
  });

  it("rejects an import envelope when any rule is malformed", () => {
    const configuration = {
      schemaVersion: 1,
      settings: DEFAULT_SETTINGS,
      rules: [
        { id: "valid", schemaVersion: 1, enabled: true, createdAt: 1, updatedAt: 1, scope: { kind: "origin", origin: "https://example.com" }, locator: {}, style: {} },
        { id: "invalid" },
      ],
    };

    expect(validateImportedConfiguration(configuration)).toBeNull();
  });
});
