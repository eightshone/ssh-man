import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { PackageManager } from "./types";

function detectGlobalPackageManager(): PackageManager {
  try {
    const filename = fileURLToPath(import.meta.url).toLowerCase();

    if (filename.includes(".bun")) return "bun";
    if (filename.includes(".pnpm") || filename.includes("pnpm")) return "pnpm";
    if (filename.includes("yarn") || filename.includes(".yarn")) return "yarn";
    if (filename.includes("node_modules")) return "npm";
  } catch {}

  // Fallback to original logic if path detection fails (e.g. dev mode or weird paths)
  try {
    execSync("bun --version", { stdio: "ignore" });
    return "bun";
  } catch {}

  try {
    execSync("pnpm --version", { stdio: "ignore" });
    return "pnpm";
  } catch {}

  try {
    execSync("yarn --version", { stdio: "ignore" });
    return "yarn";
  } catch {}

  return "npm";
}

export default detectGlobalPackageManager;
