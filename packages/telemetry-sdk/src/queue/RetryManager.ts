import type { ResolvedTelemetryConfig, TelemetryEvent } from "../types/index.js";
import {
  readLocalStorage,
  removeLocalStorage,
  writeLocalStorage,
} from "../storage/safeStorage.js";
import type { Transport } from "../transport/types.js";

const RETRY_STORAGE_KEY = "nuha_telemetry_failed_batches";

interface StoredFailedBatch {
  events: TelemetryEvent[];
  attempt: number;
  nextRetryAt: number;
}

export type FlushHandler = (events: TelemetryEvent[]) => Promise<boolean>;

export class RetryManager {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private processing = false;

  constructor(
    private readonly transport: Transport,
    private getConfig: () => ResolvedTelemetryConfig | null,
  ) {}

  persistFailedBatch(events: TelemetryEvent[], attempt = 0): void {
    const batches = this.loadBatches();
    batches.push({
      events,
      attempt,
      nextRetryAt: Date.now() + this.getBackoffMs(attempt),
    });
    this.saveBatches(batches);
    this.scheduleRetry();
  }

  start(): void {
    this.scheduleRetry();
  }

  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private scheduleRetry(): void {
    if (this.timer) return;

    const batches = this.loadBatches();
    if (batches.length === 0) return;

    const now = Date.now();
    const nextAt = Math.min(...batches.map((b) => b.nextRetryAt));
    const delay = Math.max(0, nextAt - now);

    this.timer = setTimeout(() => {
      this.timer = null;
      void this.processRetries();
    }, delay);
  }

  private async processRetries(): Promise<void> {
    if (this.processing) return;
    const config = this.getConfig();
    if (!config) return;

    this.processing = true;

    try {
      const now = Date.now();
      const pending = this.loadBatches().filter((b) => b.nextRetryAt <= now);
      const remaining = this.loadBatches().filter((b) => b.nextRetryAt > now);

      for (const batch of pending) {
        const result = await this.transport.send({
          config,
          events: batch.events,
        });

        if (result.ok) continue;

        const nextAttempt = batch.attempt + 1;
        if (nextAttempt > config.maxRetryAttempts) {
          continue;
        }

        remaining.push({
          events: batch.events,
          attempt: nextAttempt,
          nextRetryAt: Date.now() + this.getBackoffMs(nextAttempt),
        });
      }

      this.saveBatches(remaining);
    } finally {
      this.processing = false;
      if (this.loadBatches().length > 0) {
        this.scheduleRetry();
      }
    }
  }

  private getBackoffMs(attempt: number): number {
    const config = this.getConfig();
    const base = config?.retryBaseDelayMs ?? 1000;
    return base * 2 ** Math.min(attempt, 10);
  }

  private loadBatches(): StoredFailedBatch[] {
    const raw = readLocalStorage(RETRY_STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as StoredFailedBatch[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private saveBatches(batches: StoredFailedBatch[]): void {
    if (batches.length === 0) {
      removeLocalStorage(RETRY_STORAGE_KEY);
      return;
    }
    writeLocalStorage(RETRY_STORAGE_KEY, JSON.stringify(batches));
  }
}
