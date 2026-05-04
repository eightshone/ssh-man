#!/usr/bin/env node

/**
 * Sync Worker — runs as a detached child process.
 *
 * This script is spawned by sync.ts and runs independently of the main
 * sshman process. It reads pending telemetry events, POSTs them to the
 * configured endpoint, and on success clears the events and updates the
 * last sync timestamp.
 *
 * Usage: node syncWorker.js <endpoint> <installationId> <version> <apiKey>
 */

import { existsSync, promises as fs } from "fs";
import { request as httpsRequest } from "https";
import { request as httpRequest } from "http";
import {
  TELEMETRY_CONFIG_FILE,
  TELEMETRY_EVENTS_FILE,
  TELEMETRY_LOG_FILE,
  CONFIG_DIR,
} from "../../utils/consts";
import type { TelemetryEvent } from "./events";

const [endpoint, installationId, version, apiKey] = process.argv.slice(2);

if (!endpoint || !installationId) {
  process.exit(1);
}

async function isDebugEnabled(): Promise<boolean> {
  const configFile = `${CONFIG_DIR}/config.json`;
  if (existsSync(configFile)) {
    try {
      const configRaw = await fs.readFile(configFile, "utf8");
      const configObj = JSON.parse(configRaw);
      return configObj.debug === true;
    } catch {
      return false;
    }
  }
  return false;
}

async function logDebug(message: string): Promise<void> {
  if (!(await isDebugEnabled())) return;
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] Sync Worker DEBUG: ${message}\n`;
  try {
    await fs.appendFile(TELEMETRY_LOG_FILE, logEntry, "utf8");
  } catch {}
}

async function sync(): Promise<void> {
  // Read pending events
  if (!existsSync(TELEMETRY_EVENTS_FILE)) {
    process.exit(0);
  }

  const raw = await fs.readFile(TELEMETRY_EVENTS_FILE, "utf8");
  const events: TelemetryEvent[] = JSON.parse(raw);

  if (!Array.isArray(events) || events.length === 0) {
    process.exit(0);
  }

  // Build the payload — contains only the anonymous ID, version, and sanitized events
  const payload = JSON.stringify({
    installationId,
    version: version || "unknown",
    events,
  });

  await logDebug(`Attempting telemetry sync to ${endpoint} with ${events.length} events...`);

  // Send the data to the telemetry server
  await postData(endpoint, payload);

  await logDebug("Telemetry sync succeeded.");

  // Success — clear events and update last sync timestamp
  await fs.writeFile(TELEMETRY_EVENTS_FILE, "[]", "utf8");

  // Update the lastSyncTimestamp in the telemetry config
  if (existsSync(TELEMETRY_CONFIG_FILE)) {
    const configRaw = await fs.readFile(TELEMETRY_CONFIG_FILE, "utf8");
    const config = JSON.parse(configRaw);
    config.lastSyncTimestamp = new Date().toISOString();
    await fs.writeFile(
      TELEMETRY_CONFIG_FILE,
      JSON.stringify(config, null, 2),
      "utf8",
    );
  }
}

/**
 * POSTs JSON data to the given URL using built-in http/https modules.
 * Returns a promise that resolves on 2xx, rejects on errors.
 */
function postData(url: string, data: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === "https:";
    const requestFn = isHttps ? httpsRequest : httpRequest;

    const req = requestFn(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
      },
      (res) => {
        let responseBody = "";
        res.on("data", (chunk) => {
          responseBody += chunk;
        });

        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            reject(new Error(`HTTP ${res.statusCode} from ${url}: ${responseBody || "Unknown error"}`));
          }
        });
      },
    );

    req.on("error", (err) => {
      reject(new Error(`Failed to request ${url}: ${err.message}`));
    });

    // Set a 30-second timeout to avoid hanging indefinitely
    req.setTimeout(30_000, () => {
      req.destroy(new Error(`Request timeout to ${url}`));
    });

    req.write(data);
    req.end();
  });
}

if (!endpoint || !installationId) {
  logError(new Error("Missing required arguments: endpoint or installationId")).then(
    () => process.exit(1),
  );
} else {
  // Run and log any error before exiting
  sync().catch(async (error) => {
    await logError(error);
    process.exit(1);
  });
}

/**
 * Logs an error to the telemetry log file.
 */
async function logError(error: any): Promise<void> {
  if (!(await isDebugEnabled())) return;
  
  const timestamp = new Date().toISOString();
  const message =
    error instanceof Error ? error.stack || error.message : String(error);
  const logEntry = `[${timestamp}] Sync Worker Error: ${message}\n`;

  try {
    await fs.appendFile(TELEMETRY_LOG_FILE, logEntry, "utf8");
  } catch {
    // If we can't write to the log file, there's nothing else we can do
  }
}
