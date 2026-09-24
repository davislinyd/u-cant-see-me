import { DEFAULT_MASK_STYLE } from "../shared/constants";
import type { MaskStyle, MaskType } from "../shared/types";
import { getExtensionRoot, isExtensionOwnedNode } from "./renderer/extension-root";

export type SelectionConfirmHandler = (elements: Element[], style: MaskStyle) => void | Promise<void>;
export type SelectionCancelHandler = () => void;

export class SelectionController {
  private readonly selected = new Set<Element>();
  private hovered: Element | null = null;
  private active = false;
  private style: MaskStyle = { ...DEFAULT_MASK_STYLE };
  private toolbar: HTMLDivElement | null = null;
  private countLabel: HTMLSpanElement | null = null;
  private readonly selectedOutlines = new Map<Element, HTMLDivElement>();
  private hoverOutline: HTMLDivElement | null = null;
  private frameHandle: number | null = null;

  constructor(
    private readonly onConfirm: SelectionConfirmHandler,
    private readonly onCancel: SelectionCancelHandler,
  ) {}

  start(defaultStyle: MaskStyle = DEFAULT_MASK_STYLE): void {
    if (this.active) {
      return;
    }

    this.active = true;
    this.style = { ...defaultStyle };
    this.selected.clear();
    this.hovered = null;
    this.createUi();
    document.addEventListener("pointerover", this.handlePointerOver, true);
    document.addEventListener("click", this.handleClick, true);
    document.addEventListener("keydown", this.handleKeyDown, true);
    window.addEventListener("scroll", this.scheduleOutlineUpdate, true);
    window.addEventListener("resize", this.scheduleOutlineUpdate);
    this.updateUi();
  }

  stop(): void {
    if (!this.active) {
      return;
    }

    this.active = false;
    document.removeEventListener("pointerover", this.handlePointerOver, true);
    document.removeEventListener("click", this.handleClick, true);
    document.removeEventListener("keydown", this.handleKeyDown, true);
    window.removeEventListener("scroll", this.scheduleOutlineUpdate, true);
    window.removeEventListener("resize", this.scheduleOutlineUpdate);
    if (this.frameHandle !== null) {
      cancelAnimationFrame(this.frameHandle);
      this.frameHandle = null;
    }
    this.toolbar?.remove();
    this.toolbar = null;
    this.countLabel = null;
    this.hoverOutline?.remove();
    this.hoverOutline = null;
    for (const outline of this.selectedOutlines.values()) {
      outline.remove();
    }
    this.selectedOutlines.clear();
    this.selected.clear();
    this.hovered = null;
  }

  private readonly handlePointerOver = (event: PointerEvent): void => {
    if (!this.active || isExtensionOwnedNode(event.target)) {
      return;
    }

    const target = selectableTarget(event.target);
    if (!target || target === document.documentElement || target === document.body) {
      return;
    }

    this.hovered = target;
    this.updateUi();
  };

  private readonly handleClick = (event: MouseEvent): void => {
    if (!this.active || isExtensionOwnedNode(event.target)) {
      return;
    }

    const target = selectableTarget(event.target);
    if (!target || target === document.documentElement || target === document.body) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if (event.altKey) {
      this.selected.delete(target);
    } else if (event.shiftKey) {
      this.selected.add(target);
    } else {
      this.selected.clear();
      this.selected.add(target);
    }
    this.hovered = target;
    this.updateUi();
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.active) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.stop();
      this.onCancel();
      return;
    }

    if (event.key === "Enter" && this.selected.size > 0) {
      event.preventDefault();
      event.stopPropagation();
      void this.confirm();
    }
  };

  private async confirm(): Promise<void> {
    const elements = [...this.selected];
    const style = { ...this.style };
    this.stop();
    try {
      await this.onConfirm(elements, style);
    } catch {
      this.showMessage("Unable to save the selected masks.");
    }
  }

  private createUi(): void {
    const { shadowRoot } = getExtensionRoot();
    ensureSelectionStyles(shadowRoot);

    const toolbar = document.createElement("div");
    toolbar.className = "u-cant-see-me-selection-toolbar";
    toolbar.setAttribute("role", "dialog");
    toolbar.setAttribute("aria-label", "U Cant See Me element selection");

    const title = document.createElement("strong");
    title.textContent = "Select elements";

    const help = document.createElement("span");
    help.textContent = "Click · Shift+Click add · Alt+Click remove · Enter save · Escape cancel";

    const controls = document.createElement("div");
    controls.className = "u-cant-see-me-selection-controls";

    const styleLabel = document.createElement("label");
    styleLabel.textContent = "Mask style";
    const styleSelect = document.createElement("select");
    styleSelect.setAttribute("aria-label", "Mask style");
    for (const type of ["black", "white", "blur"] as const) {
      const option = document.createElement("option");
      option.value = type;
      option.textContent = type.charAt(0).toUpperCase() + type.slice(1);
      option.selected = type === this.style.type;
      styleSelect.append(option);
    }
    styleSelect.addEventListener("change", () => {
      this.style = { ...this.style, type: styleSelect.value as MaskType };
    });
    styleLabel.append(styleSelect);

    const count = document.createElement("span");
    count.className = "u-cant-see-me-selection-count";
    this.countLabel = count;

    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.textContent = "Save masks";
    saveButton.addEventListener("click", () => {
      if (this.selected.size > 0) {
        void this.confirm();
      }
    });

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.textContent = "Cancel";
    cancelButton.addEventListener("click", () => {
      this.stop();
      this.onCancel();
    });

    controls.append(styleLabel, count, saveButton, cancelButton);
    toolbar.append(title, help, controls);
    shadowRoot.append(toolbar);
    this.toolbar = toolbar;
  }

  private updateUi(): void {
    if (!this.active) {
      return;
    }

    if (this.countLabel) {
      this.countLabel.textContent = `${this.selected.size} selected`;
    }

    const selectedSet = new Set(this.selected);
    for (const [element, outline] of this.selectedOutlines) {
      if (!selectedSet.has(element) || !element.isConnected) {
        outline.remove();
        this.selectedOutlines.delete(element);
      }
    }
    for (const element of this.selected) {
      if (!this.selectedOutlines.has(element)) {
        const outline = document.createElement("div");
        outline.className = "u-cant-see-me-selection-outline selected";
        outline.setAttribute("aria-hidden", "true");
        getExtensionRoot().shadowRoot.append(outline);
        this.selectedOutlines.set(element, outline);
      }
    }

    if (this.hovered && !selectedSet.has(this.hovered) && this.hovered.isConnected) {
      if (!this.hoverOutline) {
        this.hoverOutline = document.createElement("div");
        this.hoverOutline.className = "u-cant-see-me-selection-outline hovered";
        this.hoverOutline.setAttribute("aria-hidden", "true");
        getExtensionRoot().shadowRoot.append(this.hoverOutline);
      }
      this.updateOutline(this.hovered, this.hoverOutline);
    } else {
      this.hoverOutline?.remove();
      this.hoverOutline = null;
    }

    for (const [element, outline] of this.selectedOutlines) {
      this.updateOutline(element, outline);
    }
  }

  private readonly scheduleOutlineUpdate = (): void => {
    if (this.frameHandle !== null) {
      return;
    }

    this.frameHandle = requestAnimationFrame(() => {
      this.frameHandle = null;
      this.updateUi();
    });
  };

  private updateOutline(element: Element, outline: HTMLDivElement): void {
    const rect = element.getBoundingClientRect();
    outline.style.display = rect.width > 0 && rect.height > 0 ? "block" : "none";
    outline.style.left = `${rect.left}px`;
    outline.style.top = `${rect.top}px`;
    outline.style.width = `${rect.width}px`;
    outline.style.height = `${rect.height}px`;
  }

  private showMessage(message: string): void {
    const { shadowRoot } = getExtensionRoot();
    const toast = document.createElement("div");
    toast.className = "u-cant-see-me-selection-toast";
    toast.textContent = message;
    shadowRoot.append(toast);
    window.setTimeout(() => toast.remove(), 3500);
  }
}

function selectableTarget(target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) {
    return null;
  }

  // Pointer events on icons, labels, and SVG paths should select their
  // interactive control, not an unstable implementation detail.
  return target.closest("button, a, input, select, textarea, [role='button'], [role='link']") ?? target;
}

function ensureSelectionStyles(shadowRoot: ShadowRoot): void {
  if (shadowRoot.querySelector("style[data-u-cant-see-me-selection]") !== null) {
    return;
  }

  const style = document.createElement("style");
  style.dataset.uCantSeeMeSelection = "true";
  style.textContent = `
    .u-cant-see-me-selection-toolbar {
      align-items: flex-start;
      background: #171a24;
      border: 1px solid #444b66;
      border-radius: 12px;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.35);
      color: #f7f8fc;
      display: flex;
      flex-direction: column;
      font-family: Inter, ui-sans-serif, system-ui, sans-serif;
      font-size: 12px;
      gap: 6px;
      max-width: min(560px, calc(100vw - 32px));
      padding: 12px;
      pointer-events: auto;
      position: fixed;
      right: 16px;
      top: 16px;
      z-index: 2147483647;
    }
    .u-cant-see-me-selection-toolbar strong {
      font-size: 13px;
    }
    .u-cant-see-me-selection-toolbar > span {
      color: #c4c9d9;
      line-height: 1.35;
    }
    .u-cant-see-me-selection-controls {
      align-items: center;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      width: 100%;
    }
    .u-cant-see-me-selection-controls label {
      align-items: center;
      color: #d9dced;
      display: flex;
      gap: 4px;
    }
    .u-cant-see-me-selection-controls select,
    .u-cant-see-me-selection-controls button {
      border: 1px solid #59627f;
      border-radius: 6px;
      font: inherit;
      min-height: 28px;
      padding: 4px 8px;
    }
    .u-cant-see-me-selection-controls select {
      background: #242a3b;
      color: #f7f8fc;
    }
    .u-cant-see-me-selection-controls button {
      background: #5368e2;
      color: #fff;
      cursor: pointer;
    }
    .u-cant-see-me-selection-controls button:last-child {
      background: transparent;
      color: #d9dced;
    }
    .u-cant-see-me-selection-count {
      color: #aeb6d2;
      margin-left: auto;
    }
    .u-cant-see-me-selection-outline {
      border-radius: 3px;
      box-sizing: border-box;
      pointer-events: none;
      position: fixed;
      z-index: 2147483646;
    }
    .u-cant-see-me-selection-outline.hovered {
      border: 2px solid #5e7bff;
      background: rgba(94, 123, 255, 0.08);
    }
    .u-cant-see-me-selection-outline.selected {
      border: 2px solid #f4b942;
      background: rgba(244, 185, 66, 0.12);
    }
    .u-cant-see-me-selection-toast {
      background: #171a24;
      border: 1px solid #e05d6f;
      border-radius: 8px;
      bottom: 16px;
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
      color: #fff;
      font: 12px/1.4 Inter, ui-sans-serif, system-ui, sans-serif;
      max-width: 360px;
      padding: 10px 12px;
      pointer-events: auto;
      position: fixed;
      right: 16px;
      z-index: 2147483647;
    }
  `;
  shadowRoot.append(style);
}
