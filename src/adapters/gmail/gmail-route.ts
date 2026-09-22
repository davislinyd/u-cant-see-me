export interface GmailRoute {
  kind: "thread" | "other";
  threadId?: string;
}

/** Gmail conversation routes end in an opaque ID; no visible mailbox text is read. */
export function parseGmailRoute(href: string): GmailRoute {
  try {
    const route = new URL(href).hash.replace(/^#/, "").split("?")[0] ?? "";
    const candidate = route.split("/").filter(Boolean).at(-1);
    if (candidate && /^[A-Za-z0-9_-]{6,}$/.test(candidate) && !isMailboxName(candidate)) {
      return { kind: "thread", threadId: candidate };
    }
  } catch {
    // A malformed URL is simply not a Gmail thread route.
  }
  return { kind: "other" };
}

export function isProtectedGmailThreadRoute(href: string, threadId: string): boolean {
  const route = parseGmailRoute(href);
  return route.kind === "thread" && route.threadId === threadId;
}

function isMailboxName(value: string): boolean {
  return new Set(["inbox", "sent", "starred", "drafts", "all", "search", "label"]).has(value.toLowerCase());
}
