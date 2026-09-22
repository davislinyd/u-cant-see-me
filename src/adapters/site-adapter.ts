import type { SiteAdapter, SiteLocation } from "../shared/types";
import { toSiteLocation } from "../shared/utils";
import { GenericAdapter } from "./generic/generic-adapter";
import { GmailAdapter } from "./gmail/gmail-adapter";

const adapters: SiteAdapter[] = [new GmailAdapter(), new GenericAdapter()];

export function getSiteAdapter(href: string, document?: Document): SiteAdapter {
  const location = toSiteLocation(href);
  if (!location) {
    return adapters[adapters.length - 1] as SiteAdapter;
  }

  return adapters.find((adapter) => adapter.matches(location, document)) ?? adapters[adapters.length - 1] as SiteAdapter;
}

export function getSiteLocation(location: Location = window.location): SiteLocation {
  return {
    href: location.href,
    origin: location.origin,
    hostname: location.hostname,
    pathname: location.pathname,
  };
}
