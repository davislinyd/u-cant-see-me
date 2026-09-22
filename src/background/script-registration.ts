const SCRIPT_ID_PREFIX = "u-cant-see-me-protection";

export function scriptIdForOrigin(originPattern: string): string {
  const encoded = originPattern.replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return `${SCRIPT_ID_PREFIX}-${encoded}`.slice(0, 100);
}

export async function registerProtectionScript(originPattern: string): Promise<void> {
  const id = scriptIdForOrigin(originPattern);
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [id] });
  if (existing.length > 0) {
    return;
  }

  await chrome.scripting.registerContentScripts([{
    id,
    js: ["content.js"],
    matches: [originPattern],
    runAt: "document_start",
    persistAcrossSessions: true,
  }]);
}

export async function unregisterProtectionScript(originPattern: string): Promise<void> {
  await chrome.scripting.unregisterContentScripts({ ids: [scriptIdForOrigin(originPattern)] });
}

export async function listProtectionScripts(): Promise<chrome.scripting.RegisteredContentScript[]> {
  return chrome.scripting.getRegisteredContentScripts({});
}
