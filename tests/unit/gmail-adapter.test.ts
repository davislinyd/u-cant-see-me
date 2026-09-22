import { describe, expect, it } from "vitest";
import { GmailAdapter } from "../../src/adapters/gmail/gmail-adapter";
import { parseGmailRoute } from "../../src/adapters/gmail/gmail-route";
import type { MaskRule } from "../../src/shared/types";

const adapter = new GmailAdapter();

describe("GmailAdapter", () => {
  it("uses only rendered IDs and masks a selected message without masking siblings", () => {
    document.body.innerHTML = `<main data-thread-id="thread_alpha1"><h2 data-gmail-thread-subject>synthetic subject</h2><article data-message-id="message_one01"><div data-gmail-message-metadata>metadata one</div><div data-gmail-message-body>one</div></article><article data-message-id="message_two02"><div data-gmail-message-metadata>metadata two</div><div data-gmail-message-body>two</div></article></main>`;
    const resolution = adapter.resolve(rule({ messageId: "message_two02", maskThreadSubject: true }), document);

    expect(resolution.complete).toBe(true);
    expect(resolution.elements.map((element) => element.textContent)).toEqual(["synthetic subject", "two", "metadata two"]);
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

  it("uses the selected Gmail subject identity in split-pane inboxes", () => {
    document.body.innerHTML = `<main role="main"><table><tr><td class="yX"><div class="yW"><span class="yP">list sender</span></div></td><td class="a4W"><div class="y6"><span class="bog" data-gmail-list-subject>list subject</span><span data-thread-id="thread-new-format" data-legacy-thread-id="thread_current1"></span></div><span class="y2">list snippet</span></td></tr></table><h2 class="hP" data-thread-perm-id="thread-perm-current" data-legacy-thread-id="thread_current1">subject</h2><article data-message-id="message_one01"><div class="a3s aiL">body</div></article></main>`;

    expect(adapter.currentThreadId(document)).toBe("thread_current1");
    const resolution = adapter.resolve(rule({ threadId: "thread_current1", maskListSubject: true, maskListSnippet: true }), document);

    expect(resolution.complete).toBe(true);
    expect(resolution.elements.map((element) => element.textContent)).toEqual(["subject", "body", "list sender", "list subject", "list snippet"]);
  });

  it("does not mask a different reading-pane email when a protected row remains in the inbox", () => {
    document.body.innerHTML = `<main role="main"><table><tr><td class="yX"><span class="yP">protected sender</span></td><td><div class="y6"><span class="bog">protected subject</span><span data-legacy-thread-id="thread_alpha1"></span></div><span class="y2">protected snippet</span></td></tr></table><h2 class="hP" data-legacy-thread-id="thread_other2">other subject</h2><article data-message-id="message_other2"><span class="gD">other sender</span><div class="a3s aiL">other body</div></article></main>`;

    const resolution = adapter.resolve(rule({ maskListSubject: true, maskListSnippet: true }), document);

    expect(resolution.elements.map((element) => element.textContent)).toEqual(["protected sender", "protected subject", "protected snippet"]);
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
