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

  it("recovers a replacement after an id change, class change, and wrapper insertion", () => {
    document.body.innerHTML = `
      <main><section id="customer-view">
        <article id="legacy-target" role="region" class="privacy-card stable-card"><span></span></article>
      </section></main>
    `;
    const original = document.querySelector("#legacy-target");
    expect(original).not.toBeNull();
    const locator = generateLocator(original as Element);

    document.querySelector("#customer-view")?.replaceChildren(
      document.createRange().createContextualFragment(`
        <div class="new-wrapper">
          <article id="replacement-target" role="region" class="privacy-card refreshed-card"><span></span></article>
        </div>
      `),
    );

    const resolution = resolveLocator(locator);
    expect(resolution.element?.getAttribute("id")).toBe("replacement-target");
    expect(resolution.confidence).toBeGreaterThanOrEqual(locator.confidenceThreshold);
  });

  it("keeps ambiguous replacement candidates unresolved", () => {
    document.body.innerHTML = `
      <main><section id="customer-view">
        <article id="legacy-target" role="region" class="privacy-card stable-card"><span></span></article>
      </section></main>
    `;
    const original = document.querySelector("#legacy-target");
    expect(original).not.toBeNull();
    const locator = generateLocator(original as Element);

    document.querySelector("#customer-view")?.replaceChildren(
      document.createRange().createContextualFragment(`
        <article id="replacement-one" role="region" class="privacy-card stable-card"><span></span></article>
        <article id="replacement-two" role="region" class="privacy-card stable-card"><span></span></article>
      `),
    );

    const resolution = resolveLocator(locator);
    expect(resolution.element).toBeNull();
    expect(resolution.confidence).toBeGreaterThanOrEqual(locator.confidenceThreshold);
  });
});
