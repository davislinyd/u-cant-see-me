/** Gmail's rendered DOM is not a public API; this versioned profile isolates assumptions. */
export const gmailDomProfileVersion = "rendered-dom-v1";

export const GMAIL_SELECTORS = {
  threadRoot: "[data-thread-id], [data-legacy-thread-id]",
  messageRoot: "[data-message-id], [data-legacy-message-id]",
  threadSubject: "[data-gmail-thread-subject], h2.hP",
  messageBody: "[data-gmail-message-body], .a3s.aiL",
  collapsedPreview: "[data-gmail-collapsed-preview], .kv",
  listRow: "tr[data-thread-id], [role='main'] [data-thread-id]",
  listSubject: "[data-gmail-list-subject], .y6 > span",
  listSnippet: "[data-gmail-list-snippet], .y2",
} as const;

/** Explicit fixture marker. It never makes a production origin look like Gmail. */
export const GMAIL_SYNTHETIC_FIXTURE_ATTRIBUTE = "data-u-cant-see-me-gmail-fixture";
