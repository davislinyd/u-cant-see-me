import type { SiteScope } from "./types";

export function createId(prefix: string): string {
  const random = globalThis.crypto?.randomUUID?.();
  if (random) {
    return `${prefix}_${random}`;
  }

  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function toSiteLocation(href: string): {
  href: string;
  origin: string;
  hostname: string;
  pathname: string;
} | null {
  try {
    const url = new URL(href);
    return {
      href: url.href,
      origin: url.origin,
      hostname: url.hostname,
      pathname: url.pathname,
    };
  } catch {
    return null;
  }
}

export function originPatternForUrl(href: string): string | null {
  const location = toSiteLocation(href);
  if (!location || !["http:", "https:"].includes(new URL(location.href).protocol)) {
    return null;
  }

  return `${location.origin}/*`;
}

export function matchesSiteScope(scope: SiteScope, href: string): boolean {
  const location = toSiteLocation(href);
  if (!location) {
    return false;
  }

  switch (scope.kind) {
    case "exact-url":
      return location.href === scope.value;
    case "origin":
      return location.origin === scope.origin;
    case "path-pattern":
      return location.origin === scope.origin && wildcardPathMatches(scope.pathPattern, location.pathname);
  }
}

function wildcardPathMatches(pattern: string, pathname: string): boolean {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped.replaceAll("*", ".*")}$`).test(pathname);
}

export function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}
