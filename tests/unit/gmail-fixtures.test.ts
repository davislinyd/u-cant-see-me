import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { GmailAdapter } from "../../src/adapters/gmail/gmail-adapter";

const adapter = new GmailAdapter();
const fixtures = [
  "gmail-thread-expanded.html",
  "gmail-thread-collapsed.html",
  "gmail-multi-message-thread.html",
  "gmail-inbox.html",
  "gmail-search.html",
  "gmail-delayed-body.html",
  "gmail-layout-variant.html",
];

describe("synthetic Gmail fixture compatibility", () => {
  for (const fixture of fixtures) {
    it(`recognizes ${fixture} without reading message text`, async () => {
      const parsed = new DOMParser().parseFromString(await readFile(resolve(process.cwd(), "tests/fixtures", fixture), "utf8"), "text/html");
      document.documentElement.innerHTML = parsed.documentElement.innerHTML;
      document.documentElement.toggleAttribute("data-u-cant-see-me-gmail-fixture", parsed.documentElement.hasAttribute("data-u-cant-see-me-gmail-fixture"));
      const diagnostics = adapter.diagnostics(document);

      expect(adapter.matches({ href: "http://127.0.0.1/fixture", origin: "http://127.0.0.1", hostname: "127.0.0.1", pathname: "/fixture" }, document)).toBe(true);
      expect(diagnostics.domProfileVersion).toBe("rendered-dom-v1");
      expect(diagnostics.threadIds).not.toContain("Fixture conversation subject");
      expect(diagnostics.messageIds.every((identifier) => !identifier.includes("Fixture"))).toBe(true);
    });
  }
});
