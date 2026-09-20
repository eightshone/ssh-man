import { homedir, userInfo } from "os";
import password from "@inquirer/password";
import { nanoid } from "nanoid";
import { server } from "./types";
import { CONNECTION_REGEX } from "./consts";
import validateConfigValue from "./validateConfigValue";

export type parsedConnection = {
  server: server;
  password?: string;
};

async function parseConnectionString(
  connectionString: string,
  promptPassword: boolean
): Promise<parsedConnection> {
  const match = connectionString.match(CONNECTION_REGEX);

  if (!match) {
    throw new Error(
      "Invalid connection string format. Expected format: [username@]host[:port]"
    );
  }

  if (match[2]) {
    throw new Error(
      "Embedding a password in the connection string (user:password@host) is no longer supported, since it ends up in shell history and process listings. Use -p/--password to be prompted for it instead."
    );
  }

  const username = match[1] || userInfo().username;
  const host = match[3];
  const usePassword = promptPassword;

  if (validateConfigValue(username) !== true || validateConfigValue(host) !== true) {
    throw new Error("Invalid connection string format. Expected format: [username@]host[:port]");
  }

  const plainPassword = usePassword
    ? await password({ message: "Password:" })
    : undefined;

  const sshConfig: server = {
    id: nanoid(),
    name: `auto-save-${username}-${host}`,
    username,
    host,
    port: match[4] ? parseInt(match[4], 10) : 22,
    ...(usePassword
      ? { usePassword: true }
      : { usePassword: false, privateKey: `${homedir()}/.ssh/id_rsa` }),
  };

  return { server: sshConfig, password: plainPassword };
}

export default parseConnectionString;
