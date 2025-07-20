import { execSync } from "child_process";

function detectGlobalPackageManager(): "npm" | "yarn" | "pnpm" {
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
