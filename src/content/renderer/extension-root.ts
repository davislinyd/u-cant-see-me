import { EXTENSION_ROOT_ATTRIBUTE } from "../../shared/constants";

export interface ExtensionRoot {
  host: HTMLDivElement;
  shadowRoot: ShadowRoot;
}

let cachedRoot: ExtensionRoot | null = null;

export function getExtensionRoot(): ExtensionRoot {
  if (cachedRoot?.host.isConnected) {
    return cachedRoot;
  }

  const host = document.createElement("div");
  host.setAttribute(EXTENSION_ROOT_ATTRIBUTE, "true");
  host.setAttribute("data-u-cant-see-me-ui", "true");
  host.style.position = "fixed";
  host.style.inset = "0";
  host.style.pointerEvents = "none";
  host.style.zIndex = "2147483647";

  const shadowRoot = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `
    :host {
      all: initial;
      display: block;
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 2147483647;
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }
  `;
  shadowRoot.append(style);

  (document.documentElement ?? document.body).append(host);
  cachedRoot = { host, shadowRoot };
  return cachedRoot;
}

export function isExtensionOwnedNode(node: EventTarget | null): boolean {
  if (!(node instanceof Node)) {
    return false;
  }

  let current: Node | null = node;
  while (current) {
    if (current instanceof Element && current.hasAttribute(EXTENSION_ROOT_ATTRIBUTE)) {
      return true;
    }
    if (current instanceof ShadowRoot) {
      current = current.host;
    } else {
      current = current.parentNode;
    }
  }

  return false;
}
