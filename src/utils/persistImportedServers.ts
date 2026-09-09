import { server, exportedServer } from "./types";
import { setServerPassword } from "./secret";

// moves each imported record's secret into the OS keyring, returning
// metadata-only servers safe for config.json
async function persistImportedServers(records: exportedServer[]): Promise<server[]> {
  const result: server[] = [];

  for (const record of records) {
    const { password, ...rest } = record;
    if (rest.usePassword && typeof password === "string") {
      await setServerPassword(rest.id, password);
    }
    result.push(rest);
  }

  return result;
}

export default persistImportedServers;
