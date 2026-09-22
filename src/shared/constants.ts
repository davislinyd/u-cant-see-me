import type { ExtensionSettings, MaskStyle } from "./types";

export const CURRENT_SCHEMA_VERSION = 1;
export const CONTENT_READY_ATTRIBUTE = "data-u-cant-see-me-ready";
export const EXTENSION_ROOT_ATTRIBUTE = "data-u-cant-see-me-owned";

export const STORAGE_KEYS = {
  rules: "u-cant-see-me.rules",
  settings: "u-cant-see-me.settings",
} as const;

export const DEFAULT_MASK_STYLE: MaskStyle = {
  type: "black",
};

export const DEFAULT_SETTINGS: ExtensionSettings = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  protectionEnabled: true,
  defaultMaskStyle: DEFAULT_MASK_STYLE,
  blurStrength: 14,
  mosaicSize: 12,
  strictMask: false,
  privacyMode: "maximum",
  relockOnNavigation: true,
  relockOnWindowBlur: true,
  relockOnTabChange: true,
  debugLogging: "errors",
};

export const MESSAGE_TYPES = [
  "START_SELECTION",
  "STOP_SELECTION",
  "SAVE_RULE",
  "SAVE_RULES",
  "REMOVE_RULE",
  "GET_RULES",
  "REVEAL_RULE",
  "REMASK_RULE",
  "RULES_CHANGED",
  "GET_PAGE_STATUS",
] as const;

export const MASK_RENDERER_IDS = {
  pseudo: "pseudo-layer",
  filter: "filter",
  portal: "portal",
} as const;
