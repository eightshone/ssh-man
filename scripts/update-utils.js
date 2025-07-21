import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.resolve(__dirname, '../dist/src/utils/consts.js');

try {
  const data = await fs.readFile(filePath, 'utf8');

  const updatedData = data.replace(
    /import\s+packageJson\s+from\s+["'](\.\.\/\.\.\/package\.json)["'];?/,
    'import packageJson from "$1" with { type: "json" };'
  );

  await fs.writeFile(filePath, updatedData, 'utf8');

  console.log('Import statement successfully updated.');
} catch (err) {
  console.error('Error while processing file:', err);
  process.exit(1);
}