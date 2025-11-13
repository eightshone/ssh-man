import { homedir } from "os";
import colors from "yoctocolors-cjs";
import { server } from "./types";
import { CONNECTION_REGEX } from "./consts";

function parseConnectionString(connectionString: string): server {
  const match = connectionString.match(CONNECTION_REGEX);

  if (!match) {
    throw new Error(
      "Invalid connection string format. Expected format: username[:password]@server[:port]"
    );
  }

  if (match[2]) {
    console.log(
      colors.yellow(
        "⚠️ Please avoid writing your passwords directly into the terminal!"
      )
    );
  }

  const sshConfig: Partial<server> = {
    name: `auto-save-${match[1]}@${match[3]}`,
    username: match[1],
    usePassword: match[2] ? true : false,
    host: match[3],
    port: match[4] ? parseInt(match[4], 10) : 22,
  };

  if (sshConfig.usePassword) {
    sshConfig.password = match[2];
  } else if (sshConfig.usePassword === false) {
    // had to do this because of typescript
    sshConfig.privateKey = `${homedir()}/.ssh/id_rsa`;
  }

  return sshConfig as server;
}

export default parseConnectionString;
