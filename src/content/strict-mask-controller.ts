import type { ActiveMask } from "../shared/types";

export class StrictMaskController {
  private enabled = false;

  constructor(private readonly getActiveMasks: () => ActiveMask[]) {}

  start(): void {
    document.addEventListener("pointerdown", this.blockProtectedPointerInteraction, true);
    document.addEventListener("copy", this.blockProtectedCopy, true);
  }

  configure(enabled: boolean): void {
    this.enabled = enabled;
  }

  private readonly blockProtectedPointerInteraction = (event: PointerEvent): void => {
    if (this.enabled && this.isProtectedNode(event.target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };

  private readonly blockProtectedCopy = (event: ClipboardEvent): void => {
    const selection = document.getSelection();
    if (this.enabled && (this.isProtectedNode(selection?.anchorNode) || this.isProtectedNode(selection?.focusNode))) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };

  private isProtectedNode(node: Node | EventTarget | null | undefined): boolean {
    if (!(node instanceof Node)) {
      return false;
    }
    return this.getActiveMasks().some(({ element }) => element === node || element.contains(node));
  }
}
