import type { ActiveMask, MaskStyle, MaskType } from "../shared/types";
import { getExtensionRoot, isExtensionOwnedNode } from "./renderer/extension-root";

export class RuleEditController {
  private active = false;
  private selectedRuleId: string | null = null;
  private toolbar: HTMLDivElement | null = null;
  private readonly outlines = new Map<Element, HTMLDivElement>();
  private frameHandle: number | null = null;

  constructor(
    private readonly getActiveMasks: () => ActiveMask[],
    private readonly updateStyle: (ruleId: string, style: MaskStyle) => Promise<void>,
    private readonly disable: (ruleId: string) => Promise<void>,
    private readonly remove: (ruleId: string) => Promise<void>,
  ) {}

  start(): void {
    if (this.active) return;
    this.active = true;
    this.createUi();
    document.addEventListener("click", this.handleClick, true);
    document.addEventListener("keydown", this.handleKeyDown, true);
    window.addEventListener("scroll", this.scheduleUpdate, true);
    window.addEventListener("resize", this.scheduleUpdate);
    this.updateOutlines();
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    document.removeEventListener("click", this.handleClick, true);
    document.removeEventListener("keydown", this.handleKeyDown, true);
    window.removeEventListener("scroll", this.scheduleUpdate, true);
    window.removeEventListener("resize", this.scheduleUpdate);
    if (this.frameHandle !== null) cancelAnimationFrame(this.frameHandle);
    this.frameHandle = null;
    this.toolbar?.remove();
    this.toolbar = null;
    this.outlines.forEach((outline) => outline.remove());
    this.outlines.clear();
    this.selectedRuleId = null;
  }

  private readonly handleClick = (event: MouseEvent): void => {
    const target = event.target;
    if (!this.active || isExtensionOwnedNode(target) || !(target instanceof Node)) return;
    const mask = this.getActiveMasks().find(({ element }) => element === target || element.contains(target));
    if (!mask) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.selectedRuleId = mask.ruleId;
    this.updateToolbar();
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      this.stop();
    }
  };

  private createUi(): void {
    const { shadowRoot } = getExtensionRoot();
    ensureStyles(shadowRoot);
    const toolbar = document.createElement("div");
    toolbar.className = "u-cant-see-me-edit-toolbar";
    toolbar.setAttribute("role", "dialog");
    toolbar.innerHTML = `<strong>Edit masks</strong><span data-selection>Select a masked area</span>`;
    const style = document.createElement("select");
    style.setAttribute("aria-label", "Change selected mask style");
    for (const value of ["black", "white", "blur"] as const) style.append(new Option(value, value));
    style.addEventListener("change", () => {
      if (this.selectedRuleId) void this.updateStyle(this.selectedRuleId, { type: style.value as MaskType });
    });
    const disable = document.createElement("button");
    disable.type = "button"; disable.textContent = "Disable";
    disable.addEventListener("click", () => { if (this.selectedRuleId) void this.disable(this.selectedRuleId).then(() => this.updateOutlines()); });
    const remove = document.createElement("button");
    remove.type = "button"; remove.textContent = "Delete";
    remove.addEventListener("click", () => { if (this.selectedRuleId) void this.remove(this.selectedRuleId).then(() => this.updateOutlines()); });
    const done = document.createElement("button");
    done.type = "button"; done.textContent = "Done"; done.addEventListener("click", () => this.stop());
    toolbar.append(style, disable, remove, done);
    shadowRoot.append(toolbar);
    this.toolbar = toolbar;
  }

  private updateToolbar(): void {
    const label = this.toolbar?.querySelector<HTMLElement>("[data-selection]");
    if (label) label.textContent = this.selectedRuleId ? `Selected ${this.selectedRuleId}` : "Select a masked area";
  }

  private readonly scheduleUpdate = (): void => {
    if (this.frameHandle !== null) return;
    this.frameHandle = requestAnimationFrame(() => { this.frameHandle = null; this.updateOutlines(); });
  };

  private updateOutlines(): void {
    if (!this.active) return;
    const active = this.getActiveMasks();
    const elements = new Set(active.map(({ element }) => element));
    for (const [element, outline] of this.outlines) if (!elements.has(element) || !element.isConnected) { outline.remove(); this.outlines.delete(element); }
    for (const mask of active) {
      let outline = this.outlines.get(mask.element);
      if (!outline) { outline = document.createElement("div"); outline.className = "u-cant-see-me-edit-outline"; getExtensionRoot().shadowRoot.append(outline); this.outlines.set(mask.element, outline); }
      const rect = mask.element.getBoundingClientRect();
      outline.style.cssText = `display:${rect.width > 0 && rect.height > 0 ? "block" : "none"};left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px`;
      outline.dataset.selected = String(mask.ruleId === this.selectedRuleId);
      outline.setAttribute("aria-label", `Mask ${mask.ruleId}`);
    }
  }
}

function ensureStyles(shadowRoot: ShadowRoot): void {
  if (shadowRoot.querySelector("style[data-u-cant-see-me-edit]")) return;
  const style = document.createElement("style");
  style.dataset.uCantSeeMeEdit = "true";
  style.textContent = `.u-cant-see-me-edit-toolbar{background:#171a24;border:1px solid #58618a;border-radius:10px;color:#fff;font:12px system-ui;padding:10px;pointer-events:auto;position:fixed;right:16px;top:16px;z-index:2147483647}.u-cant-see-me-edit-toolbar>*{margin:0 4px}.u-cant-see-me-edit-outline{border:2px dashed #6d8cff;box-sizing:border-box;pointer-events:none;position:fixed;z-index:2147483646}.u-cant-see-me-edit-outline[data-selected="true"]{border-color:#ffd35a}`;
  shadowRoot.append(style);
}
