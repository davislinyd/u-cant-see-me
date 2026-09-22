import { EXTENSION_ROOT_ATTRIBUTE, MASK_RENDERER_IDS } from "../../shared/constants";
import type { ActiveMask, MaskStyle } from "../../shared/types";
import type { MaskRenderer, RendererHandle } from "./renderer";

/**
 * Foundation renderer boundary. Phase 1 will add the visual pseudo-layer
 * implementation while keeping the renderer selection contract stable.
 */
export class PseudoRenderer implements MaskRenderer {
  readonly id = MASK_RENDERER_IDS.pseudo;

  canRender(element: Element, _style: MaskStyle): boolean {
    if (!element.isConnected || element.hasAttribute(EXTENSION_ROOT_ATTRIBUTE) || !(element instanceof HTMLElement)) {
      return false;
    }

    if (["AUDIO", "CANVAS", "IFRAME", "IMG", "INPUT", "SELECT", "SVG", "TEXTAREA", "VIDEO"].includes(element.tagName)) {
      return false;
    }

    try {
      const computed = getComputedStyle(element);
      return computed.position !== "static" && computed.display !== "inline";
    } catch {
      return false;
    }
  }

  apply(element: Element, style: MaskStyle): RendererHandle {
    ensurePseudoStyles();
    const htmlElement = element as HTMLElement;
    const previousRenderer = element.getAttribute("data-u-cant-see-me-renderer");
    const previousType = element.getAttribute("data-u-cant-see-me-mask-type");
    const previousBlur = htmlElement.style.getPropertyValue("--u-cant-see-me-blur");
    const previousBlurPriority = htmlElement.style.getPropertyPriority("--u-cant-see-me-blur");
    const previousMosaic = htmlElement.style.getPropertyValue("--u-cant-see-me-mosaic");
    const previousMosaicPriority = htmlElement.style.getPropertyPriority("--u-cant-see-me-mosaic");

    element.setAttribute("data-u-cant-see-me-renderer", this.id);
    element.setAttribute("data-u-cant-see-me-mask-type", style.type);
    htmlElement.style.setProperty("--u-cant-see-me-blur", `${style.blurRadius ?? 14}px`);
    htmlElement.style.setProperty("--u-cant-see-me-mosaic", `${style.mosaicSize ?? 12}px`);

    const activeMask: ActiveMask = {
      ruleId: "pending",
      element,
      rendererId: this.id,
      attachedAt: Date.now(),
    };

    return {
      activeMask,
      refresh: () => ensurePseudoStyles(),
      isHealthy: () => element.isConnected &&
        element.getAttribute("data-u-cant-see-me-renderer") === this.id &&
        element.getAttribute("data-u-cant-see-me-mask-type") === style.type &&
        document.getElementById("u-cant-see-me-pseudo-renderer") !== null,
      dispose: () => {
        restoreAttribute(element, "data-u-cant-see-me-renderer", previousRenderer);
        restoreAttribute(element, "data-u-cant-see-me-mask-type", previousType);
        restoreStyleProperty(htmlElement, "--u-cant-see-me-blur", previousBlur, previousBlurPriority);
        restoreStyleProperty(htmlElement, "--u-cant-see-me-mosaic", previousMosaic, previousMosaicPriority);
      },
    };
  }
}

function restoreAttribute(element: Element, name: string, value: string | null): void {
  if (value === null) {
    element.removeAttribute(name);
  } else {
    element.setAttribute(name, value);
  }
}

function restoreStyleProperty(element: HTMLElement, name: string, value: string, priority: string): void {
  if (value === "") {
    element.style.removeProperty(name);
  } else {
    element.style.setProperty(name, value, priority);
  }
}

function ensurePseudoStyles(): void {
  const styleId = "u-cant-see-me-pseudo-renderer";
  if (document.getElementById(styleId)) {
    return;
  }

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    [data-u-cant-see-me-renderer="${MASK_RENDERER_IDS.pseudo}"]::after {
      content: "";
      display: block;
      position: absolute;
      inset: 0;
      z-index: 2147483647;
      pointer-events: none;
    }
    [data-u-cant-see-me-renderer="${MASK_RENDERER_IDS.pseudo}"][data-u-cant-see-me-mask-type="black"]::after {
      background: #000;
    }
    [data-u-cant-see-me-renderer="${MASK_RENDERER_IDS.pseudo}"][data-u-cant-see-me-mask-type="white"]::after {
      background: #fff;
    }
    [data-u-cant-see-me-renderer="${MASK_RENDERER_IDS.pseudo}"][data-u-cant-see-me-mask-type="blur"]::after {
      background: rgba(255, 255, 255, 0.18);
      backdrop-filter: blur(var(--u-cant-see-me-blur, 14px));
      -webkit-backdrop-filter: blur(var(--u-cant-see-me-blur, 14px));
    }
    [data-u-cant-see-me-renderer="${MASK_RENDERER_IDS.pseudo}"][data-u-cant-see-me-mask-type="mosaic"]::after {
      background-color: #202020;
      background-image:
        linear-gradient(45deg, #f4f4f4 25%, transparent 25%, transparent 75%, #f4f4f4 75%),
        linear-gradient(45deg, #f4f4f4 25%, transparent 25%, transparent 75%, #f4f4f4 75%);
      background-position: 0 0, calc(var(--u-cant-see-me-mosaic, 12px) / 2) calc(var(--u-cant-see-me-mosaic, 12px) / 2);
      background-size: var(--u-cant-see-me-mosaic, 12px) var(--u-cant-see-me-mosaic, 12px);
    }
  `;
  (document.head ?? document.documentElement).append(style);
}
