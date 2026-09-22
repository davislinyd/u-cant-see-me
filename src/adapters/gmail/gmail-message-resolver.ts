import { findGmailMessageRoot, gmailMessageId } from "./gmail-identifiers";
import { GMAIL_SELECTORS } from "./gmail-selectors";

export function resolveMessageSurfaces(root: ParentNode, messageId: string | undefined, selector: string): Element[] {
  const messageRoots = messageId
    ? [findGmailMessageRoot(root, messageId)].filter((element): element is Element => element !== null)
    : allMessageRoots(root);
  return messageRoots.flatMap((messageRoot) => collect(messageRoot, selector));
}

export function hasMessageIdentity(root: ParentNode, messageId: string): boolean {
  return findGmailMessageRoot(root, messageId) !== null;
}

function allMessageRoots(root: ParentNode): Element[] {
  const candidates = root instanceof Element && root.matches(GMAIL_SELECTORS.messageRoot)
    ? [root, ...root.querySelectorAll(GMAIL_SELECTORS.messageRoot)]
    : [...root.querySelectorAll(GMAIL_SELECTORS.messageRoot)];
  return candidates.filter((element) => gmailMessageId(element) !== null);
}

function collect(root: Element, selector: string): Element[] {
  return root.matches(selector) ? [root] : [...root.querySelectorAll(selector)];
}
