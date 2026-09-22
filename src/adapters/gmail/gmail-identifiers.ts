import { GMAIL_SELECTORS } from "./gmail-selectors";

const threadAttributes = ["data-thread-id", "data-legacy-thread-id"] as const;
const messageAttributes = ["data-message-id", "data-legacy-message-id"] as const;

export function gmailThreadId(element: Element): string | null {
  return readIdentifier(element, threadAttributes);
}

export function gmailMessageId(element: Element): string | null {
  return readIdentifier(element, messageAttributes);
}

export function findGmailThreadRoot(root: ParentNode, threadId: string): Element | null {
  return findByIdentifier(root, GMAIL_SELECTORS.threadRoot, threadAttributes, threadId);
}

export function findGmailMessageRoot(root: ParentNode, messageId: string): Element | null {
  return findByIdentifier(root, GMAIL_SELECTORS.messageRoot, messageAttributes, messageId);
}

function findByIdentifier(root: ParentNode, selector: string, attributes: readonly string[], identifier: string): Element | null {
  const candidates = root instanceof Element && root.matches(selector)
    ? [root, ...root.querySelectorAll(selector)]
    : [...root.querySelectorAll(selector)];
  return candidates.find((candidate) => readIdentifier(candidate, attributes) === identifier) ?? null;
}

function readIdentifier(element: Element, attributes: readonly string[]): string | null {
  for (const attribute of attributes) {
    const value = element.getAttribute(attribute);
    if (value && value.trim()) {
      return value;
    }
  }
  return null;
}
