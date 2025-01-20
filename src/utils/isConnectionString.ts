import { CONNECTION_REGEX } from "./consts";

function isConnectionString(connection: string) {
  return CONNECTION_REGEX.test(connection);
}

export default isConnectionString;
