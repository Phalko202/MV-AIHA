/* ------------------------------------------------------------------ */
/*  DATA LOGGER — Vinavi Patient Portal                                */
/*  Logs all actions to console + localStorage for audit trail         */
/* ------------------------------------------------------------------ */

export interface LogEntry {
  timestamp: string;
  action: string;
  module: string;
  details: Record<string, unknown>;
  user: string;
}

const STORAGE_KEY = "vinavi_audit_log";

function getTimestamp(): string {
  return new Date().toISOString();
}

export function log(action: string, module: string, details: Record<string, unknown> = {}): void {
  const entry: LogEntry = {
    timestamp: getTimestamp(),
    action,
    module,
    details,
    user: "Dr. Session User", // placeholder — would come from auth in production
  };

  // Console output with styling
  console.log(
    `%c[VINAVI LOG] %c${action}%c — ${module}`,
    "color: #ef4444; font-weight: bold",
    "color: #f59e0b; font-weight: bold",
    "color: #94a3b8",
    details
  );

  // Persist to localStorage
  try {
    const existing: LogEntry[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    existing.push(entry);
    // Keep last 500 entries
    const trimmed = existing.slice(-500);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage may be unavailable in SSR
  }
}

export function getLogs(): LogEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function clearLogs(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // noop
  }
}
