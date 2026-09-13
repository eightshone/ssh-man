import { existsSync } from "fs";
import { readFile } from "fs/promises";
import colors from "yoctocolors-cjs";
import { nanoid } from "nanoid";
import { CONFIG_DIR } from "../../utils/consts";
import { config } from "../../utils/types";
import saveFile from "../../utils/saveFile";
import {
  ManagedHost,
  readManagedHosts,
  writeManagedHosts,
  ensureSshConfigIncludes,
  checkAliasAvailable,
} from "../../utils/sshConfigFile";

// one-time, self-healing migration: moves host/port/username/privateKey out
// of config.json and into ~/.ssh/config. Runs whenever a server is still in
// the old full shape. A server that can't be migrated (name collision,
// duplicate name, or no host set) is left untouched until resolved, so a
// later run picks it up.
async function migrateSshConfigStorage(configObj: config): Promise<config> {
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
  const { added } = await ensureSshConfigIncludes();

  if (migratedRefs.size > 0 || added) {
    console.log(colors.cyan(`\nMigrated ${migratedRefs.size} server(s) to ~/.ssh/config.`));
    if (added) {
      console.log(colors.dim(`Added an "Include" line for ~/.sshman/ssh_config to ~/.ssh/config.`));
    }
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
  if (migratedRefs.size > 0 || added || conflictNames.length > 0 || missingHostNames.length > 0) {
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

  // back up the pre-migration config.json once, so a bug in this step is
  // always recoverable
  const configFile = `${CONFIG_DIR}/config.json`;
  const backupFile = `${configFile}.pre-ssh-config-migration-backup`;
  if (existsSync(configFile) && !existsSync(backupFile)) {
    const raw = await readFile(configFile, "utf8");
    await saveFile(backupFile, raw);
  }

  await saveFile(configFile, migrated);

  return migrated;
}

export default migrateSshConfigStorage;
