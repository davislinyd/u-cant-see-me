import { MASK_RENDERER_IDS } from "../../shared/constants";
import type { MaskStyle } from "../../shared/types";
import type { MaskRenderer, RendererHandle } from "./renderer";

/** Reserved for safe CSS/filter rendering after the generic renderer contract is proven. */
export class FilterRenderer implements MaskRenderer {
  readonly id = MASK_RENDERER_IDS.filter;

  canRender(_element: Element, _style: MaskStyle): boolean {
    return false;
  }

  apply(_element: Element, _style: MaskStyle): RendererHandle {
    throw new Error("FilterRenderer is not enabled in the foundation phase.");
  }
}
