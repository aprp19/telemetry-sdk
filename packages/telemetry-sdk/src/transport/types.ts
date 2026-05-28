import type { ResolvedTelemetryConfig, TelemetryEvent } from "../types/index.js";

export interface TransportSendOptions {
  config: ResolvedTelemetryConfig;
  events: TelemetryEvent[];
}

export interface TransportResult {
  ok: boolean;
  status?: number;
  error?: string;
}

export interface Transport {
  send(options: TransportSendOptions): Promise<TransportResult>;
}
