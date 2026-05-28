// src/core/browser.ts
function isBrowser() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}
function getPathname() {
  if (!isBrowser()) return void 0;
  return window.location.pathname;
}
function getReferrer() {
  if (!isBrowser()) return void 0;
  const ref = document.referrer;
  return ref.length > 0 ? ref : void 0;
}
function generateEventId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

// src/core/validate.ts
var DEFAULT_FLUSH_INTERVAL = 5e3;
var DEFAULT_MAX_QUEUE_SIZE = 20;
var DEFAULT_MAX_RETRY_ATTEMPTS = 5;
var DEFAULT_RETRY_BASE_DELAY_MS = 1e3;
var DEFAULT_VERSION = 1;
var DEFAULT_ROUTE_DEBOUNCE_MS = 300;
var DEFAULT_API_DEBOUNCE_MS = 300;
var MIN_FLUSH_INTERVAL = 1e3;
var MAX_FLUSH_INTERVAL = 6e4;
var MIN_QUEUE_SIZE = 1;
var MAX_QUEUE_SIZE = 500;
var TelemetryConfigError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "TelemetryConfigError";
  }
};
function assertNonEmptyString(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TelemetryConfigError(`${field} is required and must be a non-empty string`);
  }
}
function assertValidUrl(value, field) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new TelemetryConfigError(`${field} must use http or https`);
    }
  } catch {
    throw new TelemetryConfigError(`${field} must be a valid URL`);
  }
}
function clampNumber(value, fallback, min, max, field) {
  const resolved = value ?? fallback;
  if (!Number.isFinite(resolved) || resolved < min || resolved > max) {
    throw new TelemetryConfigError(
      `${field} must be a number between ${min} and ${max}`
    );
  }
  return resolved;
}
function resolveConfig(config) {
  assertNonEmptyString(config.endpoint, "endpoint");
  assertNonEmptyString(config.ppkCode, "ppkCode");
  assertNonEmptyString(config.apps, "apps");
  const endpoint = config.endpoint.trim();
  assertValidUrl(endpoint, "endpoint");
  if (config.apiKey !== void 0) {
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
      "flushInterval"
    ),
    maxQueueSize: clampNumber(
      config.maxQueueSize,
      DEFAULT_MAX_QUEUE_SIZE,
      MIN_QUEUE_SIZE,
      MAX_QUEUE_SIZE,
      "maxQueueSize"
    ),
    maxRetryAttempts: clampNumber(
      config.maxRetryAttempts,
      DEFAULT_MAX_RETRY_ATTEMPTS,
      0,
      20,
      "maxRetryAttempts"
    ),
    retryBaseDelayMs: clampNumber(
      config.retryBaseDelayMs,
      DEFAULT_RETRY_BASE_DELAY_MS,
      100,
      6e4,
      "retryBaseDelayMs"
    ),
    version: config.version ?? DEFAULT_VERSION,
    tenantId: config.tenantId?.trim() || void 0,
    hospitalId: config.hospitalId?.trim() || void 0,
    userId: config.userId?.trim() || void 0,
    routeDebounceMs: clampNumber(
      config.routeDebounceMs,
      DEFAULT_ROUTE_DEBOUNCE_MS,
      0,
      5e3,
      "routeDebounceMs"
    ),
    trackApi: config.trackApi ?? false,
    apiTrackExcludeGet: config.apiTrackExcludeGet ?? true,
    apiDebounceMs: clampNumber(
      config.apiDebounceMs,
      DEFAULT_API_DEBOUNCE_MS,
      0,
      5e3,
      "apiDebounceMs"
    )
  };
}

// src/storage/SessionManager.ts
var SESSION_STORAGE_KEY = "nuha_telemetry_session_id";
var SessionManager = class {
  constructor() {
    this.sessionId = null;
  }
  getSessionId() {
    if (this.sessionId) return this.sessionId;
    if (!isBrowser()) {
      this.sessionId = this.createSessionId();
      return this.sessionId;
    }
    try {
      const existing = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (existing) {
        this.sessionId = existing;
        return existing;
      }
    } catch {
    }
    const id = this.createSessionId();
    this.sessionId = id;
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, id);
    } catch {
    }
    return id;
  }
  resetSession() {
    this.sessionId = this.createSessionId();
    if (isBrowser()) {
      try {
        sessionStorage.setItem(SESSION_STORAGE_KEY, this.sessionId);
      } catch {
      }
    }
    return this.sessionId;
  }
  createSessionId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }
};

// src/storage/sanitize.ts
var BLOCKED_KEY_PATTERNS = [
  /^password$/i,
  /^passwd$/i,
  /^pwd$/i,
  /^secret$/i,
  /^token$/i,
  /^auth$/i,
  /^authorization$/i,
  /^api[_-]?key$/i,
  /^cookie$/i,
  /^cookies$/i,
  /^session$/i,
  /^ssn$/i,
  /^nik$/i,
  /^mrn$/i,
  /^medical[_-]?record$/i,
  /^diagnosis$/i,
  /^icd$/i,
  /^patient[_-]?name$/i,
  /^patient[_-]?data$/i,
  /^phi$/i,
  /^dob$/i,
  /^date[_-]?of[_-]?birth$/i
];
var SENSITIVE_VALUE_PATTERNS = [
  /^Bearer\s+/i,
  /^eyJ[a-zA-Z0-9_-]+\.eyJ/i,
  /^[a-f0-9]{32,}$/i
];
var MAX_DEPTH = 8;
var MAX_ARRAY_LENGTH = 50;
var MAX_STRING_LENGTH = 500;
function isBlockedKey(key) {
  return BLOCKED_KEY_PATTERNS.some((pattern) => pattern.test(key));
}
function isSensitiveValue(value) {
  return SENSITIVE_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}
function truncateString(value) {
  if (value.length <= MAX_STRING_LENGTH) return value;
  return `${value.slice(0, MAX_STRING_LENGTH)}\u2026`;
}
function sanitizePayload(input, depth = 0) {
  if (!input) return void 0;
  if (depth > MAX_DEPTH) return { _truncated: true };
  const output = {};
  for (const [key, raw] of Object.entries(input)) {
    if (isBlockedKey(key)) continue;
    const sanitized = sanitizeValue(raw, depth + 1);
    if (sanitized !== void 0) {
      output[key] = sanitized;
    }
  }
  return Object.keys(output).length > 0 ? output : void 0;
}
function sanitizeValue(value, depth) {
  if (value === null || value === void 0) return value;
  if (typeof value === "string") {
    if (isSensitiveValue(value)) return "[REDACTED]";
    return truncateString(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_LENGTH).map((item) => sanitizeValue(item, depth)).filter((item) => item !== void 0);
  }
  if (typeof value === "object") {
    if (depth > MAX_DEPTH) return { _truncated: true };
    const record = value;
    const nested = {};
    for (const [key, nestedValue] of Object.entries(record)) {
      if (isBlockedKey(key)) continue;
      const sanitized = sanitizeValue(nestedValue, depth + 1);
      if (sanitized !== void 0) nested[key] = sanitized;
    }
    return Object.keys(nested).length > 0 ? nested : void 0;
  }
  return void 0;
}

// src/transport/headers.ts
function buildRequestHeaders(config, contentEncoding) {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "Accept-Encoding": "gzip",
    "X-Telemetry-Version": String(config.version),
    "X-PPK-Code": config.ppkCode,
    "X-Apps": config.apps
  };
  if (contentEncoding) {
    headers["Content-Encoding"] = contentEncoding;
  }
  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }
  return headers;
}

// src/transport/body.ts
async function serializeBatchBody(payload) {
  const json = JSON.stringify(payload);
  if (typeof CompressionStream !== "undefined" && typeof Blob !== "undefined") {
    try {
      const stream = new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"));
      const compressed = await new Response(stream).blob();
      return { body: compressed, contentEncoding: "gzip" };
    } catch {
    }
  }
  return { body: json };
}

// src/transport/BeaconTransport.ts
var BeaconTransport = class {
  async send(options) {
    const { config, events } = options;
    const payload = { events };
    const json = JSON.stringify(payload);
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([json], { type: "application/json" });
      const beaconOk = navigator.sendBeacon(config.endpoint, blob);
      if (beaconOk) {
        return { ok: true, status: 202 };
      }
    }
    const { body, contentEncoding } = await serializeBatchBody(payload);
    const headers = buildRequestHeaders(config, contentEncoding);
    return this.sendWithFetch(config.endpoint, body, headers);
  }
  sendWithFetch(endpoint, body, headers) {
    return new Promise((resolve) => {
      try {
        void fetch(endpoint, {
          method: "POST",
          headers,
          body,
          keepalive: true,
          credentials: "omit",
          mode: "cors"
        }).then((response) => {
          if (response.ok) {
            resolve({ ok: true, status: response.status });
          } else {
            resolve({
              ok: false,
              status: response.status,
              error: `HTTP ${response.status}`
            });
          }
        }).catch((error) => {
          const message = error instanceof Error ? error.message : "Network request failed";
          resolve({ ok: false, error: message });
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Transport unavailable";
        resolve({ ok: false, error: message });
      }
    });
  }
};

// src/queue/QueueManager.ts
var QueueManager = class {
  constructor(transport, retryManager, getConfig) {
    this.transport = transport;
    this.retryManager = retryManager;
    this.getConfig = getConfig;
    this.queue = [];
    this.flushTimer = null;
    this.flushing = false;
    this.unloadBound = false;
  }
  start() {
    const config = this.getConfig();
    if (!config) return;
    this.stopTimer();
    this.flushTimer = setInterval(() => {
      void this.flush();
    }, config.flushInterval);
    this.bindUnload();
  }
  stop() {
    this.stopTimer();
  }
  enqueue(event) {
    const config = this.getConfig();
    if (!config) return;
    this.queue.push(event);
    if (this.queue.length >= config.maxQueueSize) {
      void this.flush();
    }
  }
  enqueueMany(events) {
    for (const event of events) {
      this.enqueue(event);
    }
  }
  getPendingCount() {
    return this.queue.length;
  }
  async flush() {
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
  flushSyncOnUnload() {
    const config = this.getConfig();
    if (!config || this.queue.length === 0) return;
    const batch = this.queue.slice();
    this.queue = [];
    void this.transport.send({ config, events: batch });
  }
  stopTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }
  bindUnload() {
    if (!isBrowser() || this.unloadBound) return;
    this.unloadBound = true;
    const onUnload = () => {
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
};

// src/storage/safeStorage.ts
function readLocalStorage(key) {
  if (!isBrowser()) return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeLocalStorage(key, value) {
  if (!isBrowser()) return false;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
function removeLocalStorage(key) {
  if (!isBrowser()) return;
  try {
    localStorage.removeItem(key);
  } catch {
  }
}

// src/queue/RetryManager.ts
var RETRY_STORAGE_KEY = "nuha_telemetry_failed_batches";
var RetryManager = class {
  constructor(transport, getConfig) {
    this.transport = transport;
    this.getConfig = getConfig;
    this.timer = null;
    this.processing = false;
  }
  persistFailedBatch(events, attempt = 0) {
    const batches = this.loadBatches();
    batches.push({
      events,
      attempt,
      nextRetryAt: Date.now() + this.getBackoffMs(attempt)
    });
    this.saveBatches(batches);
    this.scheduleRetry();
  }
  start() {
    this.scheduleRetry();
  }
  stop() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
  scheduleRetry() {
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
  async processRetries() {
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
          events: batch.events
        });
        if (result.ok) continue;
        const nextAttempt = batch.attempt + 1;
        if (nextAttempt > config.maxRetryAttempts) {
          continue;
        }
        remaining.push({
          events: batch.events,
          attempt: nextAttempt,
          nextRetryAt: Date.now() + this.getBackoffMs(nextAttempt)
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
  getBackoffMs(attempt) {
    const config = this.getConfig();
    const base = config?.retryBaseDelayMs ?? 1e3;
    return base * 2 ** Math.min(attempt, 10);
  }
  loadBatches() {
    const raw = readLocalStorage(RETRY_STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  saveBatches(batches) {
    if (batches.length === 0) {
      removeLocalStorage(RETRY_STORAGE_KEY);
      return;
    }
    writeLocalStorage(RETRY_STORAGE_KEY, JSON.stringify(batches));
  }
};

// src/trackers/RouteTracker.ts
var RouteTracker = class {
  constructor(getConfig, onTrack) {
    this.getConfig = getConfig;
    this.onTrack = onTrack;
    this.lastPathname = null;
    this.lastTrackedAt = 0;
  }
  track(pathname, referrer) {
    const config = this.getConfig();
    if (!config) return;
    const normalized = pathname.trim() || "/";
    const now = Date.now();
    const debounceMs = config.routeDebounceMs;
    if (this.lastPathname === normalized && now - this.lastTrackedAt < debounceMs) {
      return;
    }
    const resolvedReferrer = referrer ?? getReferrer();
    this.lastPathname = normalized;
    this.lastTrackedAt = now;
    this.onTrack(normalized, resolvedReferrer);
  }
  reset() {
    this.lastPathname = null;
    this.lastTrackedAt = 0;
  }
};

// src/trackers/parseApiUrl.ts
function parseApiEndpoint(input) {
  const base = isBrowser() ? window.location.href : "http://localhost";
  try {
    if (typeof input === "string") {
      return new URL(input, base).pathname || "/";
    }
    if (input instanceof URL) {
      return input.pathname || "/";
    }
    if (typeof Request !== "undefined" && input instanceof Request) {
      return new URL(input.url, base).pathname || "/";
    }
  } catch {
    return null;
  }
  return null;
}
function resolveHttpMethod(input, init) {
  if (init?.method) return init.method.toUpperCase();
  if (typeof Request !== "undefined" && input instanceof Request) {
    return input.method.toUpperCase();
  }
  return "GET";
}
function isTelemetryIngestUrl(requestUrl, telemetryEndpoint) {
  try {
    const base = isBrowser() ? window.location.href : "http://localhost";
    const req = new URL(requestUrl, base);
    const ingest = new URL(telemetryEndpoint);
    return req.origin === ingest.origin && req.pathname === ingest.pathname;
  } catch {
    return false;
  }
}

// src/trackers/ApiTracker.ts
var ApiTracker = class {
  constructor(getConfig, onTrack) {
    this.getConfig = getConfig;
    this.onTrack = onTrack;
    this.originalFetch = null;
    this.patched = false;
    this.lastKey = null;
    this.lastTrackedAt = 0;
  }
  install() {
    if (!isBrowser() || this.patched || typeof window.fetch !== "function") {
      return;
    }
    this.originalFetch = window.fetch.bind(window);
    const original = this.originalFetch;
    window.fetch = (input, init) => {
      this.recordFetch(input, init);
      return original(input, init);
    };
    this.patched = true;
  }
  uninstall() {
    if (!this.patched || !this.originalFetch) return;
    window.fetch = this.originalFetch;
    this.originalFetch = null;
    this.patched = false;
  }
  track(record) {
    const config = this.getConfig();
    if (!config?.trackApi) return;
    const apiEndpoint = normalizeEndpoint(record.apiEndpoint);
    const method = record.method.toUpperCase();
    if (!this.shouldRecord(method)) return;
    this.emit(apiEndpoint, method);
  }
  recordFetch(input, init) {
    const config = this.getConfig();
    if (!config?.trackApi) return;
    const method = resolveHttpMethod(input, init);
    if (!this.shouldRecord(method)) return;
    const apiEndpoint = parseApiEndpoint(input);
    if (!apiEndpoint) return;
    const requestUrl = typeof input === "string" ? input : input instanceof URL ? input.href : input instanceof Request ? input.url : null;
    if (requestUrl && isTelemetryIngestUrl(requestUrl, config.endpoint)) {
      return;
    }
    this.emit(apiEndpoint, method);
  }
  reset() {
    this.lastKey = null;
    this.lastTrackedAt = 0;
  }
  shouldRecord(method) {
    const config = this.getConfig();
    if (!config?.trackApi) return false;
    if (config.apiTrackExcludeGet && method === "GET") return false;
    return true;
  }
  emit(apiEndpoint, method) {
    const config = this.getConfig();
    if (!config) return;
    const key = `${method}:${apiEndpoint}`;
    const now = Date.now();
    if (this.lastKey === key && now - this.lastTrackedAt < config.apiDebounceMs) {
      return;
    }
    this.lastKey = key;
    this.lastTrackedAt = now;
    this.onTrack(apiEndpoint, method);
  }
};
function normalizeEndpoint(endpoint) {
  const trimmed = endpoint.trim();
  if (!trimmed) return "/";
  if (trimmed.startsWith("/")) {
    try {
      const base = typeof window !== "undefined" ? window.location.href : "http://localhost";
      return new URL(trimmed, base).pathname || "/";
    } catch {
      return trimmed.split("?")[0]?.split("#")[0] || "/";
    }
  }
  try {
    const base = typeof window !== "undefined" ? window.location.href : "http://localhost";
    return new URL(trimmed, base).pathname || "/";
  } catch {
    return `/${trimmed.replace(/^\/+/, "").split("?")[0]?.split("#")[0]}`;
  }
}

// src/core/TelemetrySDK.ts
var TelemetrySDK = class {
  constructor() {
    this.config = null;
    this.initialized = false;
    this.sessionManager = new SessionManager();
    this.transport = new BeaconTransport();
    this.retryManager = new RetryManager(
      this.transport,
      () => this.config
    );
    this.queueManager = new QueueManager(
      this.transport,
      this.retryManager,
      () => this.config
    );
    this.routeTracker = new RouteTracker(
      () => this.config,
      (pathname, referrer) => {
        this.trackRouteInternal(pathname, referrer);
      }
    );
    this.apiTracker = new ApiTracker(
      () => this.config,
      (apiEndpoint, method) => {
        this.trackApiInternal(apiEndpoint, method);
      }
    );
  }
  init(config) {
    if (this.initialized) {
      console.warn("[@nuha/telemetry-sdk] init() called more than once; reconfiguring.");
    }
    this.config = resolveConfig(config);
    this.initialized = true;
    this.sessionManager.getSessionId();
    this.queueManager.start();
    this.retryManager.start();
    this.apiTracker.uninstall();
    if (this.config.trackApi) {
      this.apiTracker.install();
    } else {
      this.apiTracker.reset();
    }
  }
  isInitialized() {
    return this.initialized && this.config !== null;
  }
  setUserId(userId) {
    if (!this.config) return;
    this.config = {
      ...this.config,
      userId: userId?.trim() || void 0
    };
  }
  track(input) {
    if (!this.assertReady("track")) return;
    const event = this.buildEvent({
      eventType: input.eventType,
      payload: sanitizePayload(input.payload),
      pathname: input.pathname ?? getPathname(),
      referrer: input.referrer ?? getReferrer(),
      userId: input.userId
    });
    this.queueManager.enqueue(event);
  }
  trackRoute(input) {
    if (!this.assertReady("trackRoute")) return;
    this.routeTracker.track(input.pathname, input.referrer);
  }
  trackApi(input) {
    if (!this.assertReady("trackApi")) return;
    if (!this.config?.trackApi) {
      console.warn(
        "[@nuha/telemetry-sdk] trackApi() ignored; set trackApi: true in init()."
      );
      return;
    }
    this.apiTracker.track({
      apiEndpoint: input.apiEndpoint,
      method: input.method ?? "GET"
    });
  }
  flush() {
    if (!this.assertReady("flush")) return Promise.resolve(false);
    return this.queueManager.flush();
  }
  getSessionId() {
    return this.sessionManager.getSessionId();
  }
  getPendingEventCount() {
    return this.queueManager.getPendingCount();
  }
  destroy() {
    this.queueManager.stop();
    this.retryManager.stop();
    this.apiTracker.uninstall();
    this.routeTracker.reset();
    this.apiTracker.reset();
    this.initialized = false;
    this.config = null;
  }
  trackRouteInternal(pathname, referrer) {
    const event = this.buildEvent({
      eventType: "route_view",
      pathname,
      referrer: referrer ?? getReferrer()
    });
    this.queueManager.enqueue(event);
  }
  trackApiInternal(apiEndpoint, method) {
    const event = this.buildEvent({
      eventType: "api_call",
      pathname: getPathname(),
      payload: { apiEndpoint, method }
    });
    this.queueManager.enqueue(event);
  }
  buildEvent(partial) {
    const config = this.config;
    return {
      id: generateEventId(),
      version: config.version,
      ppkCode: config.ppkCode,
      apps: config.apps,
      sessionId: this.sessionManager.getSessionId(),
      userId: partial.userId ?? config.userId,
      eventType: partial.eventType,
      pathname: partial.pathname,
      referrer: partial.referrer,
      tenantId: config.tenantId,
      hospitalId: config.hospitalId,
      payload: partial.payload,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  assertReady(method) {
    if (!this.initialized || !this.config) {
      if (isBrowser()) {
        console.warn(
          `[@nuha/telemetry-sdk] ${method}() called before init(); event ignored.`
        );
      }
      return false;
    }
    return true;
  }
};

// src/index.ts
var telemetry = new TelemetrySDK();
var index_default = telemetry;

export { ApiTracker, BeaconTransport, QueueManager, RetryManager, RouteTracker, SessionManager, TelemetryConfigError, TelemetrySDK, index_default as default, resolveConfig, sanitizePayload, telemetry };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map