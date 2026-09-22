import type { AdapterResolution, ElementLocator, MaskRule, SiteAdapter, SiteLocation } from "../../shared/types";
import { resolveLocator } from "../../content/locator/locator-engine";
import { generateLocator } from "../../content/locator/selector-generator";

export class GenericAdapter implements SiteAdapter {
  readonly id = "generic";
  readonly displayName = "Generic webpage";

  matches(_location: SiteLocation, _document?: Document): boolean {
    return true;
  }

  createLocator(element: Element): ElementLocator {
    return generateLocator(element);
  }

  resolve(rule: MaskRule, root: ParentNode = document): AdapterResolution {
    const element = resolveLocator(rule.locator, root).element;
    return { elements: element ? [element] : [], complete: element !== null };
  }
}
