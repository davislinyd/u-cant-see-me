import type { SiteAdapter } from "../shared/types";
import type { ActiveMask, MaskRule, PageStatus, RuleTestResult } from "../shared/types";
import { matchesSiteScope } from "../shared/utils";
import { developmentMetrics } from "./development-metrics";
import { applyWithRendererChain, createRendererChain, type RendererHandle } from "./renderer/renderer";

export class MaskManager {
  private rules: MaskRule[] = [];
  private readonly activeMasks = new Map<string, Map<Element, RendererHandle>>();
  private readonly completeRuleIds = new Set<string>();
  private readonly renderers = createRendererChain();
  private temporarilyRevealedRuleIds = new Set<string>();

  constructor(private readonly adapter: SiteAdapter) {}

  setRules(rules: MaskRule[]): void {
    this.rules = rules;
  }

  setTemporarilyRevealed(ruleIds: Set<string>): void {
    this.temporarilyRevealedRuleIds = new Set(ruleIds);
    for (const [ruleId, handles] of this.activeMasks) {
      if (this.temporarilyRevealedRuleIds.has(ruleId)) {
        disposeHandles(handles);
        this.activeMasks.delete(ruleId);
        this.completeRuleIds.delete(ruleId);
      }
    }
  }

  applicableRuleIds(href: string): string[] {
    return this.applicableRules(href).map((rule) => rule.id);
  }

  resolveAndApply(href: string, root: ParentNode = document): PageStatus {
    const applicableRules = this.applicableRules(href);
    const maskableRules = this.maskableRules(applicableRules);
    this.disposeInactiveMasks(maskableRules);

    for (const rule of maskableRules) {
      this.resolveRule(rule, [root]);
    }

    return this.createStatus(applicableRules);
  }

  reconcileMutations(href: string, records: MutationRecord[]): PageStatus {
    developmentMetrics.recordMutationBatch();
    const applicableRules = this.applicableRules(href);
    const maskableRules = this.maskableRules(applicableRules);
    this.disposeInactiveMasks(maskableRules);

    for (const [ruleId, handles] of this.activeMasks) {
      for (const [element, handle] of handles) {
        if (!handle.isHealthy()) {
          handle.dispose();
          handles.delete(element);
        } else {
          handle.refresh();
        }
      }
      if (handles.size === 0) {
        this.activeMasks.delete(ruleId);
      }
    }

    const roots = rootsFromMutations(records);
    if (roots.length > 0) {
      for (const rule of maskableRules) {
        // Gmail can add one independently rendered message while another is
        // already masked, so the adapter receives the current document.
        if (this.adapter.supportsMultipleTargets || !this.activeMasks.has(rule.id)) {
          // Structural locators are document-relative. Resolving them from a
          // mutation subtree can reject their stable ancestor and let a broad
          // fallback bind a visually similar, but wrong, control.
          this.resolveRule(rule, [document]);
        }
      }
    }

    return this.createStatus(applicableRules);
  }

  clear(): void {
    for (const handles of this.activeMasks.values()) {
      disposeHandles(handles);
    }
    this.activeMasks.clear();
    this.completeRuleIds.clear();
  }

  getActiveMasks(): ActiveMask[] {
    return [...this.activeMasks.values()].flatMap((handles) => [...handles.values()].map((handle) => handle.activeMask));
  }

  private applicableRules(href: string): MaskRule[] {
    return this.rules.filter((rule) => rule.enabled && matchesSiteScope(rule.scope, href));
  }

  private maskableRules(applicableRules: MaskRule[]): MaskRule[] {
    return applicableRules.filter((rule) => !this.temporarilyRevealedRuleIds.has(rule.id));
  }

  isRuleResolved(ruleId: string): boolean {
    return this.completeRuleIds.has(ruleId);
  }

  applicableRulesForPage(href: string): MaskRule[] {
    return this.applicableRules(href);
  }

  testRule(rule: MaskRule, root: ParentNode = document): RuleTestResult {
    const resolution = this.adapter.resolve(rule, root);
    return { resolved: resolution.complete, targetCount: resolution.elements.length };
  }

  ruleIdsForNode(node: Node): string[] {
    return this.getActiveMasks()
      .filter(({ element }) => element === node || element.contains(node))
      .map(({ ruleId }) => ruleId);
  }

  private resolveRule(rule: MaskRule, roots: ParentNode[]): boolean {
    let complete = false;
    for (const root of roots) {
      developmentMetrics.recordResolverExecution();
      const resolution = this.adapter.resolve(rule, root);
      complete ||= resolution.complete;
      this.syncRuleElements(rule, resolution.elements);
      if (this.adapter.supportsMultipleTargets) {
        this.setRuleCompleteness(rule.id, resolution.complete);
        return resolution.complete;
      }
    }
    this.setRuleCompleteness(rule.id, complete);
    return complete;
  }

  private createStatus(applicableRules: MaskRule[]): PageStatus {
    const maskableRules = this.maskableRules(applicableRules);
    const resolvedRules = maskableRules.filter((rule) => this.completeRuleIds.has(rule.id)).length;
    const activeMasks = [...this.activeMasks.values()].reduce((count, handles) => count + handles.size, 0);
    const unresolvedRules = maskableRules.length - resolvedRules;
    developmentMetrics.recordResolution(activeMasks, unresolvedRules);
    return {
      state: applicableRules.length === 0
        ? "no-masks"
        : unresolvedRules > 0
          ? "unresolved"
          : resolvedRules === maskableRules.length
            ? "protected"
            : "partially-protected",
      applicableRules: applicableRules.length,
      activeMasks,
      unresolvedRules,
    };
  }

  private disposeInactiveMasks(applicableRules: MaskRule[]): void {
    const activeRuleIds = new Set(applicableRules.map((rule) => rule.id));
    for (const [ruleId, handles] of this.activeMasks) {
      if (!activeRuleIds.has(ruleId)) {
        disposeHandles(handles);
        this.activeMasks.delete(ruleId);
        this.completeRuleIds.delete(ruleId);
      }
    }
  }

  private syncRuleElements(rule: MaskRule, elements: Element[]): void {
    const nextElements = new Set(elements.filter((element) => element.isConnected));
    const handles = this.activeMasks.get(rule.id) ?? new Map<Element, RendererHandle>();
    for (const [element, handle] of handles) {
      if (!nextElements.has(element)) {
        handle.dispose();
        handles.delete(element);
      }
    }
    for (const element of nextElements) {
      const existing = handles.get(element);
      if (existing?.isHealthy()) {
        existing.refresh();
        continue;
      }
      existing?.dispose();
      const handle = applyWithRendererChain(this.renderers, rule.id, element, rule.style);
      if (handle) {
        handles.set(element, handle);
      }
    }
    if (handles.size > 0) {
      this.activeMasks.set(rule.id, handles);
    } else {
      this.activeMasks.delete(rule.id);
    }
  }

  private setRuleCompleteness(ruleId: string, complete: boolean): void {
    if (complete) {
      this.completeRuleIds.add(ruleId);
    } else {
      this.completeRuleIds.delete(ruleId);
    }
  }
}

function disposeHandles(handles: Map<Element, RendererHandle>): void {
  for (const handle of handles.values()) {
    handle.dispose();
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
