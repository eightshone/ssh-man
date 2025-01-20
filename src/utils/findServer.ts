import { server } from "./types";

function findServer(servers: server[] = [], name: string) {
  return servers.find(
    (srvr) => normalizeServerName(srvr.name) === normalizeServerName(name)
  );
}

export default findServer;
