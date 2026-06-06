import { promises as fs } from "fs";
import { isPlainJSON, decryptWithPassword } from "./crypto";

async function readConfigFile<T = unknown>(filePath: string, password?: string): Promise<T> {
  const data = await fs.readFile(filePath, "utf-8");

  if (isPlainJSON(data)) {
    return JSON.parse(data) as T;
  }

  // It is encrypted
  if (!password) {
    const error = new Error("File is encrypted") as any;
    error.code = "ERR_ENCRYPTED_FILE";
    throw error;
  }

  try {
    const decrypted = decryptWithPassword(data, password);
    return JSON.parse(decrypted) as T;
  } catch (err) {
    const error = new Error("Invalid password or corrupted file") as any;
    error.code = "ERR_INVALID_PASSWORD";
    throw error;
  }
}

export default readConfigFile;
