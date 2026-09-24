import { MASK_RENDERER_IDS } from "../../shared/constants";
import type { MaskStyle } from "../../shared/types";
import { developmentMetrics } from "../development-metrics";
import type { MaskRenderer, RendererHandle } from "./renderer";
import { getExtensionRoot } from "./extension-root";

/** Reserved for event-driven overlay fallback implementation. */
export class PortalRenderer implements MaskRenderer {
  readonly id = MASK_RENDERER_IDS.portal;

  canRender(_element: Element, _style: MaskStyle): boolean {
    return _element.isConnected;
  }

  apply(element: Element, style: MaskStyle): RendererHandle {
    const { shadowRoot } = getExtensionRoot();
    ensurePortalStyles(shadowRoot);
    const overlay = document.createElement("div");
    overlay.className = "u-cant-see-me-mask-overlay";
    overlay.dataset.maskType = style.type;
    overlay.style.setProperty("--u-cant-see-me-blur", `${style.blurRadius ?? 14}px`);
    overlay.setAttribute("aria-hidden", "true");
    shadowRoot.append(overlay);

    let frameHandle: number | null = null;
    const update = (): void => {
      frameHandle = null;
      developmentMetrics.recordPortalRendererUpdate();
      if (!element.isConnected) {
        overlay.style.display = "none";
        return;
      }

      const rect = element.getBoundingClientRect();
      overlay.style.display = rect.width > 0 && rect.height > 0 ? "block" : "none";
      overlay.style.left = `${rect.left}px`;
      overlay.style.top = `${rect.top}px`;
      overlay.style.width = `${rect.width}px`;
      overlay.style.height = `${rect.height}px`;
    };
    const scheduleUpdate = (): void => {
      if (frameHandle !== null) {
        return;
      }
      frameHandle = requestAnimationFrame(update);
    };
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleUpdate);
    resizeObserver?.observe(element);
    window.addEventListener("scroll", scheduleUpdate, true);
    window.addEventListener("resize", scheduleUpdate);
    update();

    return {
      activeMask: {
        ruleId: "pending",
        element,
        rendererId: this.id,
        attachedAt: Date.now(),
      },
      refresh: update,
      isHealthy: () => element.isConnected && overlay.isConnected,
      dispose: () => {
        window.removeEventListener("scroll", scheduleUpdate, true);
        window.removeEventListener("resize", scheduleUpdate);
        resizeObserver?.disconnect();
        if (frameHandle !== null) {
          cancelAnimationFrame(frameHandle);
        }
        overlay.remove();
      },
    };
  }
}

function ensurePortalStyles(shadowRoot: ShadowRoot): void {
  if (shadowRoot.querySelector("style[data-u-cant-see-me-portal]") !== null) {
    return;
  }

  const style = document.createElement("style");
  style.dataset.uCantSeeMePortal = "true";
  style.textContent = `
    .u-cant-see-me-mask-overlay {
      display: block;
      position: fixed;
      pointer-events: none;
      z-index: 2147483646;
    }
    .u-cant-see-me-mask-overlay[data-mask-type="black"] {
      background: #000;
    }
    .u-cant-see-me-mask-overlay[data-mask-type="white"] {
      background: #fff;
    }
    .u-cant-see-me-mask-overlay[data-mask-type="blur"] {
      background: rgba(255, 255, 255, 0.18);
      backdrop-filter: blur(var(--u-cant-see-me-blur, 14px));
      -webkit-backdrop-filter: blur(var(--u-cant-see-me-blur, 14px));
    }
  `;
  shadowRoot.append(style);
}
