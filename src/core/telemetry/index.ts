/**
 * Telemetry Public API
 *
 * All telemetry interactions from the rest of the app go through here.
 * Every function is a safe no-op if telemetry is disabled or misconfigured.
 */

import { TelemetryConfig, loadTelemetryConfig } from "./config";
import { promptTelemetryConsent } from "./consent";
import { createEvent, logTelemetryEvent } from "./events";
import { getTelemetryEndpoint } from "./env";
import { attemptSync } from "./sync";

export type TelemetryContext = {
  config: TelemetryConfig;
  endpoint: string | undefined;
  apiKey: string | undefined;
  /** Whether telemetry is fully active (user opted in + endpoint configured) */
  active: boolean;
};

import { getTelemetryApiKey } from "./env";

/**
 * Initializes the telemetry system.
 * - Resolves the endpoint (hardcoded at build time or from env)
 * - Loads/creates the telemetry config
 * - Prompts for consent on first run (only if endpoint is available)
 *
 * Returns a TelemetryContext used by other telemetry functions.
 */
export async function initTelemetry(
  skipConsent: boolean = false,
): Promise<TelemetryContext> {
  try {
    let config = await loadTelemetryConfig();

    // Always show the first-run consent prompt, regardless of endpoint.
    // This ensures the user's preference is captured on first launch.
    if (!skipConsent) {
      config = await promptTelemetryConsent(config);
    }

    const endpoint = getTelemetryEndpoint();
    const apiKey = getTelemetryApiKey();

    // Telemetry is active only if user opted in AND an endpoint is configured
    const active = config.enabled === true && !!endpoint;
    return { config, endpoint, apiKey, active };
  } catch {
    // If anything goes wrong, return a disabled context
    return {
      config: {
        enabled: false,
        installationId: "",
        lastSyncTimestamp: new Date(0).toISOString(),
      },
      endpoint: undefined,
      apiKey: undefined,
      active: false,
    };
  }
}

/**
 * Records a command execution event.
 * No-op if telemetry is not active.
 */
export async function recordCommandEvent(
  ctx: TelemetryContext,
  command: string,
  durationMs: number,
  success: boolean,
  errorType?: string,
): Promise<void> {
  if (!ctx.active) return;

  try {
    const event = createEvent(command, durationMs, success, errorType);
    await logTelemetryEvent(event);
  } catch {
    // Silently fail
  }
}

/**
 * Attempts a background sync if conditions are met (>24h since last sync).
 * Spawns a detached process that runs independently.
 * No-op if telemetry is not active.
 */
export async function trySync(ctx: TelemetryContext): Promise<void> {
  if (!ctx.active || !ctx.endpoint) return;

  try {
    await attemptSync(ctx.config, ctx.endpoint, ctx.apiKey);
  } catch {
    // Silently fail
  }
}
