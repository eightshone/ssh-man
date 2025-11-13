import { promises as fs } from "fs";

async function readConfigFile<T = unknown>(filePath: string): Promise<T> {
  try {
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data) as T;
  } catch (err) {
    console.error(`Error reading or parsing JSON file: ${filePath}`, err);
    throw err;
  }
}

export default readConfigFile;
