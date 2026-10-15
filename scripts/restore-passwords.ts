// one-off recovery: copies passwords from an old plain-JSON config backup
// into the OS keyring for every current password server that has none.
// Matches by id, then name, then username@host:port. Never overwrites.
//
//   yarn tsx scripts/restore-passwords.ts [backupFile] [--dry-run]
import { readFileSync } from "fs";
import { CONFIG_DIR } from "../src/utils/consts";
import { readManagedHosts, hydrateServer } from "../src/utils/sshConfigFile";
import { isKeyringAvailable, getServerPassword, setServerPassword } from "../src/utils/secret";

const dryRun = process.argv.includes("--dry-run");
const backupFile =
  process.argv.slice(2).find((a) => !a.startsWith("--")) ?? `${CONFIG_DIR}/config.json.backup`;

async function main() {
  if (!dryRun && !(await isKeyringAvailable())) {
    console.error("OS keyring unavailable, nothing would survive a restart. Fix the keyring first.");
    process.exit(1);
  }

  const readServers = (file: string): any[] => {
    const cfg = JSON.parse(readFileSync(file, "utf8"));
    return [...(cfg.servers ?? []), ...(cfg.recentServers ?? [])];
  };

  const backup = readServers(backupFile).filter((s) => s.usePassword && typeof s.password === "string" && s.password);
  const hosts = await readManagedHosts();
  const current = readServers(`${CONFIG_DIR}/config.json`).map((s) => hydrateServer(s, hosts));
  const addr = (s: any) => `${s.username}@${s.host}:${s.port ?? 22}`;

  const seen = new Set<string>();
  const counts = { restored: 0, alreadySet: 0, noMatch: 0 };
  for (const srv of current) {
    if (srv.usePassword !== true || seen.has(srv.id)) continue;
    seen.add(srv.id);

    const existing = await getServerPassword(srv.id);
    if (existing.ok && existing.password) {
      counts.alreadySet++;
      continue;
    }

    const match =
      backup.find((b) => b.id === srv.id) ??
      backup.find((b) => b.name === srv.name) ??
      backup.find((b) => b.host && addr(b) === addr(srv));
    if (!match) {
      console.log(`no match    ${srv.name} (${addr(srv)})`);
      counts.noMatch++;
      continue;
    }

    if (!dryRun && !(await setServerPassword(srv.id, match.password))) {
      console.log(`FAILED      ${srv.name}`);
      continue;
    }
    console.log(`${dryRun ? "would set" : "restored"}   ${srv.name}  <- backup "${match.name}"`);
    counts.restored++;
  }

  console.log(counts);
}

main();
