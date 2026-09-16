import { CONFIG_DIR } from "./consts";
import saveFile from "./saveFile";
import { writeManagedHosts, ManagedHost } from "./sshConfigFile";
import { config, server } from "./types";

function toManagedHost(srv: server): ManagedHost {
  return {
    host: srv.host,
    port: srv.port,
    username: srv.username,
    ...(srv.usePassword === false ? { privateKey: srv.privateKey } : {}),
  };
}

function slimServer(srv: server) {
  return { id: srv.id, name: srv.name, usePassword: srv.usePassword };
}

// a server flagged `conflict: true` (name collision, see
// migrateSshConfigStorage), or one with no host at all (never leave a
// blank Host block behind), is left alone: no Host block, no slimming,
// until it's fixed
function isConflicted(srv: any): boolean {
  return srv.conflict === true || !srv.host;
}

// the single write path for config.json: regenerates sshman's managed
// section of ~/.ssh/config from the full server list, then writes
// config.json with each
// non-conflicted server slimmed to {id, name, usePassword}
async function saveConfig(config: config): Promise<void> {
  const hosts: Record<string, ManagedHost> = {};
  // recentServers first, servers last, so the authoritative list wins on a
  // name clash
  for (const srv of [...config.recentServers, ...config.servers]) {
    if (isConflicted(srv)) continue;
    hosts[srv.name] = toManagedHost(srv);
  }
  await writeManagedHosts(hosts);

  const project = (srv: server) => (isConflicted(srv) ? srv : slimServer(srv));
  const slimConfig = {
    ...config,
    servers: config.servers.map(project),
    recentServers: config.recentServers.map(project),
  };
  await saveFile(`${CONFIG_DIR}/config.json`, slimConfig);
}

export default saveConfig;
