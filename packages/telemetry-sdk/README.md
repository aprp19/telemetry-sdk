# @nuha/telemetry-sdk

Lightweight, browser-only telemetry SDK for **Next.js** applications. Collects route views and custom events, batches them in memory, and delivers them asynchronously with retry — without blocking the UI.

## Install

```bash
npm install @nuha/telemetry-sdk
```

## Quick start

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
});

telemetry.track({
  eventType: "button_click",
  payload: { button: "save_patient" },
});

telemetry.trackRoute({ pathname: "/emr/patient/123" });
```

See the [repository README](../../README.md) for full configuration, event schema, architecture, security guidelines, and Next.js examples.

## API

| Method | Description |
|--------|-------------|
| `telemetry.init(config)` | Initialize singleton SDK |
| `telemetry.track({ eventType, payload })` | Enqueue a custom event |
| `telemetry.trackRoute({ pathname })` | Track navigation (deduplicated) |
| `telemetry.trackApi({ apiEndpoint, method? })` | Track API path + method (no body) |
| `telemetry.flush()` | Manually flush the queue |
| `telemetry.setUserId(id)` | Set default user id on events |

## Security

Payloads are sanitized before enqueue. Never pass passwords, tokens, cookies, or PHI in `payload`.

## Build

```bash
npm run build
```
