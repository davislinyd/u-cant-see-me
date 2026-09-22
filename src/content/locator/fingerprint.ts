import type { ElementFingerprint } from "../../shared/types";

const SAFE_STABLE_ATTRIBUTES = ["id", "data-testid", "data-test", "data-qa", "data-cy", "role", "name", "type"] as const;
const SENSITIVE_VALUE_PATTERN = /@|token|secret|password|message|subject|body|content/i;

export function createFingerprint(element: Element): ElementFingerprint {
  const htmlElement = element as HTMLElement;
  const stableAttributes: Record<string, string> = {};

  for (const name of SAFE_STABLE_ATTRIBUTES) {
    const value = element.getAttribute(name);
    if (value && isSafeStructuralValue(value)) {
      stableAttributes[name] = value;
    }
  }

  const role = element.getAttribute("role") ?? undefined;
  const elementType = htmlElement instanceof HTMLInputElement
    ? htmlElement.type
    : undefined;
  const childCount = element.children.length;

  return {
    tagName: element.tagName.toLowerCase(),
    ...(role ? { role } : {}),
    ...(elementType ? { elementType } : {}),
    stableAttributes,
    classTokens: [...element.classList].filter(isSafeClassToken).slice(0, 12),
    parentTags: collectParentTags(element),
    childCountRange: {
      min: Math.max(0, childCount - 2),
      max: childCount + 2,
    },
  };
}

function collectParentTags(element: Element): string[] {
  const tags: string[] = [];
  let current = element.parentElement;
  while (current && tags.length < 5) {
    tags.push(current.tagName.toLowerCase());
    current = current.parentElement;
  }
  return tags;
}

function isSafeStructuralValue(value: string): boolean {
  return value.length <= 80 && !SENSITIVE_VALUE_PATTERN.test(value);
}

function isSafeClassToken(token: string): boolean {
  return token.length > 0 && token.length <= 60 && !SENSITIVE_VALUE_PATTERN.test(token);
}
