import { server } from "./types";

// builds the ssh argv for a server entry, only passes what the server
// config specifies, so ~/.ssh/config still supplies everything else
function buildSshArgs(sshConfig: server): string[] {
  const args: string[] = [];

  if (sshConfig.port) args.push("-p", String(sshConfig.port));
  if (sshConfig.username) args.push("-l", sshConfig.username);
  if (sshConfig.usePassword === false && sshConfig.privateKey) {
    args.push("-i", sshConfig.privateKey);
  }
  if (sshConfig.usePassword === true) {
    // password auth forces SSH_ASKPASS (askpassEnv.ts), which OpenSSH also
    // uses for the host-key confirmation prompt. Our script answers with
    // the password, not "yes", so it'd be declined. accept-new skips that
    // prompt for new hosts while still rejecting a changed key.
    args.push("-o", "StrictHostKeyChecking=accept-new");
  }

  args.push(sshConfig.host);
  return args;
}

export default buildSshArgs;
