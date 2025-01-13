import { promises as fs } from "fs";
import { dirname } from "path";

async function createFileIfNotExists(
  filePath: string,
  content: string = ""
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
      await fs.writeFile(filePath, content);
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

export default createFileIfNotExists;
