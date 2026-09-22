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
    return element.isConnected && !element.hasAttribute(EXTENSION_ROOT_ATTRIBUTE);
  }

  apply(element: Element, _style: MaskStyle): RendererHandle {
    const activeMask: ActiveMask = {
      ruleId: "pending",
      element,
      rendererId: this.id,
      attachedAt: Date.now(),
    };

    return {
      activeMask,
      dispose: () => undefined,
    };
  }
}
