import type { ActiveMask, MaskStyle } from "../../shared/types";
import { FilterRenderer } from "./filter-renderer";
import { PortalRenderer } from "./portal-renderer";
import { PseudoRenderer } from "./pseudo-renderer";

export interface RendererHandle {
  activeMask: ActiveMask;
  dispose(): void;
}

export interface MaskRenderer {
  readonly id: string;
  canRender(element: Element, style: MaskStyle): boolean;
  apply(element: Element, style: MaskStyle): RendererHandle;
}

export function createRendererChain(): MaskRenderer[] {
  return [new PseudoRenderer(), new FilterRenderer(), new PortalRenderer()];
}

export function applyWithRendererChain(
  renderers: MaskRenderer[],
  ruleId: string,
  element: Element,
  style: MaskStyle,
): RendererHandle | null {
  for (const renderer of renderers) {
    if (renderer.canRender(element, style)) {
      const handle = renderer.apply(element, style);
      handle.activeMask.ruleId = ruleId;
      return handle;
    }
  }

  return null;
}
