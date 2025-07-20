import { execSync } from "child_process";

function getGlobalInstalledVersion(
  pkg: string,
  manager: string
): string | null {
  try {
    let cmd = "";
    switch (manager) {
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
