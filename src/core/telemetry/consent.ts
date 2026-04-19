import confirm from "@inquirer/confirm";
import colors from "yoctocolors-cjs";
import { TelemetryConfig, saveTelemetryConfig } from "./config";

/**
 * Prompts the user for telemetry consent on first run.
 * Only triggers when config.enabled is null (never prompted before).
 * Saves the user's choice and returns the updated config.
 */
export async function promptTelemetryConsent(
  config: TelemetryConfig,
): Promise<TelemetryConfig> {
  // Already prompted — skip
  if (config.enabled !== null) {
    return config;
  }

  console.log("");
  console.log(
    colors.cyan("📊 Help improve sshman!"),
  );
  console.log(
    colors.dim(
      "   We'd like to collect anonymous usage data (commands used, error rates,"),
  );
  console.log(
    colors.dim(
      "   OS/architecture) to help improve the tool. No personal information"),
  );
  console.log(
    colors.dim(
      "   (IPs, hostnames, usernames, keys, paths) is ever collected."),
  );
  console.log(
    colors.dim(
      "   You can change this anytime with: sshman telemetry disable"),
  );
  console.log("");

  try {
    const answer = await confirm({
      message: "Would you like to enable anonymous telemetry?",
      default: false,
    });

    config.enabled = answer;
  } catch {
    // User cancelled (Ctrl+C) — default to disabled
    config.enabled = false;
  }

  await saveTelemetryConfig(config);

  if (config.enabled) {
    console.log(colors.green("✓ Telemetry enabled. Thank you!"));
  } else {
    console.log(colors.dim("✓ Telemetry disabled. No data will be collected."));
  }
  console.log("");

  return config;
}
