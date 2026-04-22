/**
 * Telemetry endpoint — hardcoded at build time.
 *
 * During development, this value is set from the project's .env file.
 * The postbuild script (scripts/inject-telemetry-endpoint.js) replaces
 * the placeholder in the compiled JS with the actual endpoint URL.
 *
 * If no endpoint is configured, telemetry silently disables itself.
 */

// __TELEMETRY_ENDPOINT_PLACEHOLDER__ is replaced during build
export const TELEMETRY_ENDPOINT: string =
  "__TELEMETRY_ENDPOINT_PLACEHOLDER__";

// __TELEMETRY_API_KEY_PLACEHOLDER__ is replaced during build
export const TELEMETRY_API_KEY: string =
  "__TELEMETRY_API_KEY_PLACEHOLDER__";

import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

/**
 * Loads the .env file from the project root into process.env.
 * Only used during development when running the source code directly.
 */
function loadEnv() {
  const rootDir = join(dirname(fileURLToPath(import.meta.url)), "../../../");
  const envPath = join(rootDir, ".env");

  if (existsSync(envPath)) {
    try {
      const content = readFileSync(envPath, "utf8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const [key, ...valueParts] = trimmed.split("=");
        if (key && valueParts.length > 0) {
          const value = valueParts.join("=").trim().replace(/^["']|["']$/g, "");
          process.env[key.trim()] = value;
        }
      }
    } catch {
      // Ignore errors reading .env
    }
  }
}

/**
 * Returns the resolved telemetry endpoint, or undefined if not configured.
 * Checks both the hardcoded value and the system environment variable.
 */
export function getTelemetryEndpoint(): string | undefined {
  const isPlaceholder = TELEMETRY_ENDPOINT === "__TELEMETRY" + "_ENDPOINT_PLACEHOLDER__";
  
  if (isPlaceholder) {
    loadEnv();
  }

  // In dev mode, the placeholder is still present — fall back to env var
  const endpoint = isPlaceholder ? process.env.TELEMETRY_ENDPOINT : TELEMETRY_ENDPOINT;

  if (!endpoint || endpoint.trim().length === 0) {
    return undefined;
  }

  return endpoint.trim();
}

/**
 * Returns the resolved telemetry API key, or undefined if not configured.
 */
export function getTelemetryApiKey(): string | undefined {
  const isPlaceholder = TELEMETRY_API_KEY === "__TELEMETRY" + "_API_KEY_PLACEHOLDER__";

  if (isPlaceholder) {
    loadEnv();
  }

  const key = isPlaceholder ? process.env.TELEMETRY_API_KEY : TELEMETRY_API_KEY;

  if (!key || key.trim().length === 0) {
    return undefined;
  }

  return key.trim();
}
