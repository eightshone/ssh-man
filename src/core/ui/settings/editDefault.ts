import number from "@inquirer/number";
import string from "@inquirer/input";
import { config, editDefaultOptions, menu } from "../../../utils/types";
import validateServerName from "../../../utils/validateServerName";
import saveConfig from "../../../utils/saveConfig";

async function editDefault(
  options: editDefaultOptions,
  config: config
): Promise<[menu, config]> {
  const innerConfig = { ...config };

  if (options.type === "number") {
    innerConfig.defaults.port = await number({
      message: options.message,
      default: options.defaultValue,
    });
  } else {
    innerConfig.defaults[
      options.type === "private-key" ? "privateKey" : "autoSavePrefix"
    ] = await string({
      message: options.message,
      default: options.defaultValue,
      ...(options.type === "private-key"
        ? {}
        : {
            validate: (value) => validateServerName(value, config.servers),
          }),
    });
  }

  await saveConfig(innerConfig);

  return ["settings", innerConfig];
}

export default editDefault;
