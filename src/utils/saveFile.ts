import fs from "fs";

async function saveFile(filePath: string, data: any): Promise<void> {
  const content = typeof data === "string" ? data : JSON.stringify(data);
  await fs.promises.writeFile(filePath, content, "utf8");
}

export default saveFile;
