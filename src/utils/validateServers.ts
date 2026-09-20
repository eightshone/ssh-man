import { exportedServer } from "./types";
import { SERVER_NAME_PATTERN } from "./validateServerName";

// name/host/username/privateKey end up written verbatim into the real
// ~/.ssh/config (see sshConfigFile.ts), so an imported entry can't be
// allowed to smuggle a line break in and inject its own directives
const UNSAFE_CONFIG_VALUE = /[\r\n\0]/;

// validates the wire format used by export/import files, which (unlike the
// live `server` type) carries a plaintext `password` for password-auth
// entries
function validateServers(value: unknown): value is exportedServer[] {
  if (!Array.isArray(value)) return false;

  return value.every((item) => {
    if (
      typeof item !== "object" ||
      item === null ||
      (typeof (item as any).id !== "string" || !(item as any).id) ||
      typeof (item as any).name !== "string" ||
      typeof (item as any).host !== "string" ||
      typeof (item as any).port !== "number" ||
      typeof (item as any).username !== "string" ||
      typeof (item as any).usePassword !== "boolean"
    ) {
      return false;
    }

    const connectivity = item as any;

    if (
      !SERVER_NAME_PATTERN.test(connectivity.name) ||
      UNSAFE_CONFIG_VALUE.test(connectivity.host) ||
      UNSAFE_CONFIG_VALUE.test(connectivity.username)
    ) {
      return false;
    }

    // check connectivity union type
    if (connectivity.usePassword === true) {
      return typeof connectivity.password === "string";
    } else if (connectivity.usePassword === false) {
      return (
        typeof connectivity.privateKey === "string" &&
        !UNSAFE_CONFIG_VALUE.test(connectivity.privateKey)
      );
    }

    return false;
  });
}

export default validateServers;
