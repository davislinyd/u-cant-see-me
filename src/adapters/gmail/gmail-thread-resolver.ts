import { findGmailThreadRoot, gmailThreadId } from "./gmail-identifiers";
import { GMAIL_SELECTORS } from "./gmail-selectors";

export function resolveThreadSubject(root: ParentNode, threadId: string): Element[] {
  const subjects = root instanceof Element && root.matches(GMAIL_SELECTORS.threadSubject)
    ? [root, ...root.querySelectorAll(GMAIL_SELECTORS.threadSubject)]
    : [...root.querySelectorAll(GMAIL_SELECTORS.threadSubject)];
  const matchingSubjects = subjects.filter((subject) => gmailThreadId(subject) === threadId);
  if (matchingSubjects.length > 0) {
    return matchingSubjects;
  }

  // Synthetic/legacy markup can identify only the surrounding conversation
  // container. Production Gmail identifies h2.hP itself.
  const threadRoot = findGmailThreadRoot(root, threadId);
  return threadRoot ? collect(threadRoot, GMAIL_SELECTORS.threadSubject) : [];
}

export function hasThreadIdentity(root: ParentNode, threadId: string): boolean {
  return findGmailThreadRoot(root, threadId) !== null;
}

function collect(root: Element, selector: string): Element[] {
  return root.matches(selector) ? [root] : [...root.querySelectorAll(selector)];
}
