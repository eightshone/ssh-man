import findServer from "./findServer";
import isConnectionString from "./isConnectionString";
import parseConnectionString from "./parseConnectionString";
import { server } from "./types";

export type resolvedConnection = {
  sshConfig?: server;
  isNewConnection: boolean;
  error?: string;
};

// resolves a `<name>` or `<connection-string>` argument (as accepted by the
// `connect` and `mcp` commands) into a server config, without performing any
// I/O — callers decide how to surface the error case (check `sshConfig` for
// presence, and fall back to `error` when it's missing)
async function resolveConnection(
  creds: string,
  servers: server[],
  promptPassword: boolean,
): Promise<resolvedConnection> {
  const hasAt = creds.includes("@");

  if (hasAt) {
    if (isConnectionString(creds)) {
      return {
        isNewConnection: true,
        sshConfig: await parseConnectionString(creds, promptPassword),
      };
    }
    return { isNewConnection: false, error: "Invalid connection string format!" };
  }

  const sshConfig = findServer(servers, creds);
  if (sshConfig) {
    return { isNewConnection: false, sshConfig };
  }

  if (isConnectionString(creds)) {
    return {
      isNewConnection: true,
      sshConfig: await parseConnectionString(creds, promptPassword),
    };
  }

  return { isNewConnection: false, error: "Server config not found!" };
}

export default resolveConnection;
