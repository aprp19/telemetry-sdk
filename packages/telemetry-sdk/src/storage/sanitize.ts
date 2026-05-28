const BLOCKED_KEY_PATTERNS = [
  /^password$/i,
  /^passwd$/i,
  /^pwd$/i,
  /^secret$/i,
  /^token$/i,
  /^auth$/i,
  /^authorization$/i,
  /^api[_-]?key$/i,
  /^cookie$/i,
  /^cookies$/i,
  /^session$/i,
  /^ssn$/i,
  /^nik$/i,
  /^mrn$/i,
  /^medical[_-]?record$/i,
  /^diagnosis$/i,
  /^icd$/i,
  /^patient[_-]?name$/i,
  /^patient[_-]?data$/i,
  /^phi$/i,
  /^dob$/i,
  /^date[_-]?of[_-]?birth$/i,
];

const SENSITIVE_VALUE_PATTERNS = [
  /^Bearer\s+/i,
  /^eyJ[a-zA-Z0-9_-]+\.eyJ/i,
  /^[a-f0-9]{32,}$/i,
];

const MAX_DEPTH = 8;
const MAX_ARRAY_LENGTH = 50;
const MAX_STRING_LENGTH = 500;

function isBlockedKey(key: string): boolean {
  return BLOCKED_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function isSensitiveValue(value: string): boolean {
  return SENSITIVE_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

function truncateString(value: string): string {
  if (value.length <= MAX_STRING_LENGTH) return value;
  return `${value.slice(0, MAX_STRING_LENGTH)}…`;
}

/**
 * Removes keys and values that must never leave the browser (credentials, PHI, tokens).
 */
export function sanitizePayload(
  input: Record<string, unknown> | undefined,
  depth = 0,
): Record<string, unknown> | undefined {
  if (!input) return undefined;
  if (depth > MAX_DEPTH) return { _truncated: true };

  const output: Record<string, unknown> = {};

  for (const [key, raw] of Object.entries(input)) {
    if (isBlockedKey(key)) continue;

    const sanitized = sanitizeValue(raw, depth + 1);
    if (sanitized !== undefined) {
      output[key] = sanitized;
    }
  }

  return Object.keys(output).length > 0 ? output : undefined;
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === "string") {
    if (isSensitiveValue(value)) return "[REDACTED]";
    return truncateString(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_LENGTH)
      .map((item) => sanitizeValue(item, depth))
      .filter((item) => item !== undefined);
  }

  if (typeof value === "object") {
    if (depth > MAX_DEPTH) return { _truncated: true };
    const record = value as Record<string, unknown>;
    const nested: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(record)) {
      if (isBlockedKey(key)) continue;
      const sanitized = sanitizeValue(nestedValue, depth + 1);
      if (sanitized !== undefined) nested[key] = sanitized;
    }
    return Object.keys(nested).length > 0 ? nested : undefined;
  }

  return undefined;
}
