import { Client } from "ssh2";

export type directoryEntry = {
  name: string;
  type: "file" | "directory" | "symlink" | "other";
  size: number;
  mtime: number;
};

function getSftp(client: Client) {
  return new Promise<import("ssh2").SFTPWrapper>((resolve, reject) => {
    client.sftp((err, sftp) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(sftp);
    });
  });
}

export async function readRemoteFile(
  client: Client,
  path: string,
): Promise<string> {
  const sftp = await getSftp(client);
  return new Promise((resolve, reject) => {
    sftp.readFile(path, "utf8" as any, (err, handle) => {
      sftp.end();
      if (err) {
        reject(err);
        return;
      }
      resolve(handle.toString());
    });
  });
}

export async function writeRemoteFile(
  client: Client,
  path: string,
  content: string,
): Promise<void> {
  const sftp = await getSftp(client);
  return new Promise((resolve, reject) => {
    sftp.writeFile(path, content, (err) => {
      sftp.end();
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

export async function listRemoteDirectory(
  client: Client,
  path: string,
): Promise<directoryEntry[]> {
  const sftp = await getSftp(client);
  return new Promise((resolve, reject) => {
    sftp.readdir(path, (err, list) => {
      sftp.end();
      if (err) {
        reject(err);
        return;
      }
      resolve(
        list.map((entry) => ({
          name: entry.filename,
          type: entry.attrs.isDirectory()
            ? "directory"
            : entry.attrs.isSymbolicLink()
              ? "symlink"
              : entry.attrs.isFile()
                ? "file"
                : "other",
          size: entry.attrs.size,
          mtime: entry.attrs.mtime,
        })),
      );
    });
  });
}
