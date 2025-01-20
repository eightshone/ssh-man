import { server } from "./types";
import normalizeServerName from "./normalizeServerName";

function findServer(servers: server[] = [], name: string): server | undefined {
  return servers.find(
    (srvr) => normalizeServerName(srvr.name) === normalizeServerName(name)
  );
}

export default findServer;
