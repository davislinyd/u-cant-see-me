import type { SiteAdapter } from "../shared/types";
import type { ActiveMask, MaskRule, PageStatus } from "../shared/types";
import { matchesSiteScope } from "../shared/utils";
import { developmentMetrics } from "./development-metrics";
import { applyWithRendererChain, createRendererChain, type RendererHandle } from "./renderer/renderer";

export class MaskManager {
  private rules: MaskRule[] = [];
  private readonly activeMasks = new Map<string, RendererHandle>();
  private readonly renderers = createRendererChain();

  constructor(private readonly adapter: SiteAdapter) {}

  setRules(rules: MaskRule[]): void {
    this.rules = rules;
  }

  resolveAndApply(href: string, root: ParentNode = document): PageStatus {
    const applicableRules = this.applicableRules(href);
    this.disposeInactiveMasks(applicableRules);

    for (const rule of applicableRules) {
      const existing = this.activeMasks.get(rule.id);
      if (existing?.isHealthy()) {
        existing.refresh();
        continue;
      }
      if (existing) {
        existing.dispose();
        this.activeMasks.delete(rule.id);
      }

      this.resolveRule(rule, [root]);
    }

    return this.createStatus(applicableRules);
  }

  reconcileMutations(href: string, records: MutationRecord[]): PageStatus {
    developmentMetrics.recordMutationBatch();
    const applicableRules = this.applicableRules(href);
    this.disposeInactiveMasks(applicableRules);

    for (const [ruleId, handle] of this.activeMasks) {
      if (!handle.isHealthy()) {
        handle.dispose();
        this.activeMasks.delete(ruleId);
      } else {
        handle.refresh();
      }
    }

    const roots = rootsFromMutations(records);
    if (roots.length > 0) {
      for (const rule of applicableRules) {
        if (!this.activeMasks.has(rule.id)) {
          this.resolveRule(rule, roots);
        }
      }
    }

    return this.createStatus(applicableRules);
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

  private applicableRules(href: string): MaskRule[] {
    return this.rules.filter((rule) => rule.enabled && matchesSiteScope(rule.scope, href));
  }

  private resolveRule(rule: MaskRule, roots: ParentNode[]): boolean {
    for (const root of roots) {
      developmentMetrics.recordResolverExecution();
      const element = this.adapter.resolve(rule.locator, root);
      if (!element) {
        continue;
      }

      const handle = applyWithRendererChain(this.renderers, rule.id, element, rule.style);
      if (handle) {
        this.activeMasks.set(rule.id, handle);
        return true;
      }
    }

    return false;
  }

  private createStatus(applicableRules: MaskRule[]): PageStatus {
    const activeMasks = applicableRules.filter((rule) => this.activeMasks.has(rule.id)).length;
    const unresolvedRules = applicableRules.length - activeMasks;
    developmentMetrics.recordResolution(activeMasks, unresolvedRules);
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

  private disposeInactiveMasks(applicableRules: MaskRule[]): void {
    const activeRuleIds = new Set(applicableRules.map((rule) => rule.id));
    for (const [ruleId, handle] of this.activeMasks) {
      if (!activeRuleIds.has(ruleId)) {
        handle.dispose();
        this.activeMasks.delete(ruleId);
      }
    }
  }
}

function rootsFromMutations(records: MutationRecord[]): ParentNode[] {
  const roots = new Set<ParentNode>();

  for (const record of records) {
    addRoot(roots, record.target);
    for (const node of record.addedNodes) {
      addRoot(roots, node);
    }
  }

  return [...roots];
}

function addRoot(roots: Set<ParentNode>, node: Node): void {
  if (node instanceof Element || node instanceof Document || node instanceof DocumentFragment) {
    roots.add(node);
  }
}
