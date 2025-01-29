import { server } from "./types";

function updateNameField(
  servers: server[],
  stringToReplace: string,
  replacementString: string
): server[] {
  return servers.map((server) => {
    server.name = server.name.replace(
      new RegExp(stringToReplace, "g"),
      replacementString
    );
    return server;
  });
}

export default updateNameField;
