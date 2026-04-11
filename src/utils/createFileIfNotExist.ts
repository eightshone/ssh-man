import { promises as fs } from "fs";
import { dirname } from "path";
import { encrypt } from "./crypto";

async function createFileIfNotExists(
  filePath: string,
  content: string = "",
  encrypted: boolean = false
): Promise<void> {
  try {
    // Get the directory path
    const dir: string = dirname(filePath);

    // Ensure the directory exists
    await fs.mkdir(dir, { recursive: true });

    // Check if the file exists, and create it if it doesn't
    try {
      await fs.access(filePath);
    } catch {
      const fileContent = encrypted ? encrypt(content) : content;
      await fs.writeFile(filePath, fileContent);
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

export default createFileIfNotExists;
