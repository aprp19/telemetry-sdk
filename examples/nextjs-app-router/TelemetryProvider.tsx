"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { telemetry } from "@nuha/telemetry-sdk";

let initialized = false;

function ensureTelemetryInit(): void {
  if (initialized) return;
  initialized = true;

  telemetry.init({
    endpoint:
      process.env.NEXT_PUBLIC_TELEMETRY_ENDPOINT ??
      "https://telemetry-gateway.nuha.care",
    ppkCode: process.env.NEXT_PUBLIC_PPK_CODE ?? "1001003",
    apps: process.env.NEXT_PUBLIC_TELEMETRY_APPS ?? "SIMRS",
    apiKey: process.env.NEXT_PUBLIC_TELEMETRY_API_KEY,
    tenantId: process.env.NEXT_PUBLIC_TENANT_ID,
    hospitalId: process.env.NEXT_PUBLIC_HOSPITAL_ID,
    flushInterval: 5000,
    maxQueueSize: 20,
    trackApi: true,
    apiTrackExcludeGet: true,
  });
}

export function TelemetryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  useEffect(() => {
    ensureTelemetryInit();
  }, []);

  useEffect(() => {
    if (!pathname) return;
    telemetry.trackRoute({ pathname });
  }, [pathname]);

  return <>{children}</>;
}

/**
 * Example: track a UI interaction without blocking the main thread.
 */
export function trackButtonClick(buttonId: string): void {
  telemetry.track({
    eventType: "button_click",
    payload: { button: buttonId },
  });
}
