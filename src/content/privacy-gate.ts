import { PRIVACY_GATE_ATTRIBUTE } from "../shared/constants";
import type { PageStatus, PrivacyMode } from "../shared/types";
import { getExtensionRoot } from "./renderer/extension-root";

const UNRESOLVED_SETTLE_MS = 1_000;

export class PrivacyGate {
  private gate: HTMLDivElement | null = null;
  private mode: PrivacyMode = "maximum";
  private settleTimer: number | null = null;
  private domReady = document.readyState !== "loading";
  private waitingForRecovery = false;
  private initializing = false;

  install(): void {
    this.initializing = true;
    if (!this.domReady) {
      document.addEventListener("DOMContentLoaded", this.handleDomReady, { once: true });
    }
    this.show();
  }

  configure(mode: PrivacyMode): void {
    this.mode = mode;
    if (mode === "performance") {
      this.release();
    } else if (this.initializing) {
      this.show();
    }
  }

  reconcile(status: PageStatus): void {
    if (this.mode === "performance" || status.applicableRules === 0 || status.unresolvedRules === 0) {
      this.waitingForRecovery = false;
      this.release();
      return;
    }

    // The full-page gate is only a document-start anti-flash guard. Reopening
    // it during later mutation reconciliation turns one stale rule into a
    // recurring black screen on dynamic applications.
    if (!this.initializing) {
      return;
    }

    this.waitingForRecovery = true;
    this.show();
    this.scheduleUnresolvedRelease();
  }

  release(): void {
    if (this.settleTimer !== null) {
      clearTimeout(this.settleTimer);
      this.settleTimer = null;
    }
    this.gate?.remove();
    this.gate = null;
    this.initializing = false;
    document.documentElement.removeAttribute(PRIVACY_GATE_ATTRIBUTE);
  }

  private readonly handleDomReady = (): void => {
    this.domReady = true;
    this.scheduleUnresolvedRelease();
  };

  private scheduleUnresolvedRelease(): void {
    if (!this.waitingForRecovery || !this.domReady || this.settleTimer !== null) {
      return;
    }
    this.settleTimer = window.setTimeout(() => this.release(), UNRESOLVED_SETTLE_MS);
  }

  private show(): void {
    if (this.mode === "performance") {
      return;
    }
    const { shadowRoot } = getExtensionRoot();
    ensureGateStyles(shadowRoot);
    if (!this.gate?.isConnected) {
      const gate = document.createElement("div");
      gate.className = "u-cant-see-me-privacy-gate";
      gate.setAttribute("aria-hidden", "true");
      shadowRoot.append(gate);
      this.gate = gate;
    }
    this.gate.dataset.mode = this.mode;
    document.documentElement.setAttribute(PRIVACY_GATE_ATTRIBUTE, "true");
  }
}

function ensureGateStyles(shadowRoot: ShadowRoot): void {
  if (shadowRoot.querySelector("style[data-u-cant-see-me-privacy-gate]") !== null) {
    return;
  }

  const style = document.createElement("style");
  style.dataset.uCantSeeMePrivacyGate = "true";
  style.textContent = `
    .u-cant-see-me-privacy-gate {
      background: #000;
      inset: 0;
      pointer-events: auto;
      position: fixed;
      z-index: 2147483647;
    }
    .u-cant-see-me-privacy-gate[data-mode="balanced"] {
      background: rgba(0, 0, 0, 0.88);
    }
  `;
  shadowRoot.append(style);
}
