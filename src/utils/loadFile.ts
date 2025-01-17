import { promises as fs } from "fs";
import { json } from "./types";

async function loadFile<T = json>(filePath: string): Promise<T> {
  try {
    const fileContent = await fs.readFile(filePath, "utf8");
    return JSON.parse(fileContent) as T;
  } catch (error) {
    throw new Error(
      `Error reading or parsing file: ${(error as Error).message}`
    );
  }
}

export default loadFile;
