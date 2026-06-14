import select from "@inquirer/select";
import passwordPrompt from "@inquirer/password";
import normalizeServerName from "../../utils/normalizeServerName";
import readConfigFile from "../../utils/readConfigFile";
import { server } from "../../utils/types";
import validateServers from "../../utils/validateServers";
import init from "../functions/init";
import saveFile from "../../utils/saveFile";
import { CONFIG_DIR } from "../../utils/consts";

async function importServers(
  configFile: string,
  options: { force?: boolean; password?: string },
) {
  // intialize the cli app
  let { config } = await init();
  const existingServers = [...config.servers];

  let content: server[];
  let password = options.password;

  while (true) {
    try {
      content = await readConfigFile<server[]>(configFile, password);
      break;
    } catch (err: any) {
      if (err.code === "ERR_ENCRYPTED_FILE") {
        password = await passwordPrompt({
          message: "Enter decryption password:",
        });
        if (!password) {
          console.log("Decryption password is required. Import aborted.");
          return;
        }
      } else if (err.code === "ERR_INVALID_PASSWORD") {
        console.log("Invalid password.");
        password = await passwordPrompt({
          message: "Try again - Enter decryption password:",
        });
        if (!password) {
          console.log("Decryption password is required. Import aborted.");
          return;
        }
      } else if (err.code === "ENOENT") {
        console.log(`Error: File not found: ${configFile}`);
        return;
      } else {
        console.log(`Error reading or parsing config file: ${err.message}`);
        return;
      }
    }
  }

  // validate config file format
  if (!validateServers(content)) {
    console.log(
      "The file you are trying to import is not a valid config file!",
    );
    return;
  }

  const newServerNames = content.map((s) => normalizeServerName(s.name));
  const hasExistingServers = existingServers.some((s) =>
    newServerNames.includes(normalizeServerName(s.name)),
  );
  let updatedServers = [...config.servers];

  // make new servers list
  if (!hasExistingServers) {
    updatedServers = [...existingServers, ...content];
  } else {
    if (options.force) {
      updatedServers = [
        ...existingServers.filter(
          (s) => !newServerNames.includes(normalizeServerName(s.name)),
        ),
        ...content,
      ];
    } else {
      const update = await select({
        message:
          "One or more server configurations already exist with the same names. Do you want to update exiting items?",
        choices: [
          {
            name: "Yes, overwrite",
            value: true,
            description:
              "Update exisiting configs with data from imported file",
          },
          {
            name: "No, skip",
            value: false,
            description: "Keep exisiting items as they are",
          },
          {
            name: "Cancel import",
            value: null,
            description: "Cancel configs import and exit",
          },
        ],
      });

      if (typeof update !== "boolean") {
        return;
      }

      if (update) {
        updatedServers = [
          ...existingServers.filter(
            (s) => !newServerNames.includes(normalizeServerName(s.name)),
          ),
          ...content,
        ];
      } else {
        const existingServerNames = existingServers.map((s) =>
          normalizeServerName(s.name),
        );

        updatedServers = [
          ...existingServers,
          ...content.filter(
            (s) => !existingServerNames.includes(normalizeServerName(s.name)),
          ),
        ];
      }
    }
  }

  config.servers = updatedServers;

  try {
    await saveFile(`${CONFIG_DIR}/config.json`, config, undefined, true);
    console.log("All server configs have been imported");
  } catch (error: any) {
    console.error(`Failed to save config file: ${error.message}`);
    process.exit(1);
  }
}

export default importServers;
