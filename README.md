# @nuha/telemetry-sdk

Lightweight, browser-only telemetry SDK for **Next.js** applications. Collects route views and custom events, batches them in memory, and delivers them asynchronously with retry — without blocking the UI.

> **Phase 1 (current):** SDK only. No gateway backend, Redpanda, ClickHouse, or consumers are included in this repo yet.

---

## Features

- **Route tracking** — App Router–friendly navigation events with referrer and duplicate suppression
- **API tracking** — Optional `fetch` instrumentation; records path + method only (no bodies), GET excluded by default
- **Event batching** — In-memory queue with interval and size-based flush
- **Retry** — Failed batches persisted to `localStorage` with exponential backoff
- **Session management** — Stable `sessionId` via `sessionStorage` + `crypto.randomUUID()`
- **Fire-and-forget transport** — `navigator.sendBeacon` with `fetch` + `keepalive` fallback
- **Payload sanitization** — Blocks credentials, tokens, cookies, and PHI-like fields
- **Tree-shakeable ESM** — Zero runtime dependencies, strict TypeScript

---

## Installation

### From GitHub (recommended)

```bash
npm install github:aprp19/telemetry-sdk#main:packages/telemetry-sdk
```

Or in `package.json`:

```json
{
  "dependencies": {
    "@nuha/telemetry-sdk": "github:aprp19/telemetry-sdk#main:packages/telemetry-sdk"
  }
}
```

The repo ships a pre-built `dist/` bundle so your app does not need to compile the SDK.

### Local path (development)

```bash
npm install ../telemetry-sdk/packages/telemetry-sdk
```

```json
{
  "dependencies": {
    "@nuha/telemetry-sdk": "file:../telemetry-sdk/packages/telemetry-sdk"
  }
}
```

### Build from source (this repo)

```bash
npm install
npm run build
```

---

## Quick start

### 1. Initialize once (client-side)

```ts
import { telemetry } from "@nuha/telemetry-sdk";

telemetry.init({
  endpoint: "https://telemetry-gateway.nuha.care",
  ppkCode: "1001003",
  apps: "SIMRS",
  apiKey: process.env.NEXT_PUBLIC_TELEMETRY_API_KEY,
  tenantId: process.env.NEXT_PUBLIC_TENANT_ID,
  hospitalId: process.env.NEXT_PUBLIC_HOSPITAL_ID,
  flushInterval: 5000,
  maxQueueSize: 20,
  trackApi: true,
  apiTrackExcludeGet: true,
});
```

### 2. Track custom events

```ts
telemetry.track({
  eventType: "button_click",
  payload: { button: "save_patient" },
});
```

`track()` only enqueues — it never awaits the network.

### 3. Track routes (Next.js App Router)

```tsx
"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { telemetry } from "@nuha/telemetry-sdk";

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname) telemetry.trackRoute({ pathname });
  }, [pathname]);

  return <>{children}</>;
}
```

Wrap your root layout with `TelemetryProvider`. A full example lives in [`examples/nextjs-app-router/`](examples/nextjs-app-router/).

### 4. Track API calls (optional)

Enable automatic `fetch` tracking in `init()`:

```ts
telemetry.init({
  // ...
  trackApi: true,
  apiTrackExcludeGet: true, // default: skip GET
});
```

Each call emits `eventType: "api_call"` with payload `{ apiEndpoint: "/api/patients", method: "POST" }` — no request/response body.

Manual tracking (e.g. for `axios`):

```ts
telemetry.trackApi({ apiEndpoint: "/api/patients", method: "POST" });
```

Telemetry ingest requests to your configured `endpoint` are never recorded.

### 5. Manual flush (optional)

```ts
await telemetry.flush();
```

The queue is cleared only after a successful send. Failed batches are stored for automatic retry.

---

## Configuration

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `endpoint` | Yes | — | HTTPS ingestion URL |
| `ppkCode` | Yes | — | Provider / facility code |
| `apps` | Yes | — | Application name (e.g. `SIMRS`) |
| `apiKey` | No | — | Sent as `Authorization: Bearer …` |
| `flushInterval` | No | `5000` | Auto-flush interval (ms), 1000–60000 |
| `maxQueueSize` | No | `20` | Flush when queue reaches this size |
| `maxRetryAttempts` | No | `5` | Max retries per failed batch |
| `retryBaseDelayMs` | No | `1000` | Base delay for exponential backoff |
| `version` | No | `1` | Event schema version |
| `tenantId` | No | — | Attached to every event |
| `hospitalId` | No | — | Attached to every event |
| `userId` | No | — | Default user id for events |
| `routeDebounceMs` | No | `300` | Suppress duplicate route events within this window |
| `trackApi` | No | `false` | Patch `fetch` and emit `api_call` events |
| `apiTrackExcludeGet` | No | `true` | Do not record `GET` API calls |
| `apiDebounceMs` | No | `300` | Suppress duplicate `api_call` events within this window |

```ts
telemetry.setUserId("user-42"); // update after login
```

---

## API reference

| Method | Description |
|--------|-------------|
| `telemetry.init(config)` | Initialize the singleton SDK (call once on the client) |
| `telemetry.track(input)` | Enqueue a custom event (auto-enriched, sanitized) |
| `telemetry.trackRoute({ pathname, referrer? })` | Enqueue a `route_view` event (deduplicated) |
| `telemetry.trackApi({ apiEndpoint, method? })` | Enqueue an `api_call` event (requires `trackApi: true`) |
| `telemetry.flush()` | `Promise<boolean>` — send current queue now |
| `telemetry.setUserId(id)` | Set default `userId` on subsequent events |
| `telemetry.getSessionId()` | Current session id |
| `telemetry.getPendingEventCount()` | Events waiting in memory |
| `telemetry.isInitialized()` | Whether `init()` has been called |
| `telemetry.destroy()` | Stop timers and clear SDK state |

Named exports are also available for advanced use: `TelemetrySDK`, `QueueManager`, `SessionManager`, `RetryManager`, `RouteTracker`, `BeaconTransport`, `sanitizePayload`.

---

## Event schema

Each event sent to the gateway matches this shape:

```ts
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
  timestamp: string; // ISO 8601
};
```

**Batch request body:**

```json
{
  "events": [ /* TelemetryEvent[] */ ]
}
```

**Auto-enrichment on `track()`:** `timestamp`, `sessionId`, `pathname` (from `window.location`), `tenantId`, `hospitalId`, plus config fields `ppkCode`, `apps`, `version`.

**Route events** use `eventType: "route_view"` and include `pathname` + `referrer`.

**API events** use `eventType: "api_call"` with payload `{ apiEndpoint, method }` (pathname only, no query string or body).

---

## How it works

```
track() / trackRoute() / fetch (trackApi)
        │
        ▼
  sanitizePayload()
        │
        ▼
   QueueManager (memory)
        │
        ├─ flush on interval
        ├─ flush on maxQueueSize
        └─ flush on page hide (beacon)
        │
        ▼
   BeaconTransport
        ├─ navigator.sendBeacon (JSON)
        └─ fetch + keepalive (+ optional gzip)
        │
        ├─ success → queue cleared
        └─ failure → RetryManager (localStorage + backoff)
```

- **SessionManager** — `sessionId` in `sessionStorage` (`nuha_telemetry_session_id`)
- **RetryManager** — failed batches in `localStorage` (`nuha_telemetry_failed_batches`)
- **RouteTracker** — ignores the same `pathname` fired again within `routeDebounceMs`

---

## Security

The SDK **sanitizes** payloads before enqueue. Keys matching passwords, tokens, cookies, API keys, and common PHI field names are dropped. Values that look like JWTs or bearer tokens are redacted.

**Never send:**

- Passwords or secrets
- Auth tokens or session cookies
- Patient medical data or PHI in `payload`

Use opaque identifiers (e.g. internal user id) instead of clinical content.

---

## Environment variables (Next.js)

```env
NEXT_PUBLIC_TELEMETRY_ENDPOINT=https://telemetry-gateway.nuha.care
NEXT_PUBLIC_PPK_CODE=1001003
NEXT_PUBLIC_TELEMETRY_APPS=SIMRS
NEXT_PUBLIC_TELEMETRY_API_KEY=your-api-key
NEXT_PUBLIC_TENANT_ID=tenant-1
NEXT_PUBLIC_HOSPITAL_ID=hospital-1
```

---

## Development

```bash
cd packages/telemetry-sdk

npm install
npm run build      # ESM + .d.ts → dist/
npm run dev        # watch mode
npm run typecheck  # tsc --noEmit
```

### Project structure

```
packages/telemetry-sdk/
├── src/
│   ├── core/           # TelemetrySDK, validation, browser helpers
│   ├── queue/          # QueueManager, RetryManager
│   ├── transport/      # BeaconTransport
│   ├── trackers/       # RouteTracker
│   ├── storage/        # SessionManager, sanitize
│   └── types/
├── dist/               # build output
├── package.json
├── tsconfig.json
└── tsup.config.ts

examples/nextjs-app-router/   # integration example
```

---

## Principles

1. **Lightweight** — small bundle, no runtime deps  
2. **Tree-shake friendly** — `sideEffects: false`  
3. **Non-blocking** — never await sends during user interactions  
4. **Browser-safe** — guards for SSR / missing APIs  
5. **Healthcare-safe** — sanitization by default  

---

## License

MIT
