export type MutationBatchListener = (records: MutationRecord[]) => void;

export class MutationEngine {
  private observer: MutationObserver | null = null;
  private pendingRecords: MutationRecord[] = [];
  private frameHandle: number | null = null;

  constructor(private readonly listener: MutationBatchListener) {}

  start(root: Node = document.documentElement): void {
    if (this.observer) {
      return;
    }

    this.observer = new MutationObserver((records) => {
      this.pendingRecords.push(...records);
      this.scheduleFlush();
    });
    this.observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "id", "role", "data-testid", "style"],
    });
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    if (this.frameHandle !== null) {
      cancelAnimationFrame(this.frameHandle);
      this.frameHandle = null;
    }
    this.pendingRecords = [];
  }

  private scheduleFlush(): void {
    if (this.frameHandle !== null) {
      return;
    }

    this.frameHandle = requestAnimationFrame(() => {
      this.frameHandle = null;
      const records = this.pendingRecords;
      this.pendingRecords = [];
      if (records.length > 0) {
        this.listener(records);
      }
    });
  }
}
