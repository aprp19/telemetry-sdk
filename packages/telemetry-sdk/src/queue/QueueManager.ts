import type { ResolvedTelemetryConfig, TelemetryEvent } from "../types/index.js";
import { isBrowser } from "../core/browser.js";
import type { Transport } from "../transport/types.js";
import { RetryManager } from "./RetryManager.js";

export type OnFlush = (events: TelemetryEvent[]) => void;

export class QueueManager {
  private queue: TelemetryEvent[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private flushing = false;
  private unloadBound = false;

  constructor(
    private readonly transport: Transport,
    private readonly retryManager: RetryManager,
    private getConfig: () => ResolvedTelemetryConfig | null,
  ) {}

  start(): void {
    const config = this.getConfig();
    if (!config) return;

    this.stopTimer();
    this.flushTimer = setInterval(() => {
      void this.flush();
    }, config.flushInterval);

    this.bindUnload();
  }

  stop(): void {
    this.stopTimer();
  }

  enqueue(event: TelemetryEvent): void {
    const config = this.getConfig();
    if (!config) return;

    this.queue.push(event);

    if (this.queue.length >= config.maxQueueSize) {
      void this.flush();
    }
  }

  enqueueMany(events: TelemetryEvent[]): void {
    for (const event of events) {
      this.enqueue(event);
    }
  }

  getPendingCount(): number {
    return this.queue.length;
  }

  async flush(): Promise<boolean> {
    if (this.flushing || this.queue.length === 0) return true;

    const config = this.getConfig();
    if (!config) return false;

    this.flushing = true;
    const batch = this.queue.slice();
    this.queue = [];

    try {
      const result = await this.transport.send({ config, events: batch });

      if (result.ok) {
        return true;
      }

      this.retryManager.persistFailedBatch(batch, 0);
      return false;
    } catch {
      this.retryManager.persistFailedBatch(batch, 0);
      return false;
    } finally {
      this.flushing = false;
    }
  }

  /** Synchronous best-effort flush for page unload (uses beacon path). */
  flushSyncOnUnload(): void {
    const config = this.getConfig();
    if (!config || this.queue.length === 0) return;

    const batch = this.queue.slice();
    this.queue = [];
    void this.transport.send({ config, events: batch });
  }

  private stopTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private bindUnload(): void {
    if (!isBrowser() || this.unloadBound) return;
    this.unloadBound = true;

    const onUnload = (): void => {
      this.flushSyncOnUnload();
    };

    window.addEventListener("pagehide", onUnload);
    window.addEventListener("beforeunload", onUnload);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        onUnload();
      }
    });
  }
}
