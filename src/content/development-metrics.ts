export interface DevelopmentMetricsSnapshot {
  rulesResolved: number;
  rulesUnresolved: number;
  mutationBatches: number;
  resolverExecutions: number;
  portalRendererUpdates: number;
}

declare global {
  interface Window {
    __U_CANT_SEE_ME_DEV_METRICS__?: Readonly<DevelopmentMetricsSnapshot>;
  }
}

const metrics: DevelopmentMetricsSnapshot = {
  rulesResolved: 0,
  rulesUnresolved: 0,
  mutationBatches: 0,
  resolverExecutions: 0,
  portalRendererUpdates: 0,
};

export const developmentMetrics = {
  recordResolution(resolved: number, unresolved: number): void {
    metrics.rulesResolved = resolved;
    metrics.rulesUnresolved = unresolved;
    publish();
  },

  recordMutationBatch(): void {
    metrics.mutationBatches += 1;
    publish();
  },

  recordResolverExecution(): void {
    metrics.resolverExecutions += 1;
    publish();
  },

  recordPortalRendererUpdate(): void {
    metrics.portalRendererUpdates += 1;
    publish();
  },

  snapshot(): DevelopmentMetricsSnapshot {
    return { ...metrics };
  },
};

function publish(): void {
  if (!import.meta.env.DEV || typeof window === "undefined") {
    return;
  }

  window.__U_CANT_SEE_ME_DEV_METRICS__ = Object.freeze({ ...metrics });
}
