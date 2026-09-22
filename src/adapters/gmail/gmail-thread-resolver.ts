import { findGmailThreadRoot } from "./gmail-identifiers";
import { GMAIL_SELECTORS } from "./gmail-selectors";

export function resolveThreadSubject(root: ParentNode, threadId: string): Element[] {
  const threadRoot = findGmailThreadRoot(root, threadId);
  return threadRoot ? collect(threadRoot, GMAIL_SELECTORS.threadSubject) : [];
}

export function hasThreadIdentity(root: ParentNode, threadId: string): boolean {
  return findGmailThreadRoot(root, threadId) !== null;
}

function collect(root: Element, selector: string): Element[] {
  return root.matches(selector) ? [root] : [...root.querySelectorAll(selector)];
}
