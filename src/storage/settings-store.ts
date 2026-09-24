import { CURRENT_SCHEMA_VERSION, DEFAULT_SETTINGS, STORAGE_KEYS } from "../shared/constants";
import type { ExtensionSettings } from "../shared/types";
import { isRecord } from "../shared/utils";
import { migrateSettingsEnvelope } from "./migrations";

export class SettingsStore {
  async get(): Promise<ExtensionSettings> {
    const result = await chrome.storage.sync.get(STORAGE_KEYS.settings);
    const stored = result[STORAGE_KEYS.settings];
    const envelope = migrateSettingsEnvelope(stored);
    if (needsUpgrade(stored)) {
      try {
        await chrome.storage.sync.set({ [STORAGE_KEYS.settings]: envelope });
      } catch {
        // The normalized settings remain usable for this read; retry migration later.
      }
    }
    return envelope.settings;
  }

  async update(patch: Partial<Omit<ExtensionSettings, "schemaVersion">>): Promise<ExtensionSettings> {
    const current = await this.get();
    const next: ExtensionSettings = {
      ...current,
      ...patch,
      schemaVersion: CURRENT_SCHEMA_VERSION,
    };
    await chrome.storage.sync.set({
      [STORAGE_KEYS.settings]: {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        settings: next,
      },
    });
    return next;
  }

  async reset(): Promise<ExtensionSettings> {
    const defaults: ExtensionSettings = {
      ...DEFAULT_SETTINGS,
      defaultMaskStyle: { ...DEFAULT_SETTINGS.defaultMaskStyle },
    };
    await chrome.storage.sync.set({
      [STORAGE_KEYS.settings]: {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        settings: defaults,
      },
    });
    return defaults;
  }
}

function needsUpgrade(stored: unknown): boolean {
  if (!isRecord(stored)) {
    return false;
  }
  if (typeof stored.schemaVersion === "number" && stored.schemaVersion < CURRENT_SCHEMA_VERSION) {
    return true;
  }
  if (!isRecord(stored.settings)) {
    return false;
  }
  const settings = stored.settings;
  const style = isRecord(settings.defaultMaskStyle) ? settings.defaultMaskStyle : {};
  return (typeof settings.schemaVersion === "number" && settings.schemaVersion < CURRENT_SCHEMA_VERSION) ||
    "mosaicSize" in settings ||
    style.type === "mosaic" ||
    "mosaicSize" in style;
}
