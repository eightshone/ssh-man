import fs from "fs";

async function saveFile(filePath: string, data: any): Promise<void> {
  try {
    await fs.promises.writeFile(filePath, JSON.stringify(data), "utf8");
  } catch (error) {
    console.error("Error updating config file file:", error);
  }
}

export default saveFile;
