import select from "@inquirer/select";
import normalizeServerName from "../../utils/normalizeServerName";
import readConfigFile from "../../utils/readConfigFile";
import { server } from "../../utils/types";
import validateServers from "../../utils/validateServers";
import init from "../functions/init";
import saveFile from "../../utils/saveFile";
import { CONFIG_DIR } from "../../utils/consts";

async function importServers(configFile: string, options: { force?: boolean }) {
  // intialize the cli app
  let { config } = await init();
  const existingServers = [...config.servers];

  // read config file
  const content = await readConfigFile<server[]>(configFile);

  // validate config file format
  if (!validateServers(content)) {
    console.log(
      "❌ The file you are trying to import is not a valid config file!"
    );
    return;
  }

  const newServerNames = content.map((s) => normalizeServerName(s.name));
  const hasExistingServers = existingServers.some((s) =>
    newServerNames.includes(normalizeServerName(s.name))
  );
  let updatedServers = [...config.servers];

  // make new servers list
  if (!hasExistingServers) {
    updatedServers = [...existingServers, ...content];
  } else {
    if (options.force) {
      updatedServers = [
        ...existingServers.filter(
          (s) => !newServerNames.includes(normalizeServerName(s.name))
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
            (s) => !newServerNames.includes(normalizeServerName(s.name))
          ),
          ...content,
        ];
      } else {
        const existingServerNames = existingServers.map((s) =>
          normalizeServerName(s.name)
        );

        updatedServers = [
          ...existingServers,
          ...content.filter(
            (s) => !existingServerNames.includes(normalizeServerName(s.name))
          ),
        ];
      }
    }
  }

  config.servers = updatedServers;

  await saveFile(`${CONFIG_DIR}/config.json`, config);

  console.log("✅ All server configs have been imported");
}

export default importServers;
