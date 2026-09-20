import findServer from "./findServer";
import normalizeServerName from "./normalizeServerName";
import { server } from "./types";

// also relied on to keep imported server names safe to use as a literal
// `Host <name>` line in ~/.ssh/config
export const SERVER_NAME_PATTERN: RegExp = /^[a-zA-Z0-9 :_\-]*$/;

function validateServerName(
  serverName: string,
  servers: server[]
): boolean | string {
  // check for allowed characters
  if (!SERVER_NAME_PATTERN.test(serverName)) {
    return "The string contains invalid characters. (Note: dots are no longer allowed)";
  }

  // check if the string starts or ends with invalid characters
  const invalidStartOrEndPattern: RegExp = /^[ :_\-]|[ :_\-]$/;
  if (invalidStartOrEndPattern.test(serverName)) {
    return "The string cannot start or end with spaces, colons, dashes, or underscores.";
  }

  // check if server exists in the servers list
  if (findServer(servers, serverName)) {
    return `The name "${serverName}" (normalized as "${normalizeServerName(
      serverName
    )}") already exists`;
  }

  // if all validations pass
  return true;
}

export default validateServerName;
