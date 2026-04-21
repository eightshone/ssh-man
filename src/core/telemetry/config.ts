import { existsSync, promises as fs } from "fs";
import { randomUUID } from "crypto";
import { dirname } from "path";
import { TELEMETRY_CONFIG_FILE } from "../../utils/consts";

export type TelemetryConfig = {
  enabled: boolean | null; // null = user hasn't been prompted yet
  installationId: string; // anonymous UUIDv4
  lastSyncTimestamp: string; // ISO 8601
};

const DEFAULT_TELEMETRY_CONFIG: TelemetryConfig = {
  enabled: null,
  installationId: "",
  lastSyncTimestamp: new Date(0).toISOString(),
};

/**
 * Loads or creates the telemetry config file.
 * Generates a random UUIDv4 installation ID on first run.
 */
export async function loadTelemetryConfig(): Promise<TelemetryConfig> {
  try {
    if (existsSync(TELEMETRY_CONFIG_FILE)) {
      const raw = await fs.readFile(TELEMETRY_CONFIG_FILE, "utf8");
      const parsed = JSON.parse(raw) as Partial<TelemetryConfig>;
      return {
        ...DEFAULT_TELEMETRY_CONFIG,
        ...parsed,
      };
    }
  } catch {
    // Corrupt file — fall through to create a fresh one
  }

  // First run: generate a new anonymous installation ID
  const config: TelemetryConfig = {
    ...DEFAULT_TELEMETRY_CONFIG,
    installationId: randomUUID(),
  };

  await saveTelemetryConfig(config);
  return config;
}

/**
 * Persists the telemetry config to disk.
 */
export async function saveTelemetryConfig(
  config: TelemetryConfig,
): Promise<void> {
  try {
    await fs.mkdir(dirname(TELEMETRY_CONFIG_FILE), { recursive: true });
    await fs.writeFile(
      TELEMETRY_CONFIG_FILE,
      JSON.stringify(config, null, 2),
      "utf8",
    );
  } catch {
    // Silently fail — telemetry should never break the main app
  }
}
