import { isBrowser } from "../core/browser.js";
import type { ResolvedTelemetryConfig } from "../types/index.js";
import {
  isTelemetryIngestUrl,
  parseApiEndpoint,
  resolveHttpMethod,
} from "./parseApiUrl.js";

export interface ApiTrackCallback {
  (apiEndpoint: string, method: string): void;
}

export interface ApiTrackRecord {
  apiEndpoint: string;
  method: string;
}

/**
 * Records API calls (path + method only). Optionally patches global fetch.
 */
export class ApiTracker {
  private originalFetch: typeof fetch | null = null;
  private patched = false;
  private lastKey: string | null = null;
  private lastTrackedAt = 0;

  constructor(
    private getConfig: () => ResolvedTelemetryConfig | null,
    private readonly onTrack: ApiTrackCallback,
  ) {}

  install(): void {
    if (!isBrowser() || this.patched || typeof window.fetch !== "function") {
      return;
    }

    this.originalFetch = window.fetch.bind(window);
    const original = this.originalFetch;

    window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      this.recordFetch(input, init);
      return original(input, init);
    };

    this.patched = true;
  }

  uninstall(): void {
    if (!this.patched || !this.originalFetch) return;
    window.fetch = this.originalFetch;
    this.originalFetch = null;
    this.patched = false;
  }

  track(record: ApiTrackRecord): void {
    const config = this.getConfig();
    if (!config?.trackApi) return;

    const apiEndpoint = normalizeEndpoint(record.apiEndpoint);
    const method = record.method.toUpperCase();

    if (!this.shouldRecord(method)) return;
    this.emit(apiEndpoint, method);
  }

  recordFetch(input: RequestInfo | URL, init?: RequestInit): void {
    const config = this.getConfig();
    if (!config?.trackApi) return;

    const method = resolveHttpMethod(input, init);
    if (!this.shouldRecord(method)) return;

    const apiEndpoint = parseApiEndpoint(input);
    if (!apiEndpoint) return;

    const requestUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input instanceof Request
            ? input.url
            : null;

    if (requestUrl && isTelemetryIngestUrl(requestUrl, config.endpoint)) {
      return;
    }

    this.emit(apiEndpoint, method);
  }

  reset(): void {
    this.lastKey = null;
    this.lastTrackedAt = 0;
  }

  private shouldRecord(method: string): boolean {
    const config = this.getConfig();
    if (!config?.trackApi) return false;
    if (config.apiTrackExcludeGet && method === "GET") return false;
    return true;
  }

  private emit(apiEndpoint: string, method: string): void {
    const config = this.getConfig();
    if (!config) return;

    const key = `${method}:${apiEndpoint}`;
    const now = Date.now();

    if (
      this.lastKey === key &&
      now - this.lastTrackedAt < config.apiDebounceMs
    ) {
      return;
    }

    this.lastKey = key;
    this.lastTrackedAt = now;
    this.onTrack(apiEndpoint, method);
  }
}

function normalizeEndpoint(endpoint: string): string {
  const trimmed = endpoint.trim();
  if (!trimmed) return "/";

  if (trimmed.startsWith("/")) {
    try {
      const base =
        typeof window !== "undefined"
          ? window.location.href
          : "http://localhost";
      return new URL(trimmed, base).pathname || "/";
    } catch {
      return trimmed.split("?")[0]?.split("#")[0] || "/";
    }
  }

  try {
    const base =
      typeof window !== "undefined" ? window.location.href : "http://localhost";
    return new URL(trimmed, base).pathname || "/";
  } catch {
    return `/${trimmed.replace(/^\/+/, "").split("?")[0]?.split("#")[0]}`;
  }
}
