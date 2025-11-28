import { promises as fs } from "fs";
import { exit } from "process";

async function readConfigFile<T = unknown>(filePath: string): Promise<T> {
  try {
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data) as T;
  } catch (err) {
    console.error(`Error reading or parsing config file: ${filePath}`);
    exit();
  }
}

export default readConfigFile;
