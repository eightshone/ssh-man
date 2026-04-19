import fs from "fs";
import { encrypt } from "./crypto";

async function saveFile(
  filePath: string,
  data: any,
  errorMessage: string = "Error updating config file file:",
  encrypted: boolean = false
): Promise<void> {
  try {
    const json = JSON.stringify(data);
    const content = encrypted ? encrypt(json) : json;
    await fs.promises.writeFile(filePath, content, "utf8");
  } catch (error) {
    console.error(errorMessage, error);
  }
}

export default saveFile;
