import { spawn } from "child_process";
import { existsSync, promises as fs } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import {
  TELEMETRY_EVENTS_FILE,
  TELEMETRY_SYNC_INTERVAL_MS,
  VERSION,
} from "../../utils/consts";
import { TelemetryConfig } from "./config";

/**
 * Checks if a sync is due (>24h since last sync) and if there are events to send.
 * If so, spawns a **detached child process** to handle the upload.
 *
 * The detached process runs independently — the main sshman process exits
 * immediately without waiting. This ensures telemetry never slows down
 * the user's primary tasks.
 */
export async function attemptSync(
  config: TelemetryConfig,
  endpoint: string,
  apiKey?: string,
): Promise<void> {
  try {
    // Check if 24 hours have elapsed since last sync
    const lastSync = new Date(config.lastSyncTimestamp).getTime();
    const now = Date.now();

    if (now - lastSync < TELEMETRY_SYNC_INTERVAL_MS) {
      return; // Not time to sync yet
    }

    // Check if there are any events to send
    if (!existsSync(TELEMETRY_EVENTS_FILE)) {
      return;
    }

    const raw = await fs.readFile(TELEMETRY_EVENTS_FILE, "utf8");
    const events = JSON.parse(raw);
    if (!Array.isArray(events) || events.length === 0) {
      return;
    }

    // Resolve the sync worker script path
    // In dev (tsx): resolve from TypeScript source
    // In prod (compiled JS): resolve from the same directory
    const currentDir = dirname(fileURLToPath(import.meta.url));
    let workerPath = join(currentDir, "syncWorker.js");

    // If the JS file doesn't exist, we might be in dev mode — try .ts with tsx
    if (!existsSync(workerPath)) {
      workerPath = join(currentDir, "syncWorker.ts");
    }

    // Spawn a detached child process for the sync.
    // - detached: true — runs independently of the parent
    // - stdio: 'ignore' — no I/O connection to parent
    // - unref() — allows parent to exit without waiting
    const child = spawn(
      process.execPath,
      [
        // Use tsx loader in dev, plain node in production
        ...(workerPath.endsWith(".ts") ? ["--import", "tsx"] : []),
        workerPath,
        endpoint,
        config.installationId,
        VERSION,
        apiKey || "",
      ],
      {
        detached: true,
        stdio: "ignore",
        env: { ...process.env },
      },
    );

    child.unref(); // Let the parent process exit immediately
  } catch {
    // Silently fail — sync will be retried on next invocation
  }
}
