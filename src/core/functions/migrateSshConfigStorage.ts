import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { Spinner } from "yocto-spinner";
import colors from "yoctocolors-cjs";
import confirm from "@inquirer/confirm";
import { nanoid } from "nanoid";
import { CONFIG_DIR } from "../../utils/consts";
import { config } from "../../utils/types";
import saveFile from "../../utils/saveFile";
import {
  ManagedHost,
  readManagedHosts,
  writeManagedHosts,
  checkAliasAvailable,
} from "../../utils/sshConfigFile";

function findAvailableBackupPath(basePath: string): string {
  if (!existsSync(basePath)) return basePath;
  let suffix = 2;
  while (existsSync(`${basePath}-${suffix}`)) suffix++;
  return `${basePath}-${suffix}`;
}

// one-time, self-healing migration: moves host/port/username/privateKey out
// of config.json and into ~/.ssh/config. Runs whenever a server is still in
// the old full shape. A server that can't be migrated (name collision,
// duplicate name, or no host set) is left untouched until resolved, so a
// later run picks it up.
async function migrateSshConfigStorage(configObj: config, spinner?: Spinner): Promise<config> {
  // the spinner keeps redrawing its own line while we print or prompt below,
  // which garbles both; stop it for the duration and resume after
  const spinnerWasSpinning = !!spinner?.isSpinning;
  if (spinnerWasSpinning) spinner!.stop();

  const hosts: Record<string, ManagedHost> = await readManagedHosts();

  // every full-shape server gets its own slot here, tracked by array
  // position rather than `srv.id`: some real config.json files have
  // servers with a missing or duplicate id (harmless under the old
  // architecture, since every field lived inline), and keying by id would
  // silently drop all but one of them
  const candidates: any[] = [];
  const seenIds = new Set<string>();
  for (const srv of configObj.servers || []) {
    if (!srv) continue;
    // backfill a missing id (old data from before ids were required) so
    // keyring/password lookups work correctly going forward
    if (!srv.id) srv.id = nanoid();
    if (typeof srv.host === "string") candidates.push(srv);
    seenIds.add(srv.id);
  }
  for (const srv of configObj.recentServers || []) {
    if (srv && typeof srv.host === "string" && srv.id && !seenIds.has(srv.id)) {
      candidates.push(srv);
      seenIds.add(srv.id);
    }
  }

  // tracks which alias names are already spoken for in this batch (for the
  // duplicate-name check below); separate from `migratedRefs`, since two
  // different server objects can share a name and only one of them should
  // ever be treated as successfully migrated
  const claimedNames = new Set<string>();
  const migratedRefs = new Set<any>();
  const missingHostNames: string[] = [];
  const conflictNames: string[] = [];

  for (const srv of candidates) {
    if (!srv.host) {
      missingHostNames.push(srv.name);
      continue;
    }
    if (claimedNames.has(srv.name)) {
      // a sibling server already claimed this exact name in this run
      conflictNames.push(srv.name);
      continue;
    }
    const available = await checkAliasAvailable(srv.name);
    if (!available) {
      conflictNames.push(srv.name);
      continue;
    }
    hosts[srv.name] = {
      host: srv.host,
      port: srv.port || 22,
      username: srv.username,
      ...(srv.usePassword === false ? { privateKey: srv.privateKey } : {}),
    };
    claimedNames.add(srv.name);
    migratedRefs.add(srv);
  }

  await writeManagedHosts(hosts);

  if (migratedRefs.size > 0) {
    console.log(colors.cyan(`\nMigrated ${migratedRefs.size} server(s) to ~/.ssh/config.`));
  }
  if (conflictNames.length > 0) {
    console.log(
      colors.yellow(
        `Warning: ${conflictNames.length} server name(s) already resolve to something in your existing ~/.ssh/config and were NOT migrated: ${conflictNames.join(", ")}`,
      ),
    );
    console.log(colors.yellow(`Rename these servers, or resolve the conflict in ~/.ssh/config, then restart sshman.`));
  }
  if (missingHostNames.length > 0) {
    console.log(
      colors.yellow(
        `Warning: ${missingHostNames.length} server(s) have no host set and were NOT migrated: ${missingHostNames.join(", ")}`,
      ),
    );
    console.log(colors.yellow(`Edit these servers in sshman to set a host, then restart sshman.`));
  }
  if (migratedRefs.size > 0 || conflictNames.length > 0 || missingHostNames.length > 0) {
    console.log("");
  }

  // a server that wasn't migrated keeps its full data plus a
  // `conflict: true` marker, so saveConfig() leaves it alone too: shape
  // alone can't tell "never migrated" from "deliberately left alone" once
  // servers are hydrated
  const slim = (list: any[]) =>
    (list || []).map((srv) => {
      if (typeof srv.host !== "string") return srv;
      if (migratedRefs.has(srv)) {
        return { id: srv.id, name: srv.name, usePassword: srv.usePassword };
      }
      return { ...srv, conflict: true };
    });

  const migrated: config = {
    ...configObj,
    servers: slim(configObj.servers),
    recentServers: slim(configObj.recentServers),
  };

  // offer a backup of the pre-migration config.json, in case a bug in this
  // step loses data. Declined by default: it's a plaintext copy of every
  // saved host/username, so it shouldn't be left lying around. Only asked
  // when this run actually moved something - a run that only re-reports
  // leftover conflicts/missing-hosts has nothing new to back up, and asking
  // every startup for those is exactly the noise this is meant to avoid.
  const configFile = `${CONFIG_DIR}/config.json`;
  if (migratedRefs.size > 0 && existsSync(configFile)) {
    const raw = await readFile(configFile, "utf8");
    const keepBackup = await confirm({
      message:
        "Keep a backup copy of your old config.json before migrating? It's stored unencrypted, so this isn't safe to leave around - only keep it if you need to double check the migration, and delete it as soon as you're done.",
      default: false,
    });
    if (keepBackup) {
      const backupFile = findAvailableBackupPath(`${configFile}.pre-ssh-config-migration-backup`);
      await saveFile(backupFile, raw);
      console.log(
        colors.yellow(
          `Backup saved to ${backupFile}. This file is unencrypted, delete it as soon as possible.`,
        ),
      );
    }
  }

  await saveFile(configFile, migrated);

  if (spinnerWasSpinning) spinner!.start();

  return migrated;
}

export default migrateSshConfigStorage;
