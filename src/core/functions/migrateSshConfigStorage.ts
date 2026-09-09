import colors from "yoctocolors-cjs";
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
// the old full shape; a name collision leaves that one server untouched
// until resolved, so a later run picks it up.
async function migrateSshConfigStorage(configObj: config): Promise<config> {
  const hosts: Record<string, ManagedHost> = await readManagedHosts();

  const allServers = [...(configObj.servers || []), ...(configObj.recentServers || [])];
  const oldShapeById = new Map<string, any>();
  for (const srv of allServers) {
    if (srv && typeof srv.host === "string" && !oldShapeById.has(srv.id)) {
      oldShapeById.set(srv.id, srv);
    }
  }

  const conflictIds = new Set<string>();
  for (const srv of oldShapeById.values()) {
    const available = await checkAliasAvailable(srv.name);
    if (available) {
      hosts[srv.name] = {
        host: srv.host,
        port: srv.port,
        username: srv.username,
        ...(srv.usePassword === false ? { privateKey: srv.privateKey } : {}),
      };
    } else {
      conflictIds.add(srv.id);
    }
  }

  await writeManagedHosts(hosts);
  const { added } = await ensureSshConfigIncludes();

  const migratedCount = oldShapeById.size - conflictIds.size;
  if (migratedCount > 0 || added) {
    console.log(colors.cyan(`\nMigrated ${migratedCount} server(s) to ~/.ssh/config.`));
    if (added) {
      console.log(colors.dim(`Added an "Include" line for ~/.sshman/ssh_config to ~/.ssh/config.`));
    }
  }
  if (conflictIds.size > 0) {
    const names = [...oldShapeById.values()]
      .filter((s) => conflictIds.has(s.id))
      .map((s) => s.name);
    console.log(
      colors.yellow(
        `Warning: ${conflictIds.size} server name(s) already resolve to something in your existing ~/.ssh/config and were NOT migrated: ${names.join(", ")}`,
      ),
    );
    console.log(
      colors.yellow(`Rename these servers, or resolve the conflict in ~/.ssh/config, then restart sshman.`),
    );
  }
  if (migratedCount > 0 || added || conflictIds.size > 0) {
    console.log("");
  }

  // a conflicting server keeps its full data plus a `conflict: true` marker.
  // saveConfig() respects it, since shape alone can't tell "never migrated"
  // from "deliberately left alone" once hydrated.
  const slim = (list: any[]) =>
    (list || []).map((srv) => {
      if (typeof srv.host !== "string") return srv;
      if (conflictIds.has(srv.id)) return { ...srv, conflict: true };
      return { id: srv.id, name: srv.name, usePassword: srv.usePassword };
    });

  const migrated: config = {
    ...configObj,
    servers: slim(configObj.servers),
    recentServers: slim(configObj.recentServers),
  };

  // persist immediately, nothing else is guaranteed to save config.json
  // this run once the stored version catches up
  await saveFile(`${CONFIG_DIR}/config.json`, migrated);

  return migrated;
}

export default migrateSshConfigStorage;
