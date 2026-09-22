import type { SiteAdapter } from "../shared/types";
import type { ActiveMask, MaskRule, PageStatus } from "../shared/types";
import { matchesSiteScope } from "../shared/utils";
import { applyWithRendererChain, createRendererChain, type RendererHandle } from "./renderer/renderer";

export class MaskManager {
  private rules: MaskRule[] = [];
  private readonly activeMasks = new Map<string, RendererHandle>();

  constructor(private readonly adapter: SiteAdapter) {}

  setRules(rules: MaskRule[]): void {
    this.rules = rules;
  }

  resolveAndApply(href: string, root: ParentNode = document): PageStatus {
    this.disposeInactiveRules();
    const applicableRules = this.rules.filter((rule) => rule.enabled && matchesSiteScope(rule.scope, href));
    let unresolvedRules = 0;

    for (const rule of applicableRules) {
      if (this.activeMasks.has(rule.id)) {
        continue;
      }

      const element = this.adapter.resolve(rule.locator, root);
      if (!element) {
        unresolvedRules += 1;
        continue;
      }

      const handle = applyWithRendererChain(createRendererChain(), rule.id, element, rule.style);
      if (handle) {
        this.activeMasks.set(rule.id, handle);
      } else {
        unresolvedRules += 1;
      }
    }

    const activeMasks = this.activeMasks.size;
    return {
      state: applicableRules.length === 0
        ? "no-masks"
        : unresolvedRules > 0
          ? "unresolved"
          : activeMasks === applicableRules.length
            ? "protected"
            : "partially-protected",
      applicableRules: applicableRules.length,
      activeMasks,
      unresolvedRules,
    };
  }

  clear(): void {
    for (const handle of this.activeMasks.values()) {
      handle.dispose();
    }
    this.activeMasks.clear();
  }

  getActiveMasks(): ActiveMask[] {
    return [...this.activeMasks.values()].map((handle) => handle.activeMask);
  }

  private disposeInactiveRules(): void {
    const activeRuleIds = new Set(this.rules.filter((rule) => rule.enabled).map((rule) => rule.id));
    for (const [ruleId, handle] of this.activeMasks) {
      if (!activeRuleIds.has(ruleId)) {
        handle.dispose();
        this.activeMasks.delete(ruleId);
      }
    }
  }
}
