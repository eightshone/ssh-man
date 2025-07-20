import https from "https";

async function getLatestNpmVersion(pkg: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    https
      .get(`https://registry.npmjs.org/${pkg}/latest`, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            resolve(json.version);
          } catch {
            resolve(null); // fallback: treat error as unavailable
          }
        });
      })
      .on("error", () => resolve(null));
  });
}

export default getLatestNpmVersion;
