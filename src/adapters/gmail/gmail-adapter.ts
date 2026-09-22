import type { AdapterResolution, ElementLocator, GmailMaskTarget, MaskRule, SiteAdapter, SiteLocation } from "../../shared/types";
import { resolveLocator } from "../../content/locator/locator-engine";
import { generateLocator } from "../../content/locator/selector-generator";
import { gmailThreadId } from "./gmail-identifiers";
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
    if (parseGmailRoute(window.location.href).kind !== "thread") {
      return null;
    }
    return [...root.querySelectorAll(GMAIL_SELECTORS.threadRoot)]
      .map((element) => gmailThreadId(element))
      .find((identifier): identifier is string => identifier !== null) ?? null;
  }

  isProtectedThreadRoute(href: string, rule: MaskRule): boolean {
    return rule.gmailTarget !== undefined && isProtectedGmailThreadRoute(href, rule.gmailTarget.routeId ?? rule.gmailTarget.threadId);
  }

  currentRouteId(href: string = window.location.href): string | undefined {
    const route = parseGmailRoute(href);
    return route.kind === "thread" ? route.threadId : undefined;
  }
}

function resolveGmailTarget(root: ParentNode, target: GmailMaskTarget): AdapterResolution {
  const elements = new Set<Element>();
  const threadPresent = hasThreadIdentity(root, target.threadId);
  const messagePresent = !target.messageId || hasMessageIdentity(root, target.messageId);
  const add = (items: Element[]) => items.forEach((item) => elements.add(item));
  const subjects = target.maskThreadSubject ? resolveThreadSubject(root, target.threadId) : [];
  const bodies = target.maskMessageBody ? resolveMessageSurfaces(root, target.messageId, GMAIL_SELECTORS.messageBody) : [];
  const previews = target.maskCollapsedPreview ? resolveMessageSurfaces(root, target.messageId, GMAIL_SELECTORS.collapsedPreview) : [];
  const listSubjects = target.maskListSubject ? resolveListSurfaces(root, target.threadId, GMAIL_SELECTORS.listSubject) : [];
  const listSnippets = target.maskListSnippet ? resolveListSurfaces(root, target.threadId, GMAIL_SELECTORS.listSnippet) : [];
  [subjects, bodies, previews, listSubjects, listSnippets].forEach(add);

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
    complete: (conversationRequested && threadPresent && messagePresent && subjectSatisfied && bodySatisfied && previewSatisfied) ||
      (listRequested && listSatisfied),
  };
}
