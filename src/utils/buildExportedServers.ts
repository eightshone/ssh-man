import { server, exportedServer } from "./types";
import { getServerPassword } from "./secret";

// pulls each password-auth server's secret from the OS keyring so it can be
// bundled into the export file
async function buildExportedServers(servers: server[]): Promise<exportedServer[]> {
  const result: exportedServer[] = [];

  for (const srv of servers) {
    if (!srv.usePassword) {
      result.push({ ...srv });
      continue;
    }

    const lookup = await getServerPassword(srv.id);
    if (!lookup.ok || lookup.password === null) {
      console.warn(
        `Skipping "${srv.name}": its password could not be read from the OS keyring.`,
      );
      continue;
    }

    result.push({ ...srv, password: lookup.password });
  }

  return result;
}

export default buildExportedServers;
