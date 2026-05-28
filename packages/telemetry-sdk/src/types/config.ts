export interface TelemetryConfig {
  /** Ingestion endpoint URL */
  endpoint: string;
  /** Provider / facility code */
  ppkCode: string;
  /** Application identifier (e.g. SIMRS) */
  apps: string;
  /** API key sent as Authorization header */
  apiKey?: string;
  /** Auto-flush interval in ms (default: 5000) */
  flushInterval?: number;
  /** Max in-memory events before flush (default: 20) */
  maxQueueSize?: number;
  /** Max retry attempts for failed batches (default: 5) */
  maxRetryAttempts?: number;
  /** Base delay for exponential backoff in ms (default: 1000) */
  retryBaseDelayMs?: number;
  /** Schema version (default: 1) */
  version?: number;
  /** Tenant identifier for event enrichment */
  tenantId?: string;
  /** Hospital identifier for event enrichment */
  hospitalId?: string;
  /** Optional user id attached to events */
  userId?: string;
  /** Route debounce window in ms (default: 300) */
  routeDebounceMs?: number;
  /** Patch fetch and emit api_call events (default: false) */
  trackApi?: boolean;
  /** Omit GET requests from API tracking (default: true) */
  apiTrackExcludeGet?: boolean;
  /** Suppress duplicate api_call events within this window (default: 300) */
  apiDebounceMs?: number;
}

export interface ResolvedTelemetryConfig {
  endpoint: string;
  ppkCode: string;
  apps: string;
  apiKey?: string;
  flushInterval: number;
  maxQueueSize: number;
  maxRetryAttempts: number;
  retryBaseDelayMs: number;
  version: number;
  tenantId?: string;
  hospitalId?: string;
  userId?: string;
  routeDebounceMs: number;
  trackApi: boolean;
  apiTrackExcludeGet: boolean;
  apiDebounceMs: number;
}
