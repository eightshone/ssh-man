import { existsSync, promises as fs } from "fs";
import dayjs from "dayjs";
import yoctoSpinner from "yocto-spinner";
import colors from "yoctocolors-cjs";
import createFileIfNotExists from "../../utils/createFileIfNotExist";
import { CONFIG_DIR, DEFAULT_CONFIG, VERSION } from "../../utils/consts";
import loadFile from "../../utils/loadFile";
import { config, log } from "../../utils/types";
import compareVersions from "../../utils/compareVersions";
import migrate from "./migrate";
import migrateSecretsToKeyring from "./migrateSecrets";
import migrateSshConfigStorage from "./migrateSshConfigStorage";
import isSameVersion from "./isSameVersion";
import showUpdateMessage from "./showUpdateMessage";
import { isPlainJSON } from "../../utils/crypto";
import { legacyDecrypt, removeLegacySalt } from "../../utils/legacyCrypto";
import saveFile from "../../utils/saveFile";
import { ensureSshConfigIncludes, readManagedHosts, hydrateServer } from "../../utils/sshConfigFile";

type options = {
  silent?: boolean;
};

async function init(
  options: options = { silent: false },
): Promise<{ config: config; logs: log[] }> {
  const { silent } = options;
  const configFile = `${CONFIG_DIR}/config.json`;
  const logsFile = `${CONFIG_DIR}/logs.json`;

  let spinner;
  if (!silent) {
    spinner = yoctoSpinner({ text: "Checking config files…" }).start();
  }

  // check for app config files
  if (!existsSync(configFile) || !existsSync(logsFile)) {
    if (!silent && spinner) {
      spinner.text = "Creating config files…";
    }
    await createFileIfNotExists(configFile, JSON.stringify(DEFAULT_CONFIG));
    await createFileIfNotExists(logsFile, "[]");
    if (!silent && spinner) {
      spinner.text = "Config files created!";
    }
  }

  // todo: add config files validations
  // load config and logs
  if (!silent && spinner) {
    spinner.text = "Loading config files…";
  }

  const rawConfigContent = await fs.readFile(configFile, "utf8");
  let configObj: config;

  if (isPlainJSON(rawConfigContent)) {
    configObj = JSON.parse(rawConfigContent) as config;
  } else {
    // legacy machine-encrypted config from before secrets moved to the OS
    // keyring: decrypt once, move each password into the keyring, and
    // rewrite config.json as plain metadata going forward
    if (!silent && spinner) {
      spinner.text = "Migrating stored secrets to the OS keyring…";
    }
    const decrypted = legacyDecrypt(rawConfigContent);
    configObj = await migrateSecretsToKeyring(JSON.parse(decrypted) as config);
    await saveFile(configFile, configObj);
    removeLegacySalt();
    if (!silent && spinner) {
      spinner.text = "Secrets migrated!";
    }
  }

  let logsObj: log[] = await loadFile(logsFile);

  // sanitize server bookkeeping fields before anything looks them up
  configObj.servers = (configObj.servers || []).map((srv: any) => ({
    ...srv,
    name: srv.name ?? "",
  }));
  configObj.recentServers = (configObj.recentServers || []).map((srv: any) => ({
    ...srv,
    name: srv.name ?? "",
  }));

  // move any still-full-shape server's host/port/username/privateKey out of
  // config.json and into ~/.ssh/config. Self-healing, so this only does
  // real work the first time, or for a server left behind by a name
  // collision until it's resolved.
  const hasOldShapeServers = [...configObj.servers, ...configObj.recentServers].some(
    (srv: any) => typeof srv.host === "string",
  );
  if (hasOldShapeServers) {
    if (!silent && spinner) {
      spinner.text = "Moving connection details to ~/.ssh/config…";
    }
    configObj = await migrateSshConfigStorage(configObj);
  }

  // self-healing: make sure ~/.ssh/config still includes sshman's managed
  // file even if the line was removed since last run
  await ensureSshConfigIncludes();

  // reconstitute full server objects from the managed ssh_config file. From
  // here on, config.servers/recentServers are the full {id,name,host,port,
  // username,usePassword,privateKey?} shape every other part of the app
  // expects, exactly as before this feature existed.
  const managedHosts = await readManagedHosts();
  configObj.servers = configObj.servers.map((srv: any) => hydrateServer(srv, managedHosts));
  configObj.recentServers = configObj.recentServers.map((srv: any) =>
    hydrateServer(srv, managedHosts),
  );

  // sanitize the now-hydrated server objects to ensure mandatory string
  // fields are present
  configObj.servers = configObj.servers.map((srv) => ({
    ...srv,
    host: srv.host ?? "",
    username: srv.username ?? "",
    port: srv.port ?? 22,
  }));

  configObj.recentServers = configObj.recentServers.map((srv) => ({
    ...srv,
    host: srv.host ?? "",
    username: srv.username ?? "",
    port: srv.port ?? 22,
  }));

  const problematicServers = configObj.servers.filter(
    (srv) => srv.name.includes(".") && !srv.name.startsWith("auto-save-"),
  );
  if (problematicServers.length > 0 && !silent) {
    if (spinner) {
      spinner.info("Some saved connections have dots in their names.");
    }

    console.log(
      colors.yellow(
        "Names with dots may conflict with direct URL connections.",
      ),
    );
    console.log(colors.yellow("Problematic connections:"));
    problematicServers.forEach((srv) => {
      console.log(colors.yellow(` - ${srv.name}`));
    });
    console.log(""); // newline

    if (spinner) {
      spinner.start();
    }
  }

  if (!silent && spinner) {
    spinner.text = "Config files loaded!";
    spinner.text = "Checking config compatibility…";
  }

  // migrate config files
  if (
    !configObj.version ||
    (!!configObj.version && compareVersions(VERSION, configObj.version) === 1)
  ) {
    if (!silent && spinner) {
      spinner.text = "Migrating config files…";
    }
    [configObj, logsObj] = await migrate(configObj, logsObj, spinner);
    if (!silent && spinner) {
      spinner.text = "Config files migrated!";
    }
  }

  // check for updates (at most once per day)
  const lastCheckFile = `${CONFIG_DIR}/.last-update-check`;
  let shouldCheckUpdate = true;

  if (existsSync(lastCheckFile)) {
    try {
      const lastCheck = await fs.readFile(lastCheckFile, "utf8");
      if (dayjs().isSame(dayjs(lastCheck), "day")) {
        shouldCheckUpdate = false;
      }
    } catch {
      // corrupt file or invalid date, re-check
    }
  }

  if (shouldCheckUpdate) {
    if (!silent && spinner) {
      spinner.text = "Checking for updates…";
    }
    const [isUptodate, manager] = await isSameVersion();
    await fs.writeFile(lastCheckFile, dayjs().toISOString(), "utf8");

    if (!silent && spinner) {
      spinner.success("App started!");
    }

    if (!silent) {
      showUpdateMessage(isUptodate, manager, true);
    }
  } else {
    if (!silent && spinner) {
      spinner.success("App started!");
    }
  }

  return {
    config: configObj,
    logs: logsObj,
  };
}

export default init;
