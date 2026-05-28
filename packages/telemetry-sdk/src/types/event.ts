export type TelemetryEvent = {
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

export interface TrackInput {
  eventType: string;
  payload?: Record<string, unknown>;
  pathname?: string;
  referrer?: string;
  userId?: string;
}

export interface TrackRouteInput {
  pathname: string;
  referrer?: string;
}

export interface TrackApiInput {
  /** API path (e.g. /api/patients or full URL — stored as pathname only) */
  apiEndpoint: string;
  /** HTTP method (default: GET) */
  method?: string;
}

/** Minimal payload for api_call events — no request/response body */
export interface ApiCallPayload {
  apiEndpoint: string;
  method: string;
}

export interface TelemetryBatchPayload {
  events: TelemetryEvent[];
}
