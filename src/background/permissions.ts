import { originPatternForUrl } from "../shared/utils";

export async function hasHostPermissionForUrl(url: string): Promise<boolean> {
  const origin = originPatternForUrl(url);
  if (!origin) {
    return false;
  }

  return chrome.permissions.contains({ origins: [origin] });
}

export async function requestHostPermissionForUrl(url: string): Promise<boolean> {
  const origin = originPatternForUrl(url);
  if (!origin) {
    return false;
  }

  if (await hasHostPermissionForUrl(url)) {
    return true;
  }

  return chrome.permissions.request({ origins: [origin] });
}

export async function revokeHostPermissionForUrl(url: string): Promise<boolean> {
  const origin = originPatternForUrl(url);
  if (!origin) {
    return false;
  }

  return chrome.permissions.remove({ origins: [origin] });
}
