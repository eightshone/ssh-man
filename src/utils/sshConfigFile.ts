import { mkdir, readFile, writeFile, readdir } from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import { dirname } from "path";
import { homedir } from "os";
import dayjs from "dayjs";
import { CONFIG_DIR } from "./consts";
import { server } from "./types";

const execFileAsync = promisify(execFile);

export const SSH_MANAGED_CONFIG_PATH = `${CONFIG_DIR}/ssh_config`;
export const REAL_SSH_CONFIG_PATH = `${homedir()}/.ssh/config`;

export type ManagedHost = {
  host: string;
  port: number;
  username: string;
  privateKey?: string;
};

// sshman fully owns this file, always regenerated wholesale from the given
// map, never hand-edited, so no incremental patching or markers are needed
export async function writeManagedHosts(
  hosts: Record<string, ManagedHost>,
): Promise<void> {
  const header =
    "# Managed by sshman, do not edit by hand: it is regenerated on every save.\n";
  const blocks = Object.entries(hosts).map(([name, h]) => {
    const lines = [
      `Host ${name}`,
      `    HostName ${h.host}`,
      `    Port ${h.port}`,
      `    User ${h.username}`,
    ];
    if (h.privateKey) {
      lines.push(`    IdentityFile ${h.privateKey}`);
    }
    return lines.join("\n");
  });

  const content =
    header + (blocks.length ? "\n" + blocks.join("\n\n") + "\n" : "");

  await mkdir(dirname(SSH_MANAGED_CONFIG_PATH), { recursive: true });
  await writeFile(SSH_MANAGED_CONFIG_PATH, content, { mode: 0o600 });
}

// parses back the exact format written above, not a general ssh_config
// parser (no Match blocks, wildcards, or multi-pattern Host lines to
// handle), just this file's own narrow shape
export async function readManagedHosts(): Promise<Record<string, ManagedHost>> {
  let content: string;
  try {
    content = await readFile(SSH_MANAGED_CONFIG_PATH, "utf8");
  } catch {
    return {};
  }

  const result: Record<string, ManagedHost> = {};
  let current: string | null = null;

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const hostMatch = line.match(/^Host\s+(\S+)/i);
    if (hostMatch) {
      current = hostMatch[1];
      result[current] = { host: "", port: 22, username: "" };
      continue;
    }
    if (!current) continue;

    const kv = line.match(/^(\S+)\s+(.+)$/);
    if (!kv) continue;
    const [, key, value] = kv;
    switch (key.toLowerCase()) {
      case "hostname":
        result[current].host = value;
        break;
      case "port":
        result[current].port = parseInt(value, 10) || 22;
        break;
      case "user":
        result[current].username = value;
        break;
      case "identityfile":
        result[current].privateKey = value;
        break;
    }
  }

  return result;
}

// idempotent: adds a single `Include` line for our managed file to the
// user's real ~/.ssh/config if it isn't already there, backing up the
// original first. Runs on every init() so it's self-healing if the line
// is ever removed.
export async function ensureSshConfigIncludes(): Promise<{ added: boolean }> {
  const sshDir = dirname(REAL_SSH_CONFIG_PATH);
  await mkdir(sshDir, { recursive: true, mode: 0o700 });

  let content = "";
  try {
    content = await readFile(REAL_SSH_CONFIG_PATH, "utf8");
  } catch {
    // doesn't exist yet, created fresh below
  }

  const includeLine = `Include ${SSH_MANAGED_CONFIG_PATH}`;
  const alreadyIncluded = content
    .split("\n")
    .some((line) => line.trim().toLowerCase() === includeLine.toLowerCase());

  if (alreadyIncluded) {
    return { added: false };
  }

  if (content.length > 0) {
    const dirEntries = await readdir(sshDir);
    const hasBackup = dirEntries.some((f) => f.startsWith("config.sshman-backup-"));
    if (!hasBackup) {
      const backupPath = `${REAL_SSH_CONFIG_PATH}.sshman-backup-${dayjs().format("YYYY-MM-DD---HH-mm-ss")}`;
      await writeFile(backupPath, content, { mode: 0o600 });
    }
  }

  const separator = content.length > 0 ? (content.endsWith("\n") ? "\n" : "\n\n") : "";
  const addition = `${separator}# Added by sshman: managed Host entries for servers added via sshman\n${includeLine}\n`;
  await writeFile(REAL_SSH_CONFIG_PATH, content + addition, { mode: 0o600 });

  return { added: true };
}

// merges a persisted record (slim {id,name,usePassword}, or still the old
// full shape if a migration left it due to a name collision) with details
// from the managed ssh_config file into the full `server` shape every
// other consumer in the app expects
export function hydrateServer(srv: any, managedHosts: Record<string, ManagedHost>): server {
  if (typeof srv.host === "string") {
    // already full-shape, never migrated, or left as-is due to a conflict
    return srv as server;
  }

  const details = managedHosts[srv.name] ?? { host: "", port: 22, username: "" };
  return {
    id: srv.id,
    name: srv.name,
    host: details.host,
    port: details.port,
    username: details.username,
    ...(srv.usePassword
      ? { usePassword: true }
      : { usePassword: false, privateKey: details.privateKey ?? "" }),
  } as server;
}

// runs the real ssh binary's own config resolver to check whether `name`
// is already claimed by some Host pattern outside sshman's control,
// avoiding reimplementing ssh_config matching semantics ourselves
export async function checkAliasAvailable(name: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync("ssh", ["-G", name]);
    const hostnameLine = stdout.split("\n").find((l) => l.startsWith("hostname "));
    const resolved = hostnameLine?.slice("hostname ".length).trim();
    return resolved === name;
  } catch {
    // don't block the user if `ssh -G` itself fails for some reason
    return true;
  }
}
