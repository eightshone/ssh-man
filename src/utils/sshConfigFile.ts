import { mkdir, readFile, writeFile, readdir, unlink } from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import { dirname } from "path";
import { homedir } from "os";
import dayjs from "dayjs";
import { CONFIG_DIR } from "./consts";
import { server } from "./types";

const execFileAsync = promisify(execFile);

export const REAL_SSH_CONFIG_PATH = `${homedir()}/.ssh/config`;

// the old design (pre marker-based management): a separate file sshman
// fully owned, wired in via a single `Include` line. Kept only so
// migrateLegacyManagedFile() can fold an existing install over to the new
// scheme below.
const LEGACY_MANAGED_PATH = `${CONFIG_DIR}/ssh_config`;
const LEGACY_INCLUDE_LINE = `Include ${LEGACY_MANAGED_PATH}`;
const LEGACY_HEADER_COMMENT =
  "# Added by sshman: managed Host entries for servers added via sshman";

const MARKER_START = "# >>> sshman managed hosts (do not edit by hand, regenerated on save) >>>";
const MARKER_END = "# <<< sshman managed hosts <<<";

export type ManagedHost = {
  host: string;
  port: number;
  username: string;
  privateKey?: string;
};

function buildHostBlocks(hosts: Record<string, ManagedHost>): string[] {
  return Object.entries(hosts)
    .filter(([name, h]) => {
      if (!h.host) {
        console.warn(`sshman: skipping "${name}" in ~/.ssh/config, it has no host set`);
        return false;
      }
      return true;
    })
    .map(([name, h]) => {
      const lines = [`Host ${name}`, `    HostName ${h.host}`, `    Port ${h.port || 22}`];
      if (h.username) {
        lines.push(`    User ${h.username}`);
      }
      if (h.privateKey) {
        lines.push(`    IdentityFile ${h.privateKey}`);
      }
      return lines.join("\n");
    });
}

// parses back the exact format built above, not a general ssh_config parser
// (no Match blocks, wildcards, or multi-pattern Host lines to handle), just
// this narrow shape
function parseHostBlocks(content: string): Record<string, ManagedHost> {
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

// finds sshman's marked section inside an already-read ~/.ssh/config,
// returning the text either side of it (markers themselves excluded)
function splitOnMarkers(content: string): { before: string; managed: string; after: string } | null {
  const startIdx = content.indexOf(MARKER_START);
  const endIdx = content.indexOf(MARKER_END);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) return null;
  return {
    before: content.slice(0, startIdx),
    managed: content.slice(startIdx + MARKER_START.length, endIdx),
    after: content.slice(endIdx + MARKER_END.length),
  };
}

async function backupRealSshConfigOnce(content: string): Promise<void> {
  if (!content) return;
  const sshDir = dirname(REAL_SSH_CONFIG_PATH);
  const dirEntries = await readdir(sshDir);
  const hasBackup = dirEntries.some((f) => f.startsWith("config.sshman-backup-"));
  if (hasBackup) return;
  const backupPath = `${REAL_SSH_CONFIG_PATH}.sshman-backup-${dayjs().format("YYYY-MM-DD---HH-mm-ss")}`;
  await writeFile(backupPath, content, { mode: 0o600 });
}

// sshman owns a single marked section inside the user's real ~/.ssh/config,
// always regenerated wholesale from the given map. Everything outside the
// markers (the user's own Host blocks, comments, whatever came before) is
// preserved byte-for-byte. This is the single point every caller writes
// through, so it's also the last line of defense against ever emitting
// invalid ssh_config syntax: one bad entry here breaks ssh parsing for
// every host in the file, not just its own.
export async function writeManagedHosts(hosts: Record<string, ManagedHost>): Promise<void> {
  const blocks = buildHostBlocks(hosts);
  const section = `${MARKER_START}\n${blocks.length ? blocks.join("\n\n") + "\n" : ""}${MARKER_END}\n`;

  const sshDir = dirname(REAL_SSH_CONFIG_PATH);
  await mkdir(sshDir, { recursive: true, mode: 0o700 });

  let content = "";
  try {
    content = await readFile(REAL_SSH_CONFIG_PATH, "utf8");
  } catch {
    // doesn't exist yet, created fresh below
  }

  const split = splitOnMarkers(content);
  let next: string;
  if (split) {
    const before = split.before.length ? split.before.replace(/\n*$/, "\n\n") : "";
    const after = split.after.length ? split.after.replace(/^\n*/, "\n") : "";
    next = before + section + after;
  } else {
    await backupRealSshConfigOnce(content);
    const separator = content.length > 0 ? (content.endsWith("\n") ? "\n" : "\n\n") : "";
    next = content + separator + section;
  }

  await writeFile(REAL_SSH_CONFIG_PATH, next, { mode: 0o600 });
}

export async function readManagedHosts(): Promise<Record<string, ManagedHost>> {
  let content: string;
  try {
    content = await readFile(REAL_SSH_CONFIG_PATH, "utf8");
  } catch {
    return {};
  }

  const split = splitOnMarkers(content);
  return split ? parseHostBlocks(split.managed) : {};
}

// one-time, self-healing: an install still on the old separate-file+Include
// scheme gets its hosts folded into the new marked section, the old Include
// line (and its header comment) removed, and the old file deleted. No-op
// once the old file is gone.
export async function migrateLegacyManagedFile(): Promise<boolean> {
  let legacyContent: string;
  try {
    legacyContent = await readFile(LEGACY_MANAGED_PATH, "utf8");
  } catch {
    return false;
  }

  await writeManagedHosts(parseHostBlocks(legacyContent));

  let content = "";
  try {
    content = await readFile(REAL_SSH_CONFIG_PATH, "utf8");
  } catch {
    // nothing to strip
  }
  if (content) {
    const cleaned = content
      .split("\n")
      .filter((line) => {
        const trimmed = line.trim().replace(/^#\s*/, "");
        return trimmed.toLowerCase() !== LEGACY_INCLUDE_LINE.toLowerCase();
      })
      .filter((line) => line.trim() !== LEGACY_HEADER_COMMENT)
      .join("\n");
    await writeFile(REAL_SSH_CONFIG_PATH, cleaned, { mode: 0o600 });
  }

  await unlink(LEGACY_MANAGED_PATH);
  return true;
}

// merges a persisted record (slim {id,name,usePassword}, or still the old
// full shape if a migration left it due to a name collision) with details
// from the managed section of ~/.ssh/config into the full `server` shape
// every other consumer in the app expects
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
