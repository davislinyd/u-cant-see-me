export type MaskType = "black" | "white" | "blur" | "mosaic";

export interface MaskStyle {
  type: MaskType;
  blurRadius?: number;
  mosaicSize?: number;
}

export type LocatorStrategy =
  | { kind: "id"; value: string }
  | { kind: "attribute"; name: string; value: string }
  | { kind: "role"; value: string }
  | { kind: "tag"; value: string }
  | { kind: "css"; value: string }
  | { kind: "path"; value: string };

export interface ElementFingerprint {
  tagName: string;
  role?: string;
  elementType?: string;
  stableAttributes: Record<string, string>;
  classTokens: string[];
  parentTags: string[];
  childCountRange: {
    min: number;
    max: number;
  };
}

export interface ElementLocator {
  primary: LocatorStrategy;
  fallbacks: LocatorStrategy[];
  fingerprint: ElementFingerprint;
  confidenceThreshold: number;
}

export type SiteScope =
  | { kind: "exact-url"; value: string }
  | { kind: "path-pattern"; origin: string; pathPattern: string }
  | { kind: "origin"; origin: string };

export interface MaskRule {
  id: string;
  schemaVersion: number;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
  scope: SiteScope;
  locator: ElementLocator;
  style: MaskStyle;
  gmailTarget?: GmailMaskTarget;
}

/**
 * Gmail identities are rendered-DOM/route implementation details only.  Text
 * from subjects, snippets, and message bodies is deliberately not persisted.
 */
export interface GmailMaskTarget {
  threadId: string;
  routeId?: string;
  messageId?: string;
  maskThreadSubject: boolean;
  maskMessageBody: boolean;
  maskCollapsedPreview: boolean;
  maskListSubject: boolean;
  maskListSnippet: boolean;
}

export interface AdapterResolution {
  elements: Element[];
  complete: boolean;
}

export interface ActiveMask {
  ruleId: string;
  element: Element;
  rendererId: string;
  attachedAt: number;
}

export interface TemporaryRevealState {
  ruleId: string;
  revealedUntil: number;
  reason: "user" | "session";
}

export type PrivacyMode = "maximum" | "balanced" | "performance";
export type DebugLogging = "off" | "errors" | "verbose";

export interface ExtensionSettings {
  schemaVersion: number;
  protectionEnabled: boolean;
  defaultMaskStyle: MaskStyle;
  blurStrength: number;
  mosaicSize: number;
  strictMask: boolean;
  privacyMode: PrivacyMode;
  relockOnNavigation: boolean;
  relockOnWindowBlur: boolean;
  relockOnTabChange: boolean;
  debugLogging: DebugLogging;
}

export interface StoredSchema {
  schemaVersion: number;
  rules: MaskRule[];
  settings: ExtensionSettings;
}

export interface SiteLocation {
  href: string;
  origin: string;
  hostname: string;
  pathname: string;
}

export interface SiteAdapter {
  readonly id: string;
  readonly displayName: string;
  matches(location: SiteLocation, document?: Document): boolean;
  createLocator(element: Element): ElementLocator;
  resolve(rule: MaskRule, root?: ParentNode): AdapterResolution;
  readonly supportsMultipleTargets?: boolean;
}

export type PageProtectionState =
  | "protected"
  | "partially-protected"
  | "unresolved"
  | "protection-failure"
  | "no-masks";

export interface PageStatus {
  state: PageProtectionState;
  applicableRules: number;
  activeMasks: number;
  unresolvedRules: number;
  adapterId?: string;
}

export interface RuleTestResult {
  resolved: boolean;
  targetCount: number;
}

export type PageRuleAction = "disable-page" | "disable-site" | "remove-page";
