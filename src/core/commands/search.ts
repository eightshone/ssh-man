import colors from "yoctocolors-cjs";
import init from "../functions/init";
import stringPadding from "../../utils/stringPadding";
import { server } from "../../utils/types";

async function searchCommand(terms: string[], options: { fuzzy?: boolean }) {
  const query = terms.join(" ");
  const { fuzzy } = options;

  const { config } = await init({ silent: true });
  const servers = config.servers;

  let filteredServers: (server & { originalIndex: number })[] = [];

  const getSearchableString = (srv: server) =>
    `${srv.username}@${srv.host}:${srv.port}`.toLowerCase();

  if (fuzzy) {
    const fuzzyRegex = new RegExp(query.split("").join(".*"), "i");
    filteredServers = servers
      .map((srv, index) => ({ ...srv, originalIndex: index }))
      .filter((srv) => fuzzyRegex.test(getSearchableString(srv)));
  } else {
    const lowerTerms = terms.map((t) => t.toLowerCase());
    filteredServers = servers
      .map((srv, index) => ({ ...srv, originalIndex: index }))
      .filter((srv) => {
        const searchable = getSearchableString(srv);
        return lowerTerms.every((term) => searchable.includes(term));
      });
  }

  if (filteredServers.length === 0) {
    console.log(colors.yellow(`\n📭 No servers found matching: "${query}"`));
    return;
  }

  console.log(colors.cyan(`\n🔍 Search results for "${colors.bold(query)}":`));
  console.log(colors.dim(`  #  ${stringPadding("Name")}  Config`));

  filteredServers.forEach((srv) => {
    const formattedIndex = colors.dim(
      stringPadding(`${srv.originalIndex + 1}`, 3, "start", "0")
    );
    const formattedName = stringPadding(srv.name);
    const formattedConfig = `${colors.yellow(srv.username)}:[redacted]@${colors.blue(
      srv.host
    )}:${colors.magenta(`${srv.port}`)}`;

    console.log(`${formattedIndex}  ${formattedName}  ${formattedConfig}`);
  });
  console.log("");
}

export default searchCommand;
