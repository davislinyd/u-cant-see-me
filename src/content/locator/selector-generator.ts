import type { ElementLocator, LocatorStrategy } from "../../shared/types";
import { createFingerprint } from "./fingerprint";

const STABLE_ATTRIBUTE_NAMES = ["data-testid", "data-test", "data-qa", "data-cy"] as const;

export function generateLocator(element: Element): ElementLocator {
  const primary = choosePrimaryStrategy(element);
  const fallbacks = buildFallbacks(element, primary);

  return {
    primary,
    fallbacks,
    fingerprint: createFingerprint(element),
    confidenceThreshold: 80,
  };
}

function choosePrimaryStrategy(element: Element): LocatorStrategy {
  const id = element.getAttribute("id");
  if (id && isStableToken(id)) {
    return { kind: "id", value: id };
  }

  for (const attribute of STABLE_ATTRIBUTE_NAMES) {
    const value = element.getAttribute(attribute);
    if (value && isStableToken(value)) {
      return { kind: "attribute", name: attribute, value };
    }
  }

  // A tag or role alone is never specific enough for real application UIs.
  // Preserve an exact structural path as the primary selector, then let the
  // fingerprint-backed fallbacks handle intentional DOM replacements.
  return { kind: "css", value: createStructuralPath(element) };
}

function buildFallbacks(element: Element, primary: LocatorStrategy): LocatorStrategy[] {
  const fallbacks: LocatorStrategy[] = [];
  for (const attribute of STABLE_ATTRIBUTE_NAMES) {
    const value = element.getAttribute(attribute);
    const strategy: LocatorStrategy = { kind: "attribute", name: attribute, value: value ?? "" };
    if (value && isStableToken(value) && !isSameStrategy(primary, strategy)) {
      fallbacks.push(strategy);
    }
  }

  const role = element.getAttribute("role");
  if (role && isStableToken(role) && !isSameStrategy(primary, { kind: "role", value: role })) {
    fallbacks.push({ kind: "role", value: role });
  }

  const name = element.getAttribute("name");
  const type = element.getAttribute("type");
  if (name && isStableToken(name) && !isSameStrategy(primary, { kind: "attribute", name: "name", value: name })) {
    fallbacks.push({ kind: "attribute", name: "name", value: name });
  }

  if (type && isStableToken(type)) {
    fallbacks.push({ kind: "attribute", name: "type", value: type });
  }

  return fallbacks;
}

function createStructuralPath(element: Element): string {
  const anchor = nearestStableIdAncestor(element);
  const segments: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.body && current !== anchor) {
    const tag = current.tagName.toLowerCase();
    const siblings = current.parentElement
      ? [...current.parentElement.children].filter((sibling) => sibling.tagName === current?.tagName)
      : [];
    const index = siblings.indexOf(current) + 1;
    segments.unshift(`${tag}:nth-of-type(${Math.max(1, index)})`);
    current = current.parentElement;
  }

  const prefix = anchor ? `#${anchor.id}` : "body";
  return segments.length > 0 ? `${prefix} > ${segments.join(" > ")}` : prefix;
}

function isStableToken(value: string): boolean {
  return value.length <= 80 && /^[a-zA-Z0-9:_-]+$/.test(value) && !/^:r[\w-]+:$/.test(value);
}

function nearestStableIdAncestor(element: Element): Element | null {
  for (let current = element.parentElement; current && current !== document.body; current = current.parentElement) {
    if (current.id && isStableToken(current.id)) {
      return current;
    }
  }
  return null;
}

function isSameStrategy(left: LocatorStrategy, right: LocatorStrategy): boolean {
  return left.kind === right.kind && left.value === right.value &&
    (left.kind !== "attribute" || right.kind !== "attribute" || left.name === right.name);
}
