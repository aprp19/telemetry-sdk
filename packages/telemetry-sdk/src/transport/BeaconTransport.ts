import type { TelemetryBatchPayload } from "../types/index.js";
import { buildRequestHeaders } from "./headers.js";
import type { Transport, TransportResult, TransportSendOptions } from "./types.js";
import { serializeBatchBody } from "./body.js";

/**
 * Fire-and-forget transport: sendBeacon (plain JSON) when possible,
 * fetch with keepalive and optional gzip as fallback.
 */
export class BeaconTransport implements Transport {
  async send(options: TransportSendOptions): Promise<TransportResult> {
    const { config, events } = options;
    const payload: TelemetryBatchPayload = { events };
    const json = JSON.stringify(payload);

    if (
      typeof navigator !== "undefined" &&
      typeof navigator.sendBeacon === "function"
    ) {
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

  private sendWithFetch(
    endpoint: string,
    body: Blob | string,
    headers: HeadersInit,
  ): Promise<TransportResult> {
    return new Promise((resolve) => {
      try {
        void fetch(endpoint, {
          method: "POST",
          headers,
          body,
          keepalive: true,
          credentials: "omit",
          mode: "cors",
        })
          .then((response) => {
            if (response.ok) {
              resolve({ ok: true, status: response.status });
            } else {
              resolve({
                ok: false,
                status: response.status,
                error: `HTTP ${response.status}`,
              });
            }
          })
          .catch((error: unknown) => {
            const message =
              error instanceof Error ? error.message : "Network request failed";
            resolve({ ok: false, error: message });
          });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Transport unavailable";
        resolve({ ok: false, error: message });
      }
    });
  }
}
