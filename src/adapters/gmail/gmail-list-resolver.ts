import { gmailThreadId } from "./gmail-identifiers";
import { GMAIL_SELECTORS } from "./gmail-selectors";

export function resolveListSurfaces(root: ParentNode, threadId: string, selector: string): Element[] {
  return listRows(root, threadId).flatMap((row) => collect(row, selector));
}

function listRows(root: ParentNode, threadId: string): Element[] {
  const candidates = root instanceof Element && root.matches(GMAIL_SELECTORS.listRow)
    ? [root, ...root.querySelectorAll(GMAIL_SELECTORS.listRow)]
    : [...root.querySelectorAll(GMAIL_SELECTORS.listRow)];
  const rows = new Set<Element>();
  for (const candidate of candidates) {
    if (gmailThreadId(candidate) !== threadId) {
      continue;
    }
    // Gmail stores the thread identity in a span within the visual table row.
    // Fixtures and older layouts may put it directly on the row/container.
    rows.add(candidate.closest("tr") ?? candidate);
  }
  return [...rows];
}

function collect(root: Element, selector: string): Element[] {
  return root.matches(selector) ? [root] : [...root.querySelectorAll(selector)];
}
