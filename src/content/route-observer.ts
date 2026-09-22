export type RouteChangeReason = "pushState" | "replaceState" | "popstate" | "hashchange";

export interface RouteChange {
  href: string;
  reason: RouteChangeReason;
}

export class RouteObserver {
  private readonly listeners = new Set<(change: RouteChange) => void>();
  private originalPushState: History["pushState"] | null = null;
  private originalReplaceState: History["replaceState"] | null = null;
  private started = false;

  start(): void {
    if (this.started) {
      return;
    }

    this.started = true;
    this.originalPushState = history.pushState.bind(history);
    this.originalReplaceState = history.replaceState.bind(history);
    history.pushState = ((...args: Parameters<History["pushState"]>) => {
      this.originalPushState?.(...args);
      this.emit("pushState");
    }) as History["pushState"];
    history.replaceState = ((...args: Parameters<History["replaceState"]>) => {
      this.originalReplaceState?.(...args);
      this.emit("replaceState");
    }) as History["replaceState"];
    window.addEventListener("popstate", this.handlePopState);
    window.addEventListener("hashchange", this.handleHashChange);
  }

  stop(): void {
    if (!this.started) {
      return;
    }

    if (this.originalPushState) {
      history.pushState = this.originalPushState;
    }
    if (this.originalReplaceState) {
      history.replaceState = this.originalReplaceState;
    }
    window.removeEventListener("popstate", this.handlePopState);
    window.removeEventListener("hashchange", this.handleHashChange);
    this.originalPushState = null;
    this.originalReplaceState = null;
    this.started = false;
  }

  subscribe(listener: (change: RouteChange) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private readonly handlePopState = (): void => {
    this.emit("popstate");
  };

  private readonly handleHashChange = (): void => {
    this.emit("hashchange");
  };

  private emit(reason: RouteChangeReason): void {
    const change: RouteChange = { href: window.location.href, reason };
    for (const listener of this.listeners) {
      listener(change);
    }
  }
}
