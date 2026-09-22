import { getExtensionRoot } from "../../content/renderer/extension-root";

export class GmailPrivacyGuard {
  private guard: HTMLDivElement | null = null;
  private revealTimer: number | null = null;

  constructor(private readonly retry: () => void, private readonly temporarilyReveal: () => void) {}

  reconcile(isProtectedThreadRoute: boolean, resolved: boolean): void {
    if (!isProtectedThreadRoute || resolved) {
      this.release();
      return;
    }
    this.show();
  }

  release(): void {
    if (this.revealTimer !== null) {
      clearTimeout(this.revealTimer);
      this.revealTimer = null;
    }
    this.guard?.remove();
    this.guard = null;
  }

  private show(): void {
    const { shadowRoot } = getExtensionRoot();
    ensureStyles(shadowRoot);
    if (this.guard?.isConnected) {
      return;
    }
    const guard = document.createElement("div");
    guard.className = "u-cant-see-me-gmail-guard";
    guard.setAttribute("role", "alertdialog");
    guard.setAttribute("aria-label", "Protected Gmail content is hidden");
    guard.innerHTML = `<section><strong>U Cant See Me</strong><p>Protected Gmail content is hidden because Gmail's page structure could not be verified.</p><button type="button" data-action="retry">Retry</button><button type="button" data-action="reveal">Temporarily reveal</button></section>`;
    guard.querySelector<HTMLButtonElement>("[data-action='retry']")?.addEventListener("click", this.retry);
    guard.querySelector<HTMLButtonElement>("[data-action='reveal']")?.addEventListener("click", () => {
      this.temporarilyReveal();
      guard.remove();
      this.guard = null;
      this.revealTimer = window.setTimeout(() => this.show(), 10_000);
    });
    shadowRoot.append(guard);
    this.guard = guard;
  }
}

function ensureStyles(shadowRoot: ShadowRoot): void {
  if (shadowRoot.querySelector("style[data-u-cant-see-me-gmail-guard]")) {
    return;
  }
  const style = document.createElement("style");
  style.dataset.uCantSeeMeGmailGuard = "true";
  style.textContent = ".u-cant-see-me-gmail-guard{background:#000;color:#fff;inset:0;padding:24px;position:fixed;z-index:2147483647}.u-cant-see-me-gmail-guard section{font:14px/1.5 system-ui,sans-serif;margin:16vh auto;max-width:430px}.u-cant-see-me-gmail-guard button{background:#fff;border:0;border-radius:4px;color:#111;margin:8px 8px 0 0;padding:8px 12px}";
  shadowRoot.append(style);
}
