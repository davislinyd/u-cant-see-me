import type { ElementFingerprint } from "../../shared/types";

export function scoreFingerprint(element: Element, fingerprint: ElementFingerprint): number {
  let score = 0;
  const htmlElement = element as HTMLElement;

  if (element.tagName.toLowerCase() === fingerprint.tagName) {
    score += 25;
  }

  if (fingerprint.role && element.getAttribute("role") === fingerprint.role) {
    score += 15;
  }

  if (fingerprint.elementType && htmlElement instanceof HTMLInputElement && htmlElement.type === fingerprint.elementType) {
    score += 10;
  }

  const stableEntries = Object.entries(fingerprint.stableAttributes);
  if (stableEntries.length > 0) {
    const matched = stableEntries.filter(([name, value]) => element.getAttribute(name) === value).length;
    score += Math.round((matched / stableEntries.length) * 30);
  }

  const classTokens = new Set(element.classList);
  if (fingerprint.classTokens.length > 0) {
    const matched = fingerprint.classTokens.filter((token) => classTokens.has(token)).length;
    score += Math.round((matched / fingerprint.classTokens.length) * 10);
  }

  const parentTags = collectParentTags(element);
  if (fingerprint.parentTags.length > 0) {
    const matched = fingerprint.parentTags.filter((tag, index) => parentTags[index] === tag).length;
    score += Math.round((matched / fingerprint.parentTags.length) * 5);
  }

  const childCount = element.children.length;
  if (childCount >= fingerprint.childCountRange.min && childCount <= fingerprint.childCountRange.max) {
    score += 5;
  }

  return Math.min(100, score);
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
