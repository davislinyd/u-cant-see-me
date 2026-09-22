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
    score += Math.round((matched / stableEntries.length) * 50);
  }

  const classTokens = new Set(element.classList);
  if (fingerprint.classTokens.length > 0) {
    const shared = fingerprint.classTokens.filter((token) => classTokens.has(token)).length;
    const unionSize = new Set([...fingerprint.classTokens, ...classTokens]).size;
    score += Math.round((shared / unionSize) * 25);
  }

  const parentTags = collectParentTags(element);
  if (fingerprint.parentTags.length > 0) {
    const shared = longestCommonSubsequenceLength(fingerprint.parentTags, parentTags);
    score += Math.round((shared / fingerprint.parentTags.length) * 25);
  }

  const childCount = element.children.length;
  if (childCount >= fingerprint.childCountRange.min && childCount <= fingerprint.childCountRange.max) {
    score += 10;
  }

  return Math.min(100, score);
}

function longestCommonSubsequenceLength(left: string[], right: string[]): number {
  const lengths = Array.from({ length: right.length + 1 }, () => 0);

  for (const leftToken of left) {
    let diagonal = 0;
    for (let index = 1; index <= right.length; index += 1) {
      const previous = lengths[index] ?? 0;
      if (leftToken === right[index - 1]) {
        lengths[index] = diagonal + 1;
      } else {
        lengths[index] = Math.max(lengths[index - 1] ?? 0, previous);
      }
      diagonal = previous;
    }
  }

  return lengths[right.length] ?? 0;
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
