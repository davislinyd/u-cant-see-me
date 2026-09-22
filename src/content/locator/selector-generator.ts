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

  const role = element.getAttribute("role");
  if (role && isStableToken(role)) {
    return { kind: "role", value: role };
  }

  return { kind: "tag", value: element.tagName.toLowerCase() };
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
  const tag = element.tagName.toLowerCase();

  if (name && isStableToken(name) && !isSameStrategy(primary, { kind: "attribute", name: "name", value: name })) {
    fallbacks.push({ kind: "attribute", name: "name", value: name });
  }

  if (type && isStableToken(type)) {
    fallbacks.push({ kind: "attribute", name: "type", value: type });
  }

  if (!isSameStrategy(primary, { kind: "tag", value: tag })) {
    fallbacks.push({ kind: "tag", value: tag });
  }

  return fallbacks;
}

function isStableToken(value: string): boolean {
  return value.length <= 80 && /^[a-zA-Z0-9:_-]+$/.test(value);
}

function isSameStrategy(left: LocatorStrategy, right: LocatorStrategy): boolean {
  return left.kind === right.kind && left.value === right.value &&
    (left.kind !== "attribute" || right.kind !== "attribute" || left.name === right.name);
}
