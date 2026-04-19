import { homedir, userInfo } from "os";
import colors from "yoctocolors-cjs";
import password from "@inquirer/password";
import { server } from "./types";
import { CONNECTION_REGEX } from "./consts";

async function parseConnectionString(
  connectionString: string,
  promptPassword: boolean
): Promise<server> {
  const match = connectionString.match(CONNECTION_REGEX);

  if (!match) {
    throw new Error(
      "Invalid connection string format. Expected format: [username[:password]@]host[:port]"
    );
  }

  if (match[2]) {
    console.log(
      colors.yellow(
        "️ Please avoid writing your passwords directly into the terminal!"
      )
    );
  }

  const username = match[1] || userInfo().username;
  const host = match[3];

  const sshConfig: Partial<server> = {
    name: `auto-save-${username}@${host}`,
    username,
    usePassword: promptPassword || match[2] ? true : false,
    host,
    port: match[4] ? parseInt(match[4], 10) : 22,
  };

  if (sshConfig.usePassword) {
    sshConfig.password = promptPassword
      ? await password({ message: "Password:" })
      : match[2];
  } else if (sshConfig.usePassword === false) {
    // had to do this because of typescript
    sshConfig.privateKey = `${homedir()}/.ssh/id_rsa`;
  }

  return sshConfig as server;
}

export default parseConnectionString;
