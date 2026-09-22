import { isExtensionOwnedNode } from "./renderer/extension-root";

/**
 * Alt+Shift+H is intentionally page-scoped: reveal lasts only while the key
 * remains held, and blur/navigation/tab changes independently remask it.
 */
export class HoldToRevealController {
  private held = false;

  constructor(private readonly reveal: () => void, private readonly remask: () => void) {}

  start(): void {
    document.addEventListener("keydown", this.handleKeyDown, true);
    document.addEventListener("keyup", this.handleKeyUp, true);
    window.addEventListener("blur", this.release);
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (isExtensionOwnedNode(event.target) || this.held || !isHoldShortcut(event)) {
      return;
    }
    event.preventDefault();
    this.held = true;
    this.reveal();
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    if (event.code === "KeyH") {
      this.release();
    }
  };

  private readonly release = (): void => {
    if (!this.held) {
      return;
    }
    this.held = false;
    this.remask();
  };
}

function isHoldShortcut(event: KeyboardEvent): boolean {
  return event.code === "KeyH" && event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey;
}
