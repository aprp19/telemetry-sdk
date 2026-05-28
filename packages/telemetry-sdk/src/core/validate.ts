import type {
  ResolvedTelemetryConfig,
  TelemetryConfig,
} from "../types/index.js";

const DEFAULT_FLUSH_INTERVAL = 5000;
const DEFAULT_MAX_QUEUE_SIZE = 20;
const DEFAULT_MAX_RETRY_ATTEMPTS = 5;
const DEFAULT_RETRY_BASE_DELAY_MS = 1000;
const DEFAULT_VERSION = 1;
const DEFAULT_ROUTE_DEBOUNCE_MS = 300;
const DEFAULT_API_DEBOUNCE_MS = 300;

const MIN_FLUSH_INTERVAL = 1000;
const MAX_FLUSH_INTERVAL = 60_000;
const MIN_QUEUE_SIZE = 1;
const MAX_QUEUE_SIZE = 500;

export class TelemetryConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TelemetryConfigError";
  }
}

function assertNonEmptyString(
  value: unknown,
  field: string,
): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TelemetryConfigError(`${field} is required and must be a non-empty string`);
  }
}

function assertValidUrl(value: string, field: string): void {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new TelemetryConfigError(`${field} must use http or https`);
    }
  } catch {
    throw new TelemetryConfigError(`${field} must be a valid URL`);
  }
}

function clampNumber(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
  field: string,
): number {
  const resolved = value ?? fallback;
  if (!Number.isFinite(resolved) || resolved < min || resolved > max) {
    throw new TelemetryConfigError(
      `${field} must be a number between ${min} and ${max}`,
    );
  }
  return resolved;
}

export function resolveConfig(config: TelemetryConfig): ResolvedTelemetryConfig {
  assertNonEmptyString(config.endpoint, "endpoint");
  assertNonEmptyString(config.ppkCode, "ppkCode");
  assertNonEmptyString(config.apps, "apps");

  const endpoint = config.endpoint.trim();
  assertValidUrl(endpoint, "endpoint");

  if (config.apiKey !== undefined) {
    assertNonEmptyString(config.apiKey, "apiKey");
  }

  return {
    endpoint,
    ppkCode: config.ppkCode.trim(),
    apps: config.apps.trim(),
    apiKey: config.apiKey?.trim(),
    flushInterval: clampNumber(
      config.flushInterval,
      DEFAULT_FLUSH_INTERVAL,
      MIN_FLUSH_INTERVAL,
      MAX_FLUSH_INTERVAL,
      "flushInterval",
    ),
    maxQueueSize: clampNumber(
      config.maxQueueSize,
      DEFAULT_MAX_QUEUE_SIZE,
      MIN_QUEUE_SIZE,
      MAX_QUEUE_SIZE,
      "maxQueueSize",
    ),
    maxRetryAttempts: clampNumber(
      config.maxRetryAttempts,
      DEFAULT_MAX_RETRY_ATTEMPTS,
      0,
      20,
      "maxRetryAttempts",
    ),
    retryBaseDelayMs: clampNumber(
      config.retryBaseDelayMs,
      DEFAULT_RETRY_BASE_DELAY_MS,
      100,
      60_000,
      "retryBaseDelayMs",
    ),
    version: config.version ?? DEFAULT_VERSION,
    tenantId: config.tenantId?.trim() || undefined,
    hospitalId: config.hospitalId?.trim() || undefined,
    userId: config.userId?.trim() || undefined,
    routeDebounceMs: clampNumber(
      config.routeDebounceMs,
      DEFAULT_ROUTE_DEBOUNCE_MS,
      0,
      5000,
      "routeDebounceMs",
    ),
    trackApi: config.trackApi ?? false,
    apiTrackExcludeGet: config.apiTrackExcludeGet ?? true,
    apiDebounceMs: clampNumber(
      config.apiDebounceMs,
      DEFAULT_API_DEBOUNCE_MS,
      0,
      5000,
      "apiDebounceMs",
    ),
  };
}
