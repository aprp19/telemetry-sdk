export { TelemetrySDK } from "./core/TelemetrySDK.js";
export { TelemetryConfigError, resolveConfig } from "./core/validate.js";
export { SessionManager } from "./storage/SessionManager.js";
export { QueueManager } from "./queue/QueueManager.js";
export { RetryManager } from "./queue/RetryManager.js";
export { RouteTracker } from "./trackers/RouteTracker.js";
export { ApiTracker } from "./trackers/ApiTracker.js";
export { BeaconTransport } from "./transport/index.js";
export { sanitizePayload } from "./storage/sanitize.js";
export type {
  TelemetryConfig,
  ResolvedTelemetryConfig,
  TelemetryEvent,
  TrackInput,
  TrackRouteInput,
  TrackApiInput,
  ApiCallPayload,
  TelemetryBatchPayload,
} from "./types/index.js";

import { TelemetrySDK } from "./core/TelemetrySDK.js";

/** Singleton telemetry API */
export const telemetry = new TelemetrySDK();

export default telemetry;
