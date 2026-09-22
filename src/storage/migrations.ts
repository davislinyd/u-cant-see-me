import { CURRENT_SCHEMA_VERSION, DEFAULT_SETTINGS } from "../shared/constants";
import type { ExtensionSettings, MaskRule, StoredSchema } from "../shared/types";
import { isRecord } from "../shared/utils";

export interface StoredRulesEnvelope {
  schemaVersion: number;
  rules: MaskRule[];
}

export interface StoredSettingsEnvelope {
  schemaVersion: number;
  settings: ExtensionSettings;
}

export function migrateStoredSchema(input: unknown): StoredSchema {
  const record = isRecord(input) ? input : {};
  const rules = Array.isArray(record.rules) ? record.rules.filter(isMaskRule) : [];
  const settings = migrateSettings(record.settings);

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    rules,
    settings,
  };
}

export function migrateRulesEnvelope(input: unknown): StoredRulesEnvelope {
  const record = isRecord(input) ? input : {};
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    rules: Array.isArray(record.rules) ? record.rules.filter(isMaskRule) : [],
  };
}

export function migrateSettingsEnvelope(input: unknown): StoredSettingsEnvelope {
  const record = isRecord(input) ? input : {};
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    settings: migrateSettings(record.settings),
  };
}

function migrateSettings(input: unknown): ExtensionSettings {
  const source = isRecord(input) ? input : {};
  const defaultStyle = DEFAULT_SETTINGS.defaultMaskStyle;
  const sourceStyle = isRecord(source.defaultMaskStyle) ? source.defaultMaskStyle : {};

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    protectionEnabled: source.protectionEnabled !== false,
    defaultMaskStyle: {
      type: sourceStyle.type === "white" || sourceStyle.type === "blur" || sourceStyle.type === "mosaic"
        ? sourceStyle.type
        : defaultStyle.type,
      ...(typeof sourceStyle.blurRadius === "number" ? { blurRadius: sourceStyle.blurRadius } : {}),
      ...(typeof sourceStyle.mosaicSize === "number" ? { mosaicSize: sourceStyle.mosaicSize } : {}),
    },
    blurStrength: typeof source.blurStrength === "number" ? source.blurStrength : DEFAULT_SETTINGS.blurStrength,
    mosaicSize: typeof source.mosaicSize === "number" ? source.mosaicSize : DEFAULT_SETTINGS.mosaicSize,
    strictMask: source.strictMask === true,
    privacyMode: source.privacyMode === "balanced" || source.privacyMode === "performance"
      ? source.privacyMode
      : DEFAULT_SETTINGS.privacyMode,
    relockOnNavigation: source.relockOnNavigation !== false,
    relockOnWindowBlur: source.relockOnWindowBlur !== false,
    relockOnTabChange: source.relockOnTabChange !== false,
    debugLogging: source.debugLogging === "off" || source.debugLogging === "verbose"
      ? source.debugLogging
      : DEFAULT_SETTINGS.debugLogging,
  };
}

function isMaskRule(value: unknown): value is MaskRule {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.id === "string" &&
    typeof value.schemaVersion === "number" &&
    typeof value.enabled === "boolean" &&
    typeof value.createdAt === "number" &&
    typeof value.updatedAt === "number" &&
    isRecord(value.scope) &&
    isRecord(value.locator) &&
    isRecord(value.style);
}
