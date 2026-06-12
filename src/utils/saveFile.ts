import fs from "fs";
import { encrypt } from "./crypto";

async function saveFile(
  filePath: string,
  data: any,
  errorMessage: string = "Error saving file:",
  encrypted: boolean = false,
): Promise<void> {
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
}

export default saveFile;
