import detectGlobalPackageManager from "../../utils/detectGlobalPackageManager";
import getGlobalInstalledVersion from "../../utils/getGlobalInstalledVersion";
import getLatestNpmVersion from "../../utils/getLatestNpmVersion";

async function isSameVersion(): Promise<[boolean, "yarn" | "npm" | "pnpm"]> {
  const pkg = "@eightshone/sshman";

  const manager = detectGlobalPackageManager();
  const installedVersion = getGlobalInstalledVersion(pkg, manager);
  const latestVersion = await getLatestNpmVersion(pkg);

  if (!installedVersion) return [false, manager];
  if (!latestVersion) return [true, manager]; // fallback if npm unavailable (useful in dev)

  return [installedVersion === latestVersion, manager];
}

export default isSameVersion;
