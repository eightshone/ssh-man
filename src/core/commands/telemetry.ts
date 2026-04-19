import colors from "yoctocolors-cjs";
import { existsSync, promises as fs } from "fs";
import {
  loadTelemetryConfig,
  saveTelemetryConfig,
} from "../telemetry/config";
import {
  TELEMETRY_CONFIG_FILE,
  TELEMETRY_EVENTS_FILE,
} from "../../utils/consts";

/**
 * Handles `sshman telemetry <action>` subcommands.
 * - enable:  opt into telemetry
 * - disable: opt out and clear pending events
 * - status:  show current telemetry status
 */
async function telemetryCommand(action: string) {
  const validActions = ["enable", "disable", "status"];

  if (!validActions.includes(action)) {
    console.log(
      colors.red(`Unknown action: "${action}"`),
    );
    console.log(
      colors.dim(`Valid actions: ${validActions.join(", ")}`),
    );
    return;
  }

  const config = await loadTelemetryConfig();

  switch (action) {
    case "enable": {
      config.enabled = true;
      await saveTelemetryConfig(config);
      console.log(colors.green("✓ Telemetry enabled."));
      console.log(
        colors.dim("  Anonymous usage data will be collected to help improve sshman."),
      );
      break;
    }

    case "disable": {
      config.enabled = false;
      await saveTelemetryConfig(config);

      // Clear any pending events
      if (existsSync(TELEMETRY_EVENTS_FILE)) {
        await fs.writeFile(TELEMETRY_EVENTS_FILE, "[]", "utf8");
      }

      console.log(colors.green("✓ Telemetry disabled."));
      console.log(
        colors.dim("  No data will be collected. Pending events have been cleared."),
      );
      break;
    }

    case "status": {
      console.log("");
      console.log(colors.cyan("📊 Telemetry Status"));
      console.log("");

      // Enabled state
      const stateLabel =
        config.enabled === true
          ? colors.green("Enabled")
          : config.enabled === false
            ? colors.red("Disabled")
            : colors.yellow("Not configured (first-run prompt pending)");
      console.log(`  Status:          ${stateLabel}`);

      // Installation ID (partially masked for display)
      const id = config.installationId;
      const maskedId = id
        ? `${id.slice(0, 8)}...${id.slice(-4)}`
        : colors.dim("none");
      console.log(`  Installation ID: ${colors.dim(maskedId)}`);

      // Pending events count
      let eventCount = 0;
      if (existsSync(TELEMETRY_EVENTS_FILE)) {
        try {
          const raw = await fs.readFile(TELEMETRY_EVENTS_FILE, "utf8");
          const events = JSON.parse(raw);
          eventCount = Array.isArray(events) ? events.length : 0;
        } catch {
          // Corrupt file
        }
      }
      console.log(`  Pending events:  ${colors.dim(String(eventCount))}`);

      // Last sync
      const lastSync = new Date(config.lastSyncTimestamp);
      const neverSynced = lastSync.getTime() === 0;
      const syncLabel = neverSynced
        ? colors.dim("never")
        : colors.dim(lastSync.toLocaleString());
      console.log(`  Last sync:       ${syncLabel}`);

      // Config file location
      console.log(
        `  Config file:     ${colors.dim(TELEMETRY_CONFIG_FILE)}`,
      );
      console.log("");
      break;
    }
  }
}

export default telemetryCommand;
