import type { ResolvedTelemetryConfig } from "../types/index.js";

export function buildRequestHeaders(
  config: ResolvedTelemetryConfig,
  contentEncoding?: "gzip",
): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "Accept-Encoding": "gzip",
    "X-Telemetry-Version": String(config.version),
    "X-PPK-Code": config.ppkCode,
    "X-Apps": config.apps,
  };

  if (contentEncoding) {
    headers["Content-Encoding"] = contentEncoding;
  }

  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }

  return headers;
}
