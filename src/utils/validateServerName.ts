import findServer from "./findServer";
import normalizeServerName from "./normalizeServerName";
import { server } from "./types";

function validateServerName(
  serverName: string,
  servers: server[]
): boolean | string {
  // regex for allowed characters
  const allowedPattern: RegExp = /^[a-zA-Z0-9 :_\-]*$/;

  // check for allowed characters
  if (!allowedPattern.test(serverName)) {
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
