import { CONNECTION_REGEX } from "./consts";

function isConnectionString(connection: string) {
  return (
    CONNECTION_REGEX.test(connection) && !connection.startsWith("auto-save-")
  );
}

export default isConnectionString;
