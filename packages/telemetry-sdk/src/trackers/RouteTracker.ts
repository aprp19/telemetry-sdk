import type { ResolvedTelemetryConfig } from "../types/index.js";
import { getReferrer } from "../core/browser.js";

export interface RouteTrackCallback {
  (pathname: string, referrer?: string): void;
}

/**
 * Suppresses duplicate consecutive route events (e.g. React Strict Mode double effects).
 */
export class RouteTracker {
  private lastPathname: string | null = null;
  private lastTrackedAt = 0;

  constructor(
    private getConfig: () => ResolvedTelemetryConfig | null,
    private readonly onTrack: RouteTrackCallback,
  ) {}

  track(pathname: string, referrer?: string): void {
    const config = this.getConfig();
    if (!config) return;

    const normalized = pathname.trim() || "/";
    const now = Date.now();
    const debounceMs = config.routeDebounceMs;

    if (
      this.lastPathname === normalized &&
      now - this.lastTrackedAt < debounceMs
    ) {
      return;
    }

    const resolvedReferrer = referrer ?? getReferrer();
    this.lastPathname = normalized;
    this.lastTrackedAt = now;
    this.onTrack(normalized, resolvedReferrer);
  }

  reset(): void {
    this.lastPathname = null;
    this.lastTrackedAt = 0;
  }
}

