import { execSync } from "child_process";
import { PackageManager } from "./types";

function getGlobalInstalledVersion(
  pkg: string,
  manager: PackageManager
): string | null {
  try {
    let cmd = "";
    switch (manager) {
      case "bun":
        cmd = `bun pm ls -g`;
        const bunOutput = execSync(cmd, {
          stdio: ["pipe", "pipe", "ignore"],
        }).toString();
        const bunMatch = bunOutput.match(
          new RegExp(`${pkg.replace(/\//g, "\\/")}@([\\d.]+)`)
        );
        return bunMatch?.[1] || null;
      case "pnpm":
        cmd = `pnpm ls -g ${pkg} --json`;
        break;
      case "yarn":
        cmd = `yarn global list --json`;
        const output = execSync(cmd, {
          stdio: ["pipe", "pipe", "ignore"], // stdin, stdout, stderr => ignore any warnings that could be printed to the terminal
        }).toString();
        const lines = output.split("\n");
        for (const line of lines) {
          const json = JSON.parse(line);
          if (json.type === "info" && json.data.includes(pkg)) {
            const match = json.data.match(/@eightshone\/sshman@([\d.]+)/);
            return match?.[1] || null;
          }
        }
        return null;
      default:
        cmd = `npm ls -g ${pkg} --json`;
        break;
    }

    const jsonOutput = execSync(cmd, {
      stdio: ["pipe", "pipe", "ignore"],
    }).toString();

    const parsed = JSON.parse(jsonOutput);
    return parsed.dependencies?.[pkg]?.version || null;
  } catch {
    return null;
  }
}

export default getGlobalInstalledVersion;
