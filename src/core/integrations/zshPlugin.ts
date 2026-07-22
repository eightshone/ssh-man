import { existsSync, readFileSync, writeFileSync, promises as fs } from "fs";
import { homedir } from "os";
import { join } from "path";
import saveFile from "../../utils/saveFile";
import { CONFIG_DIR, NAMES_CACHE_FILE } from "../../utils/consts";
import { config } from "../../utils/types";

export type ZshPluginStatus = "installed" | "not_installed" | "omz_missing";

export type ZshPluginResult = {
  config: config;
  ok: boolean;
  message: string;
};

const PLUGIN_SCRIPT = `#compdef sshman

_sshman_server_names() {
  local cache="$HOME/.sshman/.names"
  [[ -f "$cache" ]] || return
  local -a names
  names=("\${(@f)$(<"$cache")}")
  _describe 'server' names
}

_sshman() {
  local -a cmds
  cmds=(connect reconnect logs export import search telemetry debug completion goodbye check-updates)

  case $CURRENT in
    2)
      _describe 'command' cmds
      ;;
    3)
      case \${words[2]} in
        connect|reconnect|logs)
          _sshman_server_names
          ;;
      esac
      ;;
  esac
}

compdef _sshman sshman
`;

function detectOmzDir(): string | null {
  const zshDir = process.env.ZSH || join(homedir(), ".oh-my-zsh");
  return existsSync(zshDir) ? zshDir : null;
}

function getPluginPaths() {
  const zshDir = detectOmzDir() || join(homedir(), ".oh-my-zsh");
  const zshCustom = process.env.ZSH_CUSTOM || join(zshDir, "custom");
  const pluginDir = join(zshCustom, "plugins", "sshman");

  return {
    zshrcFile: join(homedir(), ".zshrc"),
    pluginDir,
    pluginFile: join(pluginDir, "sshman.plugin.zsh"),
  };
}

// Matches only a real `plugins=(...)` assignment at the start of a line
// (ignoring leading indentation) — not the commented-out example line
// oh-my-zsh's default .zshrc template ships with.
const PLUGINS_LINE_RE = /^([ \t]*)plugins=\(([\s\S]*?)\)/m;

function pluginsBlockContains(content: string, name: string): boolean {
  const match = content.match(PLUGINS_LINE_RE);
  if (!match) return false;
  return match[2].split(/\s+/).filter(Boolean).includes(name);
}

function addPluginToZshrc(content: string): string {
  const match = content.match(PLUGINS_LINE_RE);
  if (!match) {
    return `${content}\nplugins=(sshman)\n`;
  }

  const [full, indent, inner] = match;
  if (inner.split(/\s+/).filter(Boolean).includes("sshman")) return content;

  const isMultiline = inner.includes("\n");
  const newInner = isMultiline
    ? `${inner.replace(/\s*$/, "")}\n  sshman\n`
    : ` ${inner.trim()} sshman `.replace(/\s+/g, " ").trim();

  return content.replace(full, `${indent}plugins=(${newInner})`);
}

function removePluginFromZshrc(content: string): string {
  const match = content.match(PLUGINS_LINE_RE);
  if (!match) return content;

  const [full, indent, inner] = match;
  const isMultiline = inner.includes("\n");
  const names = inner.split(/\s+/).filter(Boolean).filter((n) => n !== "sshman");
  const newInner = isMultiline
    ? names.length
      ? `\n  ${names.join("\n  ")}\n`
      : "\n"
    : names.join(" ");

  return content.replace(full, `${indent}plugins=(${newInner})`);
}

export function getZshPluginStatus(): ZshPluginStatus {
  if (!detectOmzDir()) return "omz_missing";

  const { pluginFile, zshrcFile } = getPluginPaths();
  if (!existsSync(pluginFile) || !existsSync(zshrcFile)) return "not_installed";

  const zshrc = readFileSync(zshrcFile, "utf8");
  return pluginsBlockContains(zshrc, "sshman") ? "installed" : "not_installed";
}

function writeNameCache(cfg: config): void {
  const names = cfg.servers.map((s) => s.name).join("\n");
  writeFileSync(NAMES_CACHE_FILE, names ? `${names}\n` : "");
}

export function syncNameCache(cfg: config): void {
  if (cfg.shellCompletionEnabled) {
    writeNameCache(cfg);
  }
}

export async function installZshPlugin(cfg: config): Promise<ZshPluginResult> {
  if (!detectOmzDir()) {
    return {
      config: cfg,
      ok: false,
      message: "Oh My Zsh was not detected (~/.oh-my-zsh not found).",
    };
  }

  const { zshrcFile, pluginDir, pluginFile } = getPluginPaths();
  await fs.mkdir(pluginDir, { recursive: true });
  await fs.writeFile(pluginFile, PLUGIN_SCRIPT, "utf8");

  if (existsSync(zshrcFile)) {
    const original = await fs.readFile(zshrcFile, "utf8");
    await fs.writeFile(`${zshrcFile}.sshman.bak`, original, "utf8");
    await fs.writeFile(zshrcFile, addPluginToZshrc(original), "utf8");
  }

  const updatedConfig: config = { ...cfg, shellCompletionEnabled: true };
  await saveFile(`${CONFIG_DIR}/config.json`, updatedConfig, undefined, true);
  writeNameCache(updatedConfig);

  return {
    config: updatedConfig,
    ok: true,
    message: "Installed. Run `source ~/.zshrc` or restart your shell.",
  };
}

export async function uninstallZshPlugin(cfg: config): Promise<ZshPluginResult> {
  const { zshrcFile, pluginDir } = getPluginPaths();

  if (existsSync(zshrcFile)) {
    const original = await fs.readFile(zshrcFile, "utf8");
    await fs.writeFile(`${zshrcFile}.sshman.bak`, original, "utf8");
    await fs.writeFile(zshrcFile, removePluginFromZshrc(original), "utf8");
  }

  await fs.rm(pluginDir, { recursive: true, force: true });
  if (existsSync(NAMES_CACHE_FILE)) {
    await fs.rm(NAMES_CACHE_FILE, { force: true });
  }

  const updatedConfig: config = { ...cfg, shellCompletionEnabled: false };
  await saveFile(`${CONFIG_DIR}/config.json`, updatedConfig, undefined, true);

  return {
    config: updatedConfig,
    ok: true,
    message: "Uninstalled. Restart your shell to fully clear completions.",
  };
}
