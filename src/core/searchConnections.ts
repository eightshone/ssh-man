import search from "@inquirer/search";
import colors from "yoctocolors-cjs";
import { menu, server } from "../utils/types";
import stringPadding from "../utils/stringPadding";
import { inquirerTheme } from "../utils/themes";

const defaultChoice = [
  {
    name: "↩️ Servers list",
    value: "ssh-list",
    description: "Return to servers list",
  },
  {
    name: colors.dim(`  #  ${stringPadding("Name")}  Config`),
    disabled: " ",
    value: null,
  },
];

const debounceFunc = () => {};

async function searchConnections(servers: server[]): Promise<[menu, string[]]> {
  let options: string[] | null = null;

  console.log("Search servers:");

  let answer = await search({
    message: "Search for server",
    source: async (input, { signal }) => {
      await setTimeout(debounceFunc, 300);
      if (signal.aborted) return defaultChoice;

      let filteredServers = input?.length
        ? servers
            .map((srv, index) => ({ ...srv, index }))
            .filter(
              (srv) =>
                srv.name.includes(input) ||
                srv.host.includes(input) ||
                srv.username.includes(input) ||
                `${srv.port}`.includes(input)
            )
            .map((srv) => ({
              name: `${stringPadding(
                `${srv.index + 1}`,
                3,
                "start",
                "0"
              )}  ${stringPadding(srv.name)}  ${srv.username}:[redacted]@${
                srv.host
              }:${srv.port}`,
              value: `ssh-display#-_-#${JSON.stringify(srv)}#-_-#${srv.index}`,
              description: "Connect to server",
            }))
        : [];

      return [
        ...defaultChoice,
        ...(filteredServers.length
          ? filteredServers
          : [
              {
                name: input?.length
                  ? "📭 No server matched your search results"
                  : "⌨️ Start typing to show results matching your search",
                value: null,
                disabled: " ",
              },
            ]),
      ];
    },
    theme: inquirerTheme,
    pageSize: 10,
  });

  if (answer.startsWith("ssh-display")) {
    [answer, ...options] = answer.split("#-_-#");
  }

  console.clear();

  return [answer as menu, options];
}

export default searchConnections;
