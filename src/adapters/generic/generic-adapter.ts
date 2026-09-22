import type { ElementLocator, SiteAdapter, SiteLocation } from "../../shared/types";
import { resolveLocator } from "../../content/locator/locator-engine";
import { generateLocator } from "../../content/locator/selector-generator";

export class GenericAdapter implements SiteAdapter {
  readonly id = "generic";
  readonly displayName = "Generic webpage";

  matches(_location: SiteLocation): boolean {
    return true;
  }

  createLocator(element: Element): ElementLocator {
    return generateLocator(element);
  }

  resolve(locator: ElementLocator, root: ParentNode = document): Element | null {
    return resolveLocator(locator, root).element;
  }
}
