import type { AdapterResolution, ElementLocator, GmailDiagnostics, GmailMaskTarget, MaskRule, SiteAdapter, SiteLocation } from "../../shared/types";
import { resolveLocator } from "../../content/locator/locator-engine";
import { generateLocator } from "../../content/locator/selector-generator";
import { findGmailThreadRoot, gmailMessageId, gmailThreadId } from "./gmail-identifiers";
import { resolveListSurfaces } from "./gmail-list-resolver";
import { hasMessageIdentity, resolveMessageSurfaces } from "./gmail-message-resolver";
import { isProtectedGmailThreadRoute, parseGmailRoute } from "./gmail-route";
import { GMAIL_SELECTORS, GMAIL_SYNTHETIC_FIXTURE_ATTRIBUTE, gmailDomProfileVersion } from "./gmail-selectors";
import { hasThreadIdentity, resolveThreadSubject } from "./gmail-thread-resolver";

/**
 * Gmail-specific resolution is isolated here so the generic masking engine
 * only sees SiteAdapter targets, never Gmail DOM selectors.
 */
export class GmailAdapter implements SiteAdapter {
  readonly id = "gmail";
  readonly displayName = "Gmail";
  readonly supportsMultipleTargets = true;
  readonly domProfileVersion = gmailDomProfileVersion;

  matches(location: SiteLocation, document?: Document): boolean {
    return location.hostname === "mail.google.com" ||
      location.hostname.endsWith(".mail.google.com") ||
      document?.documentElement.hasAttribute(GMAIL_SYNTHETIC_FIXTURE_ATTRIBUTE) === true;
  }

  createLocator(element: Element): ElementLocator {
    return generateLocator(element);
  }

  resolve(rule: MaskRule, root: ParentNode = document): AdapterResolution {
    if (!rule.gmailTarget) {
      const element = resolveLocator(rule.locator, root).element;
      return { elements: element ? [element] : [], complete: element !== null };
    }
    return resolveGmailTarget(root, rule.gmailTarget);
  }

  currentThreadId(root: ParentNode = document): string | null {
    const selectedThreadId = [...root.querySelectorAll(GMAIL_SELECTORS.threadSubject)]
      .map((element) => gmailThreadId(element))
      .find((identifier): identifier is string => identifier !== null);
    if (selectedThreadId) {
      return selectedThreadId;
    }

    const route = parseGmailRoute(window.location.href);
    if (route.kind !== "thread" || !route.threadId) {
      return null;
    }
    const routeRoot = findGmailThreadRoot(root, route.threadId);
    return routeRoot ? gmailThreadId(routeRoot) : null;
  }

  isProtectedThreadRoute(href: string, rule: MaskRule): boolean {
    return rule.gmailTarget !== undefined && isProtectedGmailThreadRoute(href, rule.gmailTarget.routeId ?? rule.gmailTarget.threadId);
  }

  currentRouteId(href: string = window.location.href): string | undefined {
    const route = parseGmailRoute(href);
    return route.kind === "thread" ? route.threadId : undefined;
  }

  messageIdForElement(element: Element): string | undefined {
    const messageRoot = element.closest(GMAIL_SELECTORS.messageRoot);
    return messageRoot ? gmailMessageId(messageRoot) ?? undefined : undefined;
  }

  diagnostics(root: ParentNode = document): GmailDiagnostics {
    const identifiers = (selector: string, read: (element: Element) => string | null) => [...root.querySelectorAll(selector)]
      .map(read).filter((value): value is string => value !== null);
    const extensionRoot = document.querySelector("[data-u-cant-see-me-owned]") as HTMLElement | null;
    return {
      domProfileVersion: this.domProfileVersion,
      threadIds: [...new Set(identifiers(GMAIL_SELECTORS.threadRoot, gmailThreadId))],
      messageIds: [...new Set(identifiers(GMAIL_SELECTORS.messageRoot, gmailMessageId))],
      subjectSurfaceFound: root.querySelector(GMAIL_SELECTORS.threadSubject) !== null,
      bodySurfaceFound: root.querySelector(GMAIL_SELECTORS.messageBody) !== null,
      listSurfaceFound: root.querySelector(GMAIL_SELECTORS.listSubject) !== null || root.querySelector(GMAIL_SELECTORS.listSnippet) !== null,
      guardActive: extensionRoot?.shadowRoot?.querySelector(".u-cant-see-me-gmail-guard") !== null,
    };
  }
}

function resolveGmailTarget(root: ParentNode, target: GmailMaskTarget): AdapterResolution {
  const elements = new Set<Element>();
  const messagePresent = !target.messageId || hasMessageIdentity(root, target.messageId);
  const add = (items: Element[]) => items.forEach((item) => elements.add(item));
  const currentThreadSubjects = resolveThreadSubject(root, target.threadId);
  // A real reading pane has h2.hP with its own thread ID. Do not fall back to
  // a matching inbox row once another conversation is open in that pane.
  // Legacy/synthetic collapsed layouts may not render h2.hP yet.
  const currentThreadPresent = currentThreadSubjects.length > 0 ||
    (root.querySelector("h2.hP") === null && hasThreadIdentity(root, target.threadId));
  const subjects = target.maskThreadSubject ? currentThreadSubjects : [];
  const bodies = target.maskMessageBody && currentThreadPresent
    ? resolveMessageSurfaces(root, target.messageId, GMAIL_SELECTORS.messageBody)
    : [];
  const metadata = target.maskMessageBody && currentThreadPresent
    ? resolveMessageSurfaces(root, target.messageId, GMAIL_SELECTORS.messageMetadata)
    : [];
  const previews = target.maskCollapsedPreview && currentThreadPresent
    ? resolveMessageSurfaces(root, target.messageId, GMAIL_SELECTORS.collapsedPreview)
    : [];
  const listSenders = (target.maskListSubject || target.maskListSnippet)
    ? resolveListSurfaces(root, target.threadId, GMAIL_SELECTORS.listSender)
    : [];
  const listSubjects = target.maskListSubject ? resolveListSurfaces(root, target.threadId, GMAIL_SELECTORS.listSubject) : [];
  const listSnippets = target.maskListSnippet ? resolveListSurfaces(root, target.threadId, GMAIL_SELECTORS.listSnippet) : [];
  [subjects, bodies, metadata, previews, listSenders, listSubjects, listSnippets].forEach(add);

  const subjectSatisfied = !target.maskThreadSubject || subjects.length > 0;
  // A collapsed preview is safe to mask, but a requested body remains pending
  // until Gmail expands and renders it. An expanded body supersedes a missing
  // collapsed preview because the preview is no longer visible.
  const bodySatisfied = !target.maskMessageBody || bodies.length > 0;
  const previewSatisfied = !target.maskCollapsedPreview || previews.length > 0 || bodies.length > 0;
  const listSatisfied = (!target.maskListSubject || listSubjects.length > 0) && (!target.maskListSnippet || listSnippets.length > 0);
  const conversationRequested = target.maskThreadSubject || target.maskMessageBody || target.maskCollapsedPreview;
  const listRequested = target.maskListSubject || target.maskListSnippet;
  return {
    elements: [...elements],
    complete: (conversationRequested && currentThreadPresent && messagePresent && subjectSatisfied && bodySatisfied && previewSatisfied) ||
      (listRequested && listSatisfied),
  };
}
