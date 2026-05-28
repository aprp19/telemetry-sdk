import { isBrowser } from "../core/browser.js";

const SESSION_STORAGE_KEY = "nuha_telemetry_session_id";

export class SessionManager {
  private sessionId: string | null = null;

  getSessionId(): string {
    if (this.sessionId) return this.sessionId;

    if (!isBrowser()) {
      this.sessionId = this.createSessionId();
      return this.sessionId;
    }

    try {
      const existing = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (existing) {
        this.sessionId = existing;
        return existing;
      }
    } catch {
      // sessionStorage may be unavailable (private mode, blocked)
    }

    const id = this.createSessionId();
    this.sessionId = id;

    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, id);
    } catch {
      // ignore — in-memory session only
    }

    return id;
  }

  resetSession(): string {
    this.sessionId = this.createSessionId();
    if (isBrowser()) {
      try {
        sessionStorage.setItem(SESSION_STORAGE_KEY, this.sessionId);
      } catch {
        // ignore
      }
    }
    return this.sessionId;
  }

  private createSessionId(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }
}
