import { describe, expect, it } from "vitest";
import { GmailAdapter } from "../../src/adapters/gmail/gmail-adapter";
import { parseGmailRoute } from "../../src/adapters/gmail/gmail-route";
import type { MaskRule } from "../../src/shared/types";

const adapter = new GmailAdapter();

describe("GmailAdapter", () => {
  it("uses only rendered IDs and masks a selected message without masking siblings", () => {
    document.body.innerHTML = `<main data-thread-id="thread_alpha1"><h2 data-gmail-thread-subject>synthetic subject</h2><article data-message-id="message_one01"><div data-gmail-message-body>one</div></article><article data-message-id="message_two02"><div data-gmail-message-body>two</div></article></main>`;
    const resolution = adapter.resolve(rule({ messageId: "message_two02", maskThreadSubject: true }), document);

    expect(resolution.complete).toBe(true);
    expect(resolution.elements.map((element) => element.textContent)).toEqual(["synthetic subject", "two"]);
  });

  it("keeps a collapsed body target pending and resolves its preview", () => {
    document.body.innerHTML = `<main data-thread-id="thread_alpha1"><article data-message-id="message_alpha1"><div data-gmail-collapsed-preview>preview</div></article></main>`;
    const resolution = adapter.resolve(rule({ maskThreadSubject: false, maskMessageBody: false, maskCollapsedPreview: true }), document);

    expect(resolution.complete).toBe(true);
    expect(resolution.elements).toHaveLength(1);
    expect(resolution.elements[0]?.getAttribute("data-gmail-collapsed-preview")).not.toBeNull();
  });

  it("keeps a requested body pending while only its collapsed preview exists", () => {
    document.body.innerHTML = `<main data-thread-id="thread_alpha1"><article data-message-id="message_alpha1"><div data-gmail-collapsed-preview>preview</div></article></main>`;
    const resolution = adapter.resolve(rule({ maskThreadSubject: false, maskCollapsedPreview: true }), document);

    expect(resolution.elements).toHaveLength(1);
    expect(resolution.complete).toBe(false);
  });

  it("resolves inbox/search surfaces by thread ID", () => {
    document.body.innerHTML = `<main role="main"><div data-thread-id="thread_alpha1"><span data-gmail-list-subject>subject</span><span data-gmail-list-snippet>snippet</span></div><div data-thread-id="thread_other2"><span data-gmail-list-subject>other</span></div></main>`;
    const resolution = adapter.resolve(rule({ maskThreadSubject: false, maskMessageBody: false, maskListSubject: true, maskListSnippet: true }), document);

    expect(resolution.complete).toBe(true);
    expect(resolution.elements).toHaveLength(2);
  });

  it("parses opaque Gmail thread routes without treating mailbox names as IDs", () => {
    expect(parseGmailRoute("https://mail.google.com/mail/u/0/#inbox/thread_alpha1")).toEqual({ kind: "thread", threadId: "thread_alpha1" });
    expect(parseGmailRoute("https://mail.google.com/mail/u/0/#inbox")).toEqual({ kind: "other" });
  });
});

function rule(overrides: Partial<NonNullable<MaskRule["gmailTarget"]>> = {}): MaskRule {
  return {
    id: "gmail-rule",
    schemaVersion: 1,
    enabled: true,
    createdAt: 1,
    updatedAt: 1,
    scope: { kind: "origin", origin: "https://mail.google.com" },
    locator: { primary: { kind: "tag", value: "main" }, fallbacks: [], fingerprint: {} as MaskRule["locator"]["fingerprint"], confidenceThreshold: 1 },
    style: { type: "black" },
    gmailTarget: {
      threadId: "thread_alpha1",
      maskThreadSubject: true,
      maskMessageBody: true,
      maskCollapsedPreview: false,
      maskListSubject: false,
      maskListSnippet: false,
      ...overrides,
    },
  };
}
