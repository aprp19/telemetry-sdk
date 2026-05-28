# Next.js App Router example

Copy `TelemetryProvider.tsx` into your Next.js app (e.g. `app/providers/`) and wrap your root layout.

## Environment variables

```env
NEXT_PUBLIC_TELEMETRY_ENDPOINT=https://telemetry-gateway.nuha.care
NEXT_PUBLIC_PPK_CODE=1001003
NEXT_PUBLIC_TELEMETRY_APPS=SIMRS
NEXT_PUBLIC_TELEMETRY_API_KEY=your-api-key
NEXT_PUBLIC_TENANT_ID=tenant-1
NEXT_PUBLIC_HOSPITAL_ID=hospital-1
```

## Local SDK development

Link the package from the monorepo:

```bash
cd packages/telemetry-sdk && npm run build
cd ../../examples/nextjs-app-router
npm link ../packages/telemetry-sdk
```

Or add a workspace/file dependency in your app's `package.json`:

```json
"@nuha/telemetry-sdk": "file:../../packages/telemetry-sdk"
```
