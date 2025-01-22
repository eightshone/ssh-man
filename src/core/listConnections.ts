import { menu } from "../utils/types";

async function listConnections(): Promise<[menu]> {
  return ["main"];
}

export default listConnections;
