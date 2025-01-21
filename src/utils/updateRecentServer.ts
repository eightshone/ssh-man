import findServerIndex from "./findServerIndex";
import { server } from "./types";

function updateRecentServers(servers: server[], newServer: server): server[] {
  // check if the newServer exists in the servers array
  const index = findServerIndex(servers, newServer);
  const selectedServer = index === -1 ? newServer : servers[index];

  if (index !== -1) {
    // if the newServer exists, remove it from its current position
    servers.splice(index, 1);
  } else if (servers.length === 3) {
    // if the newServer does not exist, remove the last item
    servers.pop();
  }

  // add the newServer to the beginning of the servers array
  servers.unshift(selectedServer);

  return servers;
}

export default updateRecentServers;
