import fs from "fs";

async function saveFile(
  filePath: string,
  data: any,
  errorMessage: string = "Error updating config file file:"
): Promise<void> {
  try {
    await fs.promises.writeFile(filePath, JSON.stringify(data), "utf8");
  } catch (error) {
    console.error(errorMessage, error);
  }
}

export default saveFile;
