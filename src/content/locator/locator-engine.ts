import type { ElementLocator, LocatorStrategy } from "../../shared/types";
import { scoreFingerprint } from "./confidence";

export interface LocatorResolution {
  element: Element | null;
  confidence: number;
  strategy: LocatorStrategy | null;
}

export function resolveLocator(locator: ElementLocator, root: ParentNode = document): LocatorResolution {
  const strategies = [locator.primary, ...locator.fallbacks];
  let bestRejectedConfidence = 0;

  for (const strategy of strategies) {
    const candidates = resolveStrategy(strategy, root);
    const scored = candidates
      .map((element) => ({ element, confidence: scoreFingerprint(element, locator.fingerprint) }))
      .filter((candidate) => candidate.confidence >= locator.confidenceThreshold)
      .sort((left, right) => right.confidence - left.confidence);

    const best = scored[0];
    const runnerUp = scored[1];
    if (best && (!runnerUp || best.confidence > runnerUp.confidence)) {
      return {
        element: best.element,
        confidence: best.confidence,
        strategy,
      };
    }
    bestRejectedConfidence = Math.max(bestRejectedConfidence, best?.confidence ?? 0);
  }

  return {
    element: null,
    confidence: bestRejectedConfidence,
    strategy: null,
  };
}

function resolveStrategy(strategy: LocatorStrategy, root: ParentNode): Element[] {
  switch (strategy.kind) {
    case "id": {
      return queryAll(root, `#${escapeCss(strategy.value)}`);
    }
    case "attribute":
      if (!/^[a-zA-Z_][a-zA-Z0-9_:-]*$/.test(strategy.name)) {
        return [];
      }
      return queryAll(root, `[${strategy.name}="${escapeAttribute(strategy.value)}"]`);
    case "role":
      return queryAll(root, `[role="${escapeAttribute(strategy.value)}"]`);
    case "tag":
      return queryAll(root, strategy.value);
    case "css":
      return queryAll(root, strategy.value);
    case "path":
      return queryAll(root, strategy.value);
  }
}

function queryAll(root: ParentNode, selector: string): Element[] {
  try {
    const rootMatches = root instanceof Element && root.matches(selector) ? [root] : [];
    return [...new Set([...rootMatches, ...root.querySelectorAll(selector)])];
  } catch {
    return [];
  }
}

function escapeCss(value: string): string {
  return globalThis.CSS?.escape?.(value) ?? value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

function escapeAttribute(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
