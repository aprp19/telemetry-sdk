export function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

export function getPathname(): string | undefined {
  if (!isBrowser()) return undefined;
  return window.location.pathname;
}

export function getReferrer(): string | undefined {
  if (!isBrowser()) return undefined;
  const ref = document.referrer;
  return ref.length > 0 ? ref : undefined;
}

export function generateEventId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}
