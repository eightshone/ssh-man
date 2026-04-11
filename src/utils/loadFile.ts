import { promises as fs } from "fs";
import { json } from "./types";
import { decrypt, isPlainJSON } from "./crypto";

async function loadFile<T = json>(
  filePath: string,
  encrypted: boolean = false
): Promise<T> {
  try {
    const fileContent = await fs.readFile(filePath, "utf8");

    if (encrypted && !isPlainJSON(fileContent)) {
      const decrypted = decrypt(fileContent);
      return JSON.parse(decrypted) as T;
    }

    return JSON.parse(fileContent) as T;
  } catch (error) {
    throw new Error(
      `Error reading or parsing file: ${(error as Error).message}`
    );
  }
}

export default loadFile;
