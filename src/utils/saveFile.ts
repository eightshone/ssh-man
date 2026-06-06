import fs from "fs";
import { encrypt } from "./crypto";

async function saveFile(
  filePath: string,
  data: any,
  errorMessage: string = "Error updating config file file:",
  encrypted: boolean = false
): Promise<void> {
  try {
    let content: string;
    if (typeof data === "string") {
      content = data;
    } else {
      content = JSON.stringify(data);
    }
    if (encrypted) {
      content = encrypt(content);
    }
    await fs.promises.writeFile(filePath, content, "utf8");
  } catch (error) {
    console.error(errorMessage, error);
  }
}

export default saveFile;
