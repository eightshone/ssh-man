import { config, server } from "../../utils/types";
import { setServerPassword } from "../../utils/secret";

// one-time migration from the legacy encrypted config.json to the OS
// keyring, see init.ts
async function migrateServerList(servers: any[]): Promise<server[]> {
  const result: server[] = [];
  for (const srv of servers) {
    if (srv.usePassword && typeof srv.password === "string") {
      await setServerPassword(srv.id, srv.password);
    }
    const { password, ...rest } = srv;
    result.push(rest as server);
  }
  return result;
}

async function migrateSecretsToKeyring(configObj: config): Promise<config> {
  return {
    ...configObj,
    servers: await migrateServerList(configObj.servers || []),
    recentServers: await migrateServerList(configObj.recentServers || []),
  };
}

export default migrateSecretsToKeyring;
