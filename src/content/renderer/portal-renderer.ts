import { MASK_RENDERER_IDS } from "../../shared/constants";
import type { MaskStyle } from "../../shared/types";
import type { MaskRenderer, RendererHandle } from "./renderer";

/** Reserved for event-driven overlay fallback implementation. */
export class PortalRenderer implements MaskRenderer {
  readonly id = MASK_RENDERER_IDS.portal;

  canRender(_element: Element, _style: MaskStyle): boolean {
    return false;
  }

  apply(_element: Element, _style: MaskStyle): RendererHandle {
    throw new Error("PortalRenderer is not enabled in the foundation phase.");
  }
}
