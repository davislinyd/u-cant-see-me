import { TEMPORARY_REVEAL_DURATIONS } from "../shared/constants";
import type { ExtensionSettings, TemporaryRevealState } from "../shared/types";

export class TemporaryRevealController {
  private readonly reveals = new Map<string, number>();
  private timer: number | null = null;
  private settings: ExtensionSettings | null = null;

  constructor(
    private readonly getApplicableRuleIds: () => string[],
    private readonly onChange: () => void,
  ) {}

  start(): void {
    window.addEventListener("blur", this.handleWindowBlur);
  }

  configure(settings: ExtensionSettings): void {
    this.settings = settings;
  }

  revealAll(durationMs: number): TemporaryRevealState[] {
    return this.reveal(this.getApplicableRuleIds(), durationMs);
  }

  reveal(ruleIds: string[], durationMs: number): TemporaryRevealState[] {
    const revealedUntil = Date.now() + normalizeDuration(durationMs);
    const states = ruleIds.map((ruleId) => ({ ruleId, revealedUntil, reason: "user" as const }));
    for (const state of states) {
      this.reveals.set(state.ruleId, state.revealedUntil);
    }
    this.scheduleRelock();
    this.onChange();
    return states;
  }

  remask(ruleIds: string[]): void {
    let changed = false;
    for (const ruleId of ruleIds) {
      changed = this.reveals.delete(ruleId) || changed;
    }
    if (changed) {
      this.scheduleRelock();
      this.onChange();
    }
  }

  remaskAll(): void {
    if (this.reveals.size === 0) {
      return;
    }
    this.reveals.clear();
    this.scheduleRelock();
    this.onChange();
  }

  revealedRuleIds(): Set<string> {
    this.expireReveals();
    return new Set(this.reveals.keys());
  }

  handleNavigation(): void {
    if (this.settings?.relockOnNavigation !== false) {
      this.remaskAll();
    }
  }

  handleTabDeactivated(): void {
    if (this.settings?.relockOnTabChange !== false) {
      this.remaskAll();
    }
  }

  private readonly handleWindowBlur = (): void => {
    if (this.settings?.relockOnWindowBlur !== false) {
      this.remaskAll();
    }
  };

  private scheduleRelock(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const nextExpiry = Math.min(...this.reveals.values());
    if (!Number.isFinite(nextExpiry)) {
      return;
    }
    this.timer = window.setTimeout(() => {
      this.timer = null;
      this.expireReveals();
      this.scheduleRelock();
    }, Math.max(0, nextExpiry - Date.now()));
  }

  private expireReveals(): void {
    const now = Date.now();
    let changed = false;
    for (const [ruleId, revealedUntil] of this.reveals) {
      if (revealedUntil <= now) {
        this.reveals.delete(ruleId);
        changed = true;
      }
    }
    if (changed) {
      this.onChange();
    }
  }
}

function normalizeDuration(durationMs: number): number {
  return (TEMPORARY_REVEAL_DURATIONS as readonly number[]).includes(durationMs) ? durationMs : 10_000;
}
