import { existsSync, promises as fs } from "fs";
import { dirname, join } from "path";
import { randomBytes } from "crypto";
import { TELEMETRY_EVENTS_FILE } from "../../utils/consts";
import { VERSION } from "../../utils/consts";

export type TelemetryEvent = {
  timestamp: string;
  command: string;
  durationMs: number;
  success: boolean;
  errorType?: string;
  os: string;
  arch: string;
  nodeVersion: string;
  appVersion: string;
};

/**
 * Appends a telemetry event to the local events file.
 * Uses atomic write (temp file + rename) to avoid corruption.
 * No PII is included — only command name, timing, and system info.
 */
export async function logTelemetryEvent(
  event: TelemetryEvent,
): Promise<void> {
  try {
    let events: TelemetryEvent[] = [];

    // Read existing events
    if (existsSync(TELEMETRY_EVENTS_FILE)) {
      const raw = await fs.readFile(TELEMETRY_EVENTS_FILE, "utf8");
      events = JSON.parse(raw);
    }

    events.push(event);

    // Atomic write: write to temp file, then rename
    const dir = dirname(TELEMETRY_EVENTS_FILE);
    await fs.mkdir(dir, { recursive: true });
    const tmpFile = join(dir, `.telemetry-events-${randomBytes(4).toString("hex")}.tmp`);
    await fs.writeFile(tmpFile, JSON.stringify(events, null, 2), "utf8");
    await fs.rename(tmpFile, TELEMETRY_EVENTS_FILE);
  } catch {
    // Silently fail — never disrupt the user's workflow
  }
}

/**
 * Creates a telemetry event object with system info pre-filled.
 * Strips all PII — only the command name (no arguments) is recorded.
 */
export function createEvent(
  command: string,
  durationMs: number,
  success: boolean,
  errorType?: string,
): TelemetryEvent {
  return {
    timestamp: new Date().toISOString(),
    command,
    durationMs: Math.round(durationMs),
    success,
    // Only record the error code/class — never the full message (may contain PII)
    ...(errorType ? { errorType: sanitizeErrorType(errorType) } : {}),
    os: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    appVersion: VERSION,
  };
}

/**
 * Strips potentially sensitive info from error types.
 * Only keeps the error code or class name.
 */
function sanitizeErrorType(errorType: string): string {
  // Keep only alphanumeric, underscores, and dots (e.g. "ECONNREFUSED", "ERR_SOCKET_TIMEOUT")
  const sanitized = errorType.replace(/[^a-zA-Z0-9_.]/g, "");
  // Truncate to prevent accidentally long values
  return sanitized.slice(0, 64);
}
