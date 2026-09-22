import { MASK_RENDERER_IDS } from "../../shared/constants";
import type { MaskStyle } from "../../shared/types";
import type { MaskRenderer, RendererHandle } from "./renderer";

/** Reserved for safe CSS/filter rendering after the generic renderer contract is proven. */
export class FilterRenderer implements MaskRenderer {
  readonly id = MASK_RENDERER_IDS.filter;

  canRender(_element: Element, _style: MaskStyle): boolean {
    return _style.type === "blur" && _element.isConnected && _element instanceof HTMLElement;
  }

  apply(element: Element, style: MaskStyle): RendererHandle {
    const htmlElement = element as HTMLElement;
    const previousFilter = htmlElement.style.filter;
    htmlElement.style.filter = `blur(${style.blurRadius ?? 14}px)`;

    return {
      activeMask: {
        ruleId: "pending",
        element,
        rendererId: this.id,
        attachedAt: Date.now(),
      },
      refresh: () => undefined,
      dispose: () => {
        htmlElement.style.filter = previousFilter;
      },
    };
  }
}
