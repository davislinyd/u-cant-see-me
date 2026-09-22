import type { ElementLocator, SiteAdapter, SiteLocation } from "../../shared/types";
import { resolveLocator } from "../../content/locator/locator-engine";
import { generateLocator } from "../../content/locator/selector-generator";

/**
 * Gmail-specific resolution is intentionally a stub in the foundation phase.
 * Keeping the site boundary explicit prevents Gmail selectors from leaking into
 * the generic locator and rendering layers.
 */
export class GmailAdapter implements SiteAdapter {
  readonly id = "gmail";
  readonly displayName = "Gmail";

  matches(location: SiteLocation): boolean {
    return location.hostname === "mail.google.com" || location.hostname.endsWith(".mail.google.com");
  }

  createLocator(element: Element): ElementLocator {
    return generateLocator(element);
  }

  resolve(locator: ElementLocator, root: ParentNode = document): Element | null {
    return resolveLocator(locator, root).element;
  }
}
