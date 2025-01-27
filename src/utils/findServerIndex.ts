import orderJSONFieldsByName from "./orderJSONFieldsByName";
import { server } from "./types";

function findServerIndex(servers: server[], server: server) {
  // this will check servers regardless of their names, just their configs
  return servers.findIndex(
    (currentServer) =>
      JSON.stringify(
        orderJSONFieldsByName({ ...currentServer, name: "", id: null })
      ) ===
      JSON.stringify(orderJSONFieldsByName({ ...server, name: "", id: null }))
  );
}

export default findServerIndex;
