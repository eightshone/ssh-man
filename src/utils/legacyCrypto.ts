// old format: config.json used to be encrypted with a key derived from this
// machine's hostname+username. Kept only for init() to decrypt it once
// during migration, nothing new should use this.
import { scryptSync, createDecipheriv } from "crypto";
import { existsSync, readFileSync, unlinkSync } from "fs";
import { hostname, userInfo } from "os";
import { CONFIG_DIR } from "./consts";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const SALT_FILE = `${CONFIG_DIR}/.salt`;

function deriveKey(): Buffer {
  const salt = readFileSync(SALT_FILE);
  const baseKey = `${hostname()}:${userInfo().username}`;
  return scryptSync(baseKey, salt, KEY_LENGTH);
}

export function legacyDecrypt(ciphertext: string): string {
  const key = deriveKey();
  const data = Buffer.from(ciphertext, "base64");
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted).toString("utf8") + decipher.final("utf8");
}

export function removeLegacySalt(): void {
  try {
    if (existsSync(SALT_FILE)) unlinkSync(SALT_FILE);
  } catch {
    // best-effort cleanup
  }
}
