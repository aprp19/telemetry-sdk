import { isBrowser } from "../core/browser.js";

/**
 * Resolves an API path (pathname only, no query or hash) from a fetch input.
 */
export function parseApiEndpoint(input: RequestInfo | URL): string | null {
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

export function resolveHttpMethod(
  input: RequestInfo | URL,
  init?: RequestInit,
): string {
  if (init?.method) return init.method.toUpperCase();
  if (typeof Request !== "undefined" && input instanceof Request) {
    return input.method.toUpperCase();
  }
  return "GET";
}

export function isTelemetryIngestUrl(
  requestUrl: string,
  telemetryEndpoint: string,
): boolean {
  try {
    const base = isBrowser() ? window.location.href : "http://localhost";
    const req = new URL(requestUrl, base);
    const ingest = new URL(telemetryEndpoint);
    return req.origin === ingest.origin && req.pathname === ingest.pathname;
  } catch {
    return false;
  }
}
