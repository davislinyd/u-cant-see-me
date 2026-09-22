import { describe, expect, it } from "vitest";
import { resolveLocator } from "../../src/content/locator/locator-engine";
import { generateLocator } from "../../src/content/locator/selector-generator";

describe("locator foundation", () => {
  it("generates a stable structural locator without reading page text", () => {
    document.body.innerHTML = "<section><button id='save-button' data-testid='save'>Sensitive action</button></section>";
    const element = document.querySelector("button");

    expect(element).not.toBeNull();
    const locator = generateLocator(element as Element);

    expect(locator.primary).toEqual({ kind: "id", value: "save-button" });
    expect(locator.fingerprint.tagName).toBe("button");
    expect(locator.fingerprint.stableAttributes).not.toHaveProperty("innerText");
    expect(locator.fingerprint.stableAttributes).not.toHaveProperty("data-testid", "Sensitive action");
  });

  it("does not accept a low-confidence generic match", () => {
    document.body.innerHTML = "<div><span>one</span><span>two</span></div>";
    const original = document.querySelector("span");
    expect(original).not.toBeNull();
    const locator = generateLocator(original as Element);
    locator.confidenceThreshold = 95;

    const resolution = resolveLocator(locator);
    expect(resolution.element).toBeNull();
  });
});
