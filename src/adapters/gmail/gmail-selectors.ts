/** Gmail's rendered DOM is not a public API; this versioned profile isolates assumptions. */
export const gmailDomProfileVersion = "rendered-dom-v1";

export const GMAIL_SELECTORS = {
  threadRoot: "[data-thread-id], [data-legacy-thread-id], [data-thread-perm-id]",
  messageRoot: "[data-message-id], [data-legacy-message-id]",
  threadSubject: "[data-gmail-thread-subject], h2.hP",
  messageBody: "[data-gmail-message-body], .a3s.aiL",
  messageMetadata: "[data-gmail-message-metadata], .gD, .go, .g2",
  collapsedPreview: "[data-gmail-collapsed-preview], .kv",
  listRow: "tr[data-thread-id], tr[data-legacy-thread-id], [role='main'] [data-thread-id], [role='main'] [data-legacy-thread-id]",
  listSender: "[data-gmail-list-sender], .yX .yP",
  listSubject: "[data-gmail-list-subject], .y6 .bog",
  listSnippet: "[data-gmail-list-snippet], .y2",
} as const;

/** Explicit fixture marker. It never makes a production origin look like Gmail. */
export const GMAIL_SYNTHETIC_FIXTURE_ATTRIBUTE = "data-u-cant-see-me-gmail-fixture";
