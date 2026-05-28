import {
  generateEventId,
  getPathname,
  getReferrer,
  isBrowser,
} from "./browser.js";
import { resolveConfig } from "./validate.js";
import { SessionManager } from "../storage/SessionManager.js";
import { sanitizePayload } from "../storage/sanitize.js";
import { BeaconTransport } from "../transport/BeaconTransport.js";
import { QueueManager } from "../queue/QueueManager.js";
import { RetryManager } from "../queue/RetryManager.js";
import { RouteTracker } from "../trackers/RouteTracker.js";
import { ApiTracker } from "../trackers/ApiTracker.js";
import type {
  ResolvedTelemetryConfig,
  TelemetryConfig,
  TelemetryEvent,
  TrackApiInput,
  TrackInput,
  TrackRouteInput,
} from "../types/index.js";

export class TelemetrySDK {
  private config: ResolvedTelemetryConfig | null = null;
  private initialized = false;

  private readonly sessionManager = new SessionManager();
  private readonly transport = new BeaconTransport();
  private readonly retryManager = new RetryManager(
    this.transport,
    () => this.config,
  );
  private readonly queueManager = new QueueManager(
    this.transport,
    this.retryManager,
    () => this.config,
  );
  private readonly routeTracker = new RouteTracker(
    () => this.config,
    (pathname, referrer) => {
      this.trackRouteInternal(pathname, referrer);
    },
  );
  private readonly apiTracker = new ApiTracker(
    () => this.config,
    (apiEndpoint, method) => {
      this.trackApiInternal(apiEndpoint, method);
    },
  );

  init(config: TelemetryConfig): void {
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

  isInitialized(): boolean {
    return this.initialized && this.config !== null;
  }

  setUserId(userId: string | undefined): void {
    if (!this.config) return;
    this.config = {
      ...this.config,
      userId: userId?.trim() || undefined,
    };
  }

  track(input: TrackInput): void {
    if (!this.assertReady("track")) return;

    const event = this.buildEvent({
      eventType: input.eventType,
      payload: sanitizePayload(input.payload),
      pathname: input.pathname ?? getPathname(),
      referrer: input.referrer ?? getReferrer(),
      userId: input.userId,
    });

    this.queueManager.enqueue(event);
  }

  trackRoute(input: TrackRouteInput): void {
    if (!this.assertReady("trackRoute")) return;
    this.routeTracker.track(input.pathname, input.referrer);
  }

  trackApi(input: TrackApiInput): void {
    if (!this.assertReady("trackApi")) return;
    if (!this.config?.trackApi) {
      console.warn(
        "[@nuha/telemetry-sdk] trackApi() ignored; set trackApi: true in init().",
      );
      return;
    }
    this.apiTracker.track({
      apiEndpoint: input.apiEndpoint,
      method: input.method ?? "GET",
    });
  }

  flush(): Promise<boolean> {
    if (!this.assertReady("flush")) return Promise.resolve(false);
    return this.queueManager.flush();
  }

  getSessionId(): string {
    return this.sessionManager.getSessionId();
  }

  getPendingEventCount(): number {
    return this.queueManager.getPendingCount();
  }

  destroy(): void {
    this.queueManager.stop();
    this.retryManager.stop();
    this.apiTracker.uninstall();
    this.routeTracker.reset();
    this.apiTracker.reset();
    this.initialized = false;
    this.config = null;
  }

  private trackRouteInternal(pathname: string, referrer?: string): void {
    const event = this.buildEvent({
      eventType: "route_view",
      pathname,
      referrer: referrer ?? getReferrer(),
    });
    this.queueManager.enqueue(event);
  }

  private trackApiInternal(apiEndpoint: string, method: string): void {
    const event = this.buildEvent({
      eventType: "api_call",
      pathname: getPathname(),
      payload: { apiEndpoint, method },
    });
    this.queueManager.enqueue(event);
  }

  private buildEvent(partial: {
    eventType: string;
    payload?: Record<string, unknown>;
    pathname?: string;
    referrer?: string;
    userId?: string;
  }): TelemetryEvent {
    const config = this.config!;

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
      timestamp: new Date().toISOString(),
    };
  }

  private assertReady(method: string): boolean {
    if (!this.initialized || !this.config) {
      if (isBrowser()) {
        console.warn(
          `[@nuha/telemetry-sdk] ${method}() called before init(); event ignored.`,
        );
      }
      return false;
    }
    return true;
  }
}
