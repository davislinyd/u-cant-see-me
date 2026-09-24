import { afterEach, describe, expect, it, vi } from "vitest";
import { CURRENT_SCHEMA_VERSION, STORAGE_KEYS } from "../../src/shared/constants";
import { RuleStore } from "../../src/storage/rule-store";
import { SettingsStore } from "../../src/storage/settings-store";

afterEach(() => vi.unstubAllGlobals());

describe("storage store migrations", () => {
  it("persists normalized v1 Mosaic rules on first read", async () => {
    const data: Record<string, unknown> = {
      [STORAGE_KEYS.rules]: {
        schemaVersion: 1,
        rules: [{
          id: "legacy_mosaic",
          schemaVersion: 1,
          enabled: true,
          createdAt: 1,
          updatedAt: 1,
          scope: { kind: "origin", origin: "https://example.com" },
          locator: { primary: { kind: "tag", value: "button" }, fallbacks: [], fingerprint: {}, confidenceThreshold: 80 },
          style: { type: "mosaic", mosaicSize: 24 },
        }],
      },
    };
    const local = {
      get: vi.fn(async (key: string) => ({ [key]: data[key] })),
      set: vi.fn(async (items: Record<string, unknown>) => Object.assign(data, items)),
    };
    vi.stubGlobal("chrome", { storage: { local } });

    const store = new RuleStore();
    const rules = await store.list();
    await store.list();

    expect(rules[0]).toMatchObject({ schemaVersion: CURRENT_SCHEMA_VERSION, style: { type: "black" } });
    expect(rules[0]?.style).not.toHaveProperty("mosaicSize");
    expect(local.set).toHaveBeenCalledTimes(1);
    expect(data[STORAGE_KEYS.rules]).toMatchObject({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      rules: [{ schemaVersion: CURRENT_SCHEMA_VERSION, style: { type: "black" } }],
    });
  });

  it("persists normalized v1 Mosaic settings on first read", async () => {
    const data: Record<string, unknown> = {
      [STORAGE_KEYS.settings]: {
        schemaVersion: 1,
        settings: {
          schemaVersion: 1,
          defaultMaskStyle: { type: "mosaic", mosaicSize: 28 },
          mosaicSize: 28,
        },
      },
    };
    const sync = {
      get: vi.fn(async (key: string) => ({ [key]: data[key] })),
      set: vi.fn(async (items: Record<string, unknown>) => Object.assign(data, items)),
    };
    vi.stubGlobal("chrome", { storage: { sync } });

    const store = new SettingsStore();
    const settings = await store.get();
    await store.get();

    expect(settings.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(settings.defaultMaskStyle).toEqual({ type: "black" });
    expect(settings).not.toHaveProperty("mosaicSize");
    expect(sync.set).toHaveBeenCalledTimes(1);
    expect(data[STORAGE_KEYS.settings]).toMatchObject({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      settings: { schemaVersion: CURRENT_SCHEMA_VERSION, defaultMaskStyle: { type: "black" } },
    });
    expect(data[STORAGE_KEYS.settings]).not.toHaveProperty("settings.mosaicSize");
  });
});
