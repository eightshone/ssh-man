const UNSAFE_CONFIG_VALUE = /[\r\n\0]/;

// host/username/privateKey end up written verbatim into the real
// ~/.ssh/config (see sshConfigFile.ts), so a line break can't be allowed
// through, it would inject extra directives into that file
function validateConfigValue(value: string): true | string {
  if (UNSAFE_CONFIG_VALUE.test(value)) {
    return "Line breaks are not allowed here.";
  }
  return true;
}

export default validateConfigValue;
