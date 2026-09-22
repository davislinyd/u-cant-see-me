import type { ActiveMask } from "../shared/types";

interface InlineOpacity {
  value: string;
  priority: string;
}

export class PrintProtectionController {
  private readonly previousOpacity = new Map<HTMLElement, InlineOpacity>();

  constructor(private readonly getActiveMasks: () => ActiveMask[]) {}

  start(): void {
    window.addEventListener("beforeprint", this.hideProtectedContent);
    window.addEventListener("afterprint", this.restoreProtectedContent);
  }

  private readonly hideProtectedContent = (): void => {
    for (const { element } of this.getActiveMasks()) {
      if (!(element instanceof HTMLElement) || this.previousOpacity.has(element)) {
        continue;
      }
      this.previousOpacity.set(element, {
        value: element.style.getPropertyValue("opacity"),
        priority: element.style.getPropertyPriority("opacity"),
      });
      element.style.setProperty("opacity", "0", "important");
    }
  };

  private readonly restoreProtectedContent = (): void => {
    for (const [element, opacity] of this.previousOpacity) {
      if (!element.isConnected) {
        continue;
      }
      if (opacity.value === "") {
        element.style.removeProperty("opacity");
      } else {
        element.style.setProperty("opacity", opacity.value, opacity.priority);
      }
    }
    this.previousOpacity.clear();
  };
}
