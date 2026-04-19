/**
 * Build script: injects the TELEMETRY_ENDPOINT from .env into the compiled JS.
 *
 * Reads the project's .env file, extracts the TELEMETRY_ENDPOINT value, and
 * replaces the placeholder string in the compiled dist output. This ensures the
 * endpoint URL is hardcoded in the build and not loaded at runtime.
 *
 * Run as part of the postbuild step.
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ENV_FILE = path.resolve(__dirname, "../.env");
const TARGET_FILE = path.resolve(
  __dirname,
  "../dist/src/core/telemetry/env.js",
);
const PLACEHOLDER = "__TELEMETRY_ENDPOINT_PLACEHOLDER__";

async function injectEndpoint() {
  // Read the .env file
  let endpoint = "";
  let apiKey = "";
  try {
    const envContent = await fs.readFile(ENV_FILE, "utf8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      // Skip comments and blank lines
      if (!trimmed || trimmed.startsWith("#")) continue;

      const endpointMatch = trimmed.match(/^TELEMETRY_ENDPOINT\s*=\s*(.*)$/);
      if (endpointMatch) {
        endpoint = endpointMatch[1].trim().replace(/^["']|["']$/g, "");
      }

      const apiKeyMatch = trimmed.match(/^TELEMETRY_API_KEY\s*=\s*(.*)$/);
      if (apiKeyMatch) {
        apiKey = apiKeyMatch[1].trim().replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    console.log(
      "No .env file found — telemetry config will remain as placeholders.",
    );
    return;
  }

  // Replace the placeholders in the compiled JS
  try {
    let content = await fs.readFile(TARGET_FILE, "utf8");
    let changed = false;

    if (endpoint) {
      const updated = content.replaceAll(
        "__TELEMETRY_ENDPOINT_PLACEHOLDER__",
        endpoint,
      );
      if (updated !== content) {
        content = updated;
        changed = true;
      }
    }

    if (apiKey) {
      const updated = content.replaceAll(
        "__TELEMETRY_API_KEY_PLACEHOLDER__",
        apiKey,
      );
      if (updated !== content) {
        content = updated;
        changed = true;
      }
    }

    if (!changed) {
      console.log(
        "Warning: No placeholders replaced. Was env.ts compiled?",
      );
      return;
    }

    await fs.writeFile(TARGET_FILE, content, "utf8");
    console.log(
      `Telemetry config injected successfully (Endpoint: ${endpoint ? "set" : "empty"}, API Key: ${apiKey ? "set" : "empty"})`,
    );
  } catch (err) {
    console.error("Error injecting telemetry config:", err);
  }
}

injectEndpoint();
