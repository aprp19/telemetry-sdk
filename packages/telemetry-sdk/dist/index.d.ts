interface TelemetryConfig {
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
interface ResolvedTelemetryConfig {
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

type TelemetryEvent = {
    id: string;
    version: number;
    ppkCode: string;
    apps: string;
    sessionId: string;
    userId?: string;
    eventType: string;
    pathname?: string;
    referrer?: string;
    tenantId?: string;
    hospitalId?: string;
    payload?: Record<string, unknown>;
    timestamp: string;
};
interface TrackInput {
    eventType: string;
    payload?: Record<string, unknown>;
    pathname?: string;
    referrer?: string;
    userId?: string;
}
interface TrackRouteInput {
    pathname: string;
    referrer?: string;
}
interface TrackApiInput {
    /** API path (e.g. /api/patients or full URL — stored as pathname only) */
    apiEndpoint: string;
    /** HTTP method (default: GET) */
    method?: string;
}
/** Minimal payload for api_call events — no request/response body */
interface ApiCallPayload {
    apiEndpoint: string;
    method: string;
}
interface TelemetryBatchPayload {
    events: TelemetryEvent[];
}

declare class TelemetrySDK {
    private config;
    private initialized;
    private readonly sessionManager;
    private readonly transport;
    private readonly retryManager;
    private readonly queueManager;
    private readonly routeTracker;
    private readonly apiTracker;
    init(config: TelemetryConfig): void;
    isInitialized(): boolean;
    setUserId(userId: string | undefined): void;
    track(input: TrackInput): void;
    trackRoute(input: TrackRouteInput): void;
    trackApi(input: TrackApiInput): void;
    flush(): Promise<boolean>;
    getSessionId(): string;
    getPendingEventCount(): number;
    destroy(): void;
    private trackRouteInternal;
    private trackApiInternal;
    private buildEvent;
    private assertReady;
}

declare class TelemetryConfigError extends Error {
    constructor(message: string);
}
declare function resolveConfig(config: TelemetryConfig): ResolvedTelemetryConfig;

declare class SessionManager {
    private sessionId;
    getSessionId(): string;
    resetSession(): string;
    private createSessionId;
}

interface TransportSendOptions {
    config: ResolvedTelemetryConfig;
    events: TelemetryEvent[];
}
interface TransportResult {
    ok: boolean;
    status?: number;
    error?: string;
}
interface Transport {
    send(options: TransportSendOptions): Promise<TransportResult>;
}

declare class RetryManager {
    private readonly transport;
    private getConfig;
    private timer;
    private processing;
    constructor(transport: Transport, getConfig: () => ResolvedTelemetryConfig | null);
    persistFailedBatch(events: TelemetryEvent[], attempt?: number): void;
    start(): void;
    stop(): void;
    private scheduleRetry;
    private processRetries;
    private getBackoffMs;
    private loadBatches;
    private saveBatches;
}

declare class QueueManager {
    private readonly transport;
    private readonly retryManager;
    private getConfig;
    private queue;
    private flushTimer;
    private flushing;
    private unloadBound;
    constructor(transport: Transport, retryManager: RetryManager, getConfig: () => ResolvedTelemetryConfig | null);
    start(): void;
    stop(): void;
    enqueue(event: TelemetryEvent): void;
    enqueueMany(events: TelemetryEvent[]): void;
    getPendingCount(): number;
    flush(): Promise<boolean>;
    /** Synchronous best-effort flush for page unload (uses beacon path). */
    flushSyncOnUnload(): void;
    private stopTimer;
    private bindUnload;
}

interface RouteTrackCallback {
    (pathname: string, referrer?: string): void;
}
/**
 * Suppresses duplicate consecutive route events (e.g. React Strict Mode double effects).
 */
declare class RouteTracker {
    private getConfig;
    private readonly onTrack;
    private lastPathname;
    private lastTrackedAt;
    constructor(getConfig: () => ResolvedTelemetryConfig | null, onTrack: RouteTrackCallback);
    track(pathname: string, referrer?: string): void;
    reset(): void;
}

interface ApiTrackCallback {
    (apiEndpoint: string, method: string): void;
}
interface ApiTrackRecord {
    apiEndpoint: string;
    method: string;
}
/**
 * Records API calls (path + method only). Optionally patches global fetch.
 */
declare class ApiTracker {
    private getConfig;
    private readonly onTrack;
    private originalFetch;
    private patched;
    private lastKey;
    private lastTrackedAt;
    constructor(getConfig: () => ResolvedTelemetryConfig | null, onTrack: ApiTrackCallback);
    install(): void;
    uninstall(): void;
    track(record: ApiTrackRecord): void;
    recordFetch(input: RequestInfo | URL, init?: RequestInit): void;
    reset(): void;
    private shouldRecord;
    private emit;
}

/**
 * Fire-and-forget transport: sendBeacon (plain JSON) when possible,
 * fetch with keepalive and optional gzip as fallback.
 */
declare class BeaconTransport implements Transport {
    send(options: TransportSendOptions): Promise<TransportResult>;
    private sendWithFetch;
}

/**
 * Removes keys and values that must never leave the browser (credentials, PHI, tokens).
 */
declare function sanitizePayload(input: Record<string, unknown> | undefined, depth?: number): Record<string, unknown> | undefined;

/** Singleton telemetry API */
declare const telemetry: TelemetrySDK;

export { type ApiCallPayload, ApiTracker, BeaconTransport, QueueManager, type ResolvedTelemetryConfig, RetryManager, RouteTracker, SessionManager, type TelemetryBatchPayload, type TelemetryConfig, TelemetryConfigError, type TelemetryEvent, TelemetrySDK, type TrackApiInput, type TrackInput, type TrackRouteInput, telemetry as default, resolveConfig, sanitizePayload, telemetry };
