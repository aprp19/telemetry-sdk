# @nuha/telemetry-sdk

Browser telemetry SDK for Next.js — route tracking, API tracking, batching, retry, and fire-and-forget delivery.

**Full documentation:** [github.com/aprp19/telemetry-sdk](https://github.com/aprp19/telemetry-sdk/blob/main/README.md)

## Install

```bash
npm install github:aprp19/telemetry-sdk#main:packages/telemetry-sdk
```

## Usage

```ts
import { telemetry } from "@nuha/telemetry-sdk";

telemetry.init({
  endpoint: "https://telemetry-gateway.nuha.care",
  ppkCode: "1001003",
  apps: "SIMRS",
  trackApi: true,
  apiTrackExcludeGet: true,
});

telemetry.track({ eventType: "button_click", payload: { button: "save" } });
telemetry.trackRoute({ pathname: "/dashboard" });
telemetry.trackApi({ apiEndpoint: "/api/items", method: "POST" });
```

See the [root README](../../README.md) for configuration, Next.js setup, event schema, and security guidelines.
