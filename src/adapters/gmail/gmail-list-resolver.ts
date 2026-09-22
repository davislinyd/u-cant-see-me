import { gmailThreadId } from "./gmail-identifiers";
import { GMAIL_SELECTORS } from "./gmail-selectors";

export function resolveListSurfaces(root: ParentNode, threadId: string, selector: string): Element[] {
  return listRows(root, threadId).flatMap((row) => collect(row, selector));
}

function listRows(root: ParentNode, threadId: string): Element[] {
  const candidates = root instanceof Element && root.matches(GMAIL_SELECTORS.listRow)
    ? [root, ...root.querySelectorAll(GMAIL_SELECTORS.listRow)]
    : [...root.querySelectorAll(GMAIL_SELECTORS.listRow)];
  return candidates.filter((row) => gmailThreadId(row) === threadId);
}

function collect(root: Element, selector: string): Element[] {
  return root.matches(selector) ? [root] : [...root.querySelectorAll(selector)];
}
