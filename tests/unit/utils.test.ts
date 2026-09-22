import { describe, expect, it } from "vitest";
import { matchesSiteScope, originPatternForUrl } from "../../src/shared/utils";

describe("site scope helpers", () => {
  it("matches exact, origin, and safe wildcard path scopes", () => {
    const href = "https://example.com/customer/123?view=summary";

    expect(matchesSiteScope({ kind: "exact-url", value: href }, href)).toBe(true);
    expect(matchesSiteScope({ kind: "origin", origin: "https://example.com" }, href)).toBe(true);
    expect(matchesSiteScope({ kind: "path-pattern", origin: "https://example.com", pathPattern: "/customer/*" }, href)).toBe(true);
    expect(matchesSiteScope({ kind: "path-pattern", origin: "https://example.com", pathPattern: "/admin/*" }, href)).toBe(false);
  });

  it("turns a supported URL into an optional host permission pattern", () => {
    expect(originPatternForUrl("https://example.com/account")).toBe("https://example.com/*");
    expect(originPatternForUrl("file:///tmp/page.html")).toBeNull();
  });
});
