import { execSync } from "child_process";
import { PackageManager } from "./types";

function detectGlobalPackageManager(): PackageManager {
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
