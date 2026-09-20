import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { createRequire } from "module";
import { server } from "../../utils/types";

const require = createRequire(import.meta.url);
// resolved once so the shim can require() it by absolute path, regardless
// of cwd or how sshman itself is running
const KEYTAR_MODULE_PATH = require.resolve("@napi-rs/keyring/keytar.js");

// ssh invokes $SSH_ASKPASS with its own argv and waits for its stdout to
// close, so this must be a standalone script. Re-invoking the sshman CLI
// itself (e.g. under tsx) can hang forever waiting for that process to exit.
function createAskpassShim(): { path: string; cleanup: () => void } {
  const base = join(tmpdir(), `sshman-askpass-${process.pid}-${Date.now()}`);
  const scriptPath = `${base}.sh`;
  const helperPath = `${base}.cjs`;

  writeFileSync(
    helperPath,
    [
      `const { getPassword } = require(${JSON.stringify(KEYTAR_MODULE_PATH)});`,
      `getPassword("sshman", process.env.SSHMAN_SERVER_ID || "").then((pw) => {`,
      `  if (pw) { process.stdout.write(pw); } else { process.exitCode = 1; }`,
      `}).catch(() => { process.exitCode = 1; });`,
    ].join("\n"),
    { mode: 0o600 },
  );

  writeFileSync(
    scriptPath,
    [
      "#!/bin/sh",
      'if [ -n "$SSHMAN_ASKPASS_PASSWORD" ]; then',
      '  printf %s "$SSHMAN_ASKPASS_PASSWORD"',
      "else",
      `  exec ${shellQuote(process.execPath)} ${shellQuote(helperPath)}`,
      "fi",
      "",
    ].join("\n"),
    { mode: 0o700 },
  );

  return {
    path: scriptPath,
    cleanup: () => {
      try {
        unlinkSync(scriptPath);
      } catch {
        // best-effort cleanup
      }
      try {
        unlinkSync(helperPath);
      } catch {
        // best-effort cleanup
      }
    },
  };
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export type AskpassEnv = { env: NodeJS.ProcessEnv; cleanup: () => void };

// sets up SSH_ASKPASS for password auth. `oneOffPassword` (unsaved
// connection, or no keyring backend) goes through a scoped env var on the
// ssh child only; otherwise the shim looks the password up in the keyring
// by server id.
function buildAskpassEnv(sshConfig: server, oneOffPassword?: string): AskpassEnv {
  if (sshConfig.usePassword !== true) {
    return { env: process.env, cleanup: () => {} };
  }

  const shim = createAskpassShim();
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    SSH_ASKPASS: shim.path,
    SSH_ASKPASS_REQUIRE: "force",
  };

  if (oneOffPassword !== undefined) {
    env.SSHMAN_ASKPASS_PASSWORD = oneOffPassword;
    delete env.SSHMAN_SERVER_ID;
  } else {
    env.SSHMAN_SERVER_ID = sshConfig.id;
    delete env.SSHMAN_ASKPASS_PASSWORD;
  }

  return { env, cleanup: shim.cleanup };
}

export default buildAskpassEnv;
