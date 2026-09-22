import { afterEach, describe, expect, it, vi } from "vitest";
import { PrivacyGate } from "../../src/content/privacy-gate";
import type { PageStatus } from "../../src/shared/types";

const unresolved: PageStatus = {
  state: "unresolved",
  applicableRules: 1,
  activeMasks: 0,
  unresolvedRules: 1,
};

describe("PrivacyGate", () => {
  afterEach(() => {
    vi.useRealTimers();
    document.documentElement.removeAttribute("data-u-cant-see-me-privacy-gate");
    document.querySelector("[data-u-cant-see-me-owned]")?.remove();
  });

  it("does not reopen after initialization when a stale rule stays unresolved", () => {
    vi.useFakeTimers();
    const gate = new PrivacyGate();
    gate.install();
    gate.reconcile(unresolved);
    document.dispatchEvent(new Event("DOMContentLoaded"));

    expect(document.documentElement.hasAttribute("data-u-cant-see-me-privacy-gate")).toBe(true);
    vi.advanceTimersByTime(1_000);
    expect(document.documentElement.hasAttribute("data-u-cant-see-me-privacy-gate")).toBe(false);

    gate.reconcile(unresolved);
    expect(document.documentElement.hasAttribute("data-u-cant-see-me-privacy-gate")).toBe(false);
  });
});
